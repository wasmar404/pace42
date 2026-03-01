import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import { CurrentUser, JwtAuthGuard, type RequestUser } from '../../auth/auth.jwt';
import { REFRESH_COOKIE_NAME } from './auth.constants';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  OAuthCallbackDto,
  ResendVerificationDto,
  ResetPasswordDto,
  SignupDto,
  VerifyEmailDto,
} from '../../auth/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly config: ConfigService) {}


  private refreshCookiePath(): string {
    return '/api/auth';
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    const isProd = (this.config.get('NODE_ENV') ?? 'development') === 'production';
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: this.refreshCookiePath(),
      maxAge: Number(this.config.get('REFRESH_COOKIE_MAX_AGE_MS') ?? 30 * 24 * 60 * 60_000),
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: this.refreshCookiePath() });
  }

  private readRefreshToken(res: Response, body?: any, queryToken?: string): string | undefined {
    const fromBody = body?.refreshToken as string | undefined;
    const fromCookie = (res.req as any)?.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    return fromCookie ?? fromBody ?? queryToken;
  }

  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    return this.auth.signupEmail(dto.email.toLowerCase(), dto.password);
  }

  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.verifyEmail(dto.email.toLowerCase(), dto.code);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.auth.issueEmailVerificationCode(dto.email.toLowerCase());
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.loginEmail(dto.email.toLowerCase(), dto.password);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Res({ passthrough: true }) res: Response, @Query('token') token?: string, @Body() body?: any) {
    const refreshToken = this.readRefreshToken(res, body, token);
    if (!refreshToken) {
      this.clearRefreshCookie(res);
      return { accessToken: null };
    }

    const result = await this.auth.refresh(refreshToken);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Res({ passthrough: true }) res: Response, @Body() body?: any) {
    const refreshToken = this.readRefreshToken(res, body, undefined);
    if (refreshToken) await this.auth.logout(refreshToken);
    this.clearRefreshCookie(res);
    return { message: 'Logged out' };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  async logoutAll(@CurrentUser() user: RequestUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.logoutAll(user.userId);
    this.clearRefreshCookie(res);
    return { message: 'Logged out from all devices' };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email.toLowerCase());
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }

@Get('oauth/start')
async oauthStart(
  @Query('redirectUri') redirectUri?: string,
) {
  return this.auth.oauthStart('google', redirectUri);
}
@Post('oauth/callback')
async oauthCallback(@Body() dto: OAuthCallbackDto,@Res({ passthrough: true }) res: Response,) {
  const result = await this.auth.oauthCallback(
    'google',
    dto.code,
    dto.redirectUri,
  );

  this.setRefreshCookie(res, result.refreshToken);

  return {
    accessToken: result.accessToken,
    user: result.user,
  };
}
}
