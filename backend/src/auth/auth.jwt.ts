import {createParamDecorator,ExecutionContext,Injectable,UnauthorizedException} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { AuthGuard } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
// this type defines what is in the jwt token
export type JwtAccessPayload = {
  sub: string;
  email?: string;
  roles: string[];
  sid?: string;
};
export type RequestUser = {
  userId: bigint;
  email?: string;
  roles: string[];
  sessionId?: string;
};
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {

  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),//this tell me how can i extract the jwt token that it will be after the world Bearer
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }
  validate(payload: JwtAccessPayload): RequestUser {
    if (!payload?.sub) throw new UnauthorizedException('Invalid access token');
    return {
      userId: BigInt(payload.sub),
      email: payload.email,
      roles: payload.roles ?? ['user'],
      sessionId: payload.sid,
    };
  }
}
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as RequestUser | undefined;
  },
);
//what i am doing here
// A JWT Strategy (how to read & validate token)
//  An Auth Guard (how to protect routes)
// A Custom Decorator (how to access the logged-in user easily)
//_______________________________________________________________________

//_data the underscore is to tell i know this parameter exists but I'm not using it

// ctx                →  the big universal box (could be HTTP, WS, gRPC)
//   .switchToHttp()  →  open the HTTP-specific box
//   .getRequest()    →  take out the request object from that box

// Example:
// @UseGuards(JwtAuthGuard)
// @Get('me')
// getMe() {}
// When someone hits /me:
// Nest sees @UseGuards(JwtAuthGuard)
// It runs JwtAuthGuard
// JwtAuthGuard internally calls Passport
// Passport:
// Extracts token
// Verifies signature
// Checks expiration
// If valid → calls your validate()
// The returned object becomes request.user
// Controller runsExample:
// @UseGuards(JwtAuthGuard)
// @Get('me')
// getMe() {}
// When someone hits /me:
// Nest sees @UseGuards(JwtAuthGuard)
// It runs JwtAuthGuard
// JwtAuthGuard internally calls Passport
// Passport:
// Extracts token
// Verifies signature
// Checks expiration
// If valid → calls your validate()
// The returned object becomes request.user
// Controller runs