import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../prisma';
import { MailService } from '../mail/mail.service';
import { randomSixDigitCode, randomToken, sha256Hex } from '../../common/crypto';
import { hashPassword, verifyPassword } from '../../common/password';
import type { JwtAccessPayload } from '../../auth/auth.jwt';

const EMAIL_CODE_TTL_MINUTES = 10; //Email verification codes are valid for 10 minutes.
const RESET_TOKEN_TTL_MINUTES = 30;//Password reset tokens are valid for 30 minutes.
type PublicUser = {
  id: string;
  email: string | null;
  onboardingCompleted: boolean;
};
export class AuthService {

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
        private readonly mail: MailService,
    ) {}


  private accessTtlSeconds(): number {
    return Number(this.config.get('JWT_ACCESS_TTL_SECONDS') ?? 900);
  }
  private refreshTtlDays(): number {
    return Number(this.config.get('REFRESH_TTL_DAYS') ?? 30);
  }
  private refreshPepper(): string {
    return this.config.getOrThrow<string>('REFRESH_TOKEN_PEPPER');
  }
  private resetPepper(): string {
    return this.config.getOrThrow<string>('RESET_TOKEN_PEPPER');// getOrThrow Give me this config value, or stop the app
  }
  private toPublicUser(input: {
    id: bigint;
    email: string | null;
    onboardingCompleted: boolean;
  }): PublicUser {
    return {
      id: input.id.toString(),
      email: input.email,
      onboardingCompleted: input.onboardingCompleted,
    };
  }


   async signupEmail(email: string, password: string) {
    // 1) Hash password
    const passwordHash = await hashPassword(password);

    // 2) Create user + password row
    try {
      await this.prisma.user.create({
        data: {
          email,
          password: {
            create: { passwordHash },
          },
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') //P2002 prisma error user already exists
        {
        throw new ConflictException('Email already in use');
      }
      throw err;
    }

    // 3) Send 6-digit verification code
    await this.issueEmailVerificationCode(email);
    return { message: 'Verification code sent' };
  }

  async loginEmail(email: string, password: string) {
    // 1) Load user + password
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { password: true, profile: true },
    });

    // 2) Validate password
    if (!user?.password?.passwordHash) throw new UnauthorizedException('Invalid credentials');
    const ok = await verifyPassword(password, user.password.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    // 3) Must be verified
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Email is not verified');
    }

    // 4) Create session + tokens
    const { accessToken, refreshToken } = await this.createSessionAndTokens(user.id, user.email ?? undefined);

    const publicUser = this.toPublicUser({
      id: user.id,
      email: user.email,
      onboardingCompleted: Boolean(user.profile?.onboardingCompletedAt),
    });

    return {
      accessToken,
      refreshToken,
      user: publicUser,
    };
  }

  async issueEmailVerificationCode(email: string) {
    const code = randomSixDigitCode();
    const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MINUTES * 60_000);

    await this.prisma.emailVerificationCode.create({
      data: {
        email,
        code,
        expiresAt,
      },
    });

    await this.mail.sendVerificationCode(email, code);

    return { message: 'Verification code sent' };
  }



  async verifyEmail(email: string, code: string) {
    // Find the latest matching, unused, non-expired code
    const record = await this.prisma.emailVerificationCode.findFirst({
      where: {
        email,
        code,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) throw new BadRequestException('Invalid or expired verification code');

    const user = await this.prisma.user.findUnique({ where: { email }, include: { profile: true } });
    if (!user) throw new BadRequestException('User not found');

    // Consume code + mark user verified (transaction)
    await this.prisma.$transaction([
      this.prisma.emailVerificationCode.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
      }),
    ]);

    const { accessToken, refreshToken } = await this.createSessionAndTokens(user.id, user.email ?? undefined);

    const publicUser = this.toPublicUser({
      id: user.id,
      email: user.email,
      onboardingCompleted: Boolean(user.profile?.onboardingCompletedAt),
    });
    return {
      accessToken,
      refreshToken,
      user: publicUser,
    };
  }


  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) return { message: 'If that email exists, a reset link has been sent' };

    // Generate and store hashed reset token
    const raw = randomToken(48);
    const tokenHash = sha256Hex(raw + this.resetPepper());
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    await this.mail.sendPasswordReset(email, raw);
    return { message: 'If that email exists, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    // Validate reset token
    const tokenHash = sha256Hex(token + this.resetPepper());
    const record = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) throw new BadRequestException('Invalid or expired reset token');

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Mark token used, update password, revoke all sessions (transaction)
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.userPassword.upsert({
        where: { userId: record.userId },
        create: { userId: record.userId, passwordHash },
        update: { passwordHash },
      }),
      // Revoke all sessions (force logout everywhere)
      this.prisma.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Password updated' };
  }


    async refresh(refreshToken: string) {
    // 1) Find session by hashed refresh token
    const hash = sha256Hex(refreshToken + this.refreshPepper());
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hash },
      include: { user: { include: { profile: true } } },
    });

    // 2) Validate session
    if (!session) throw new UnauthorizedException('Invalid refresh token');
    if (session.revokedAt) throw new UnauthorizedException('Refresh token revoked');
    if (session.expiresAt <= new Date()) throw new UnauthorizedException('Refresh token expired');

    // Rotate token (invalidate old refresh token)
    await this.prisma.session.update({
      where: { id: session.id },
      data: { rotatedAt: new Date(), revokedAt: new Date() },
    });

    const { accessToken, refreshToken: newRefresh } = await this.createSessionAndTokens(
      session.userId,
      session.user.email ?? undefined,
    );

    const publicUser = this.toPublicUser({
      id: session.userId,
      email: session.user.email,
      onboardingCompleted: Boolean(session.user.profile?.onboardingCompletedAt),
    });

    return {
      accessToken,
      refreshToken: newRefresh,
      user: publicUser,
    };
  }



async logout(refreshToken: string) {
    const hash = sha256Hex(refreshToken + this.refreshPepper());
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out' };
  }



  async logoutAll(userId: bigint) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out from all devices' };
  }


private async createSessionAndTokens(userId: bigint, email?: string) {
    const refreshToken = randomToken(48);
    const refreshTokenHash = sha256Hex(refreshToken + this.refreshPepper());
    const expiresAt = new Date(Date.now() + this.refreshTtlDays() * 24 * 60 * 60_000);
    const sessionId = randomUUID();

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenHash,
        expiresAt,
      },
    });

    const payload: JwtAccessPayload = {
      sub: userId.toString(),
      email,
      roles: ['user'],
      sid: sessionId,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.accessTtlSeconds(),
    });

    return { accessToken, refreshToken };
  }



async oauthStart(provider: 'google', redirectUri?: string) {
  const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
  const cb = redirectUri ?? this.config.get<string>('OAUTH_REDIRECT_URI');

  if (!clientId || !cb) {
    throw new NotImplementedException('Google OAuth is not configured');
  }

  const scopes = encodeURIComponent('openid email profile');

  const url =
    `https://accounts.google.com/o/oauth2/v2/auth?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(cb)}` +
    `&scope=${scopes}`;

  return { url };
}



async oauthCallback(provider: 'google', code: string, redirectUri?: string) {
  const cb = redirectUri ?? this.config.get<string>('OAUTH_REDIRECT_URI');
  if (!cb) throw new BadRequestException('Missing redirectUri');

  const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
  const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new NotImplementedException('Google OAuth is not configured');
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: cb,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) throw new UnauthorizedException('OAuth code exchange failed');

  const tokenJson = (await tokenRes.json()) as { access_token: string };

  const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { authorization: `Bearer ${tokenJson.access_token}` },
  });

  if (!userinfoRes.ok) throw new UnauthorizedException('OAuth userinfo fetch failed');

  const userinfo = (await userinfoRes.json()) as { sub: string; email?: string };

  return this.upsertOAuthUser('google', userinfo.sub, userinfo.email);
}



private async upsertOAuthUser(provider: 'google', providerUid: string, email?: string) {
  const identity = await this.prisma.userIdentity.findUnique({
    where: { provider_providerUid: { provider, providerUid } },
    include: { user: { include: { profile: true } } },
  });

  let userId: bigint;
  let userEmail: string | undefined;
  let onboardingCompleted = false;

  if (identity) {
    userId = identity.userId;
    userEmail = identity.user.email ?? undefined;
    onboardingCompleted = Boolean(identity.user.profile?.onboardingCompletedAt);
  } else {
    const user = await this.prisma.user.create({
      data: {
        email,
        emailVerifiedAt: new Date(),
        identities: {
          create: { provider, providerUid },
        },
      },
      include: { profile: true },
    });

    userId = user.id;
    userEmail = user.email ?? undefined;
    onboardingCompleted = Boolean(user.profile?.onboardingCompletedAt);
  }

  const { accessToken, refreshToken } = await this.createSessionAndTokens(userId, userEmail);

  return {
    accessToken,
    refreshToken,
    user: this.toPublicUser({ id: userId, email: userEmail ?? null, onboardingCompleted }),
  };
}
}
