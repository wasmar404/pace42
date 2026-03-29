"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentUser = exports.JwtAuthGuard = exports.JwtStrategy = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const passport_1 = require("@nestjs/passport");
const passport_2 = require("@nestjs/passport");
const passport_jwt_1 = require("passport-jwt");
let JwtStrategy = class JwtStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy) {
    constructor(config) {
        super({
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(), //this tell me how can i extract the jwt token that it will be after the world Bearer
            ignoreExpiration: false,
            secretOrKey: config.getOrThrow('JWT_ACCESS_SECRET'),
        });
    }
    validate(payload) {
        if (!payload?.sub)
            throw new common_1.UnauthorizedException('Invalid access token');
        return {
            userId: BigInt(payload.sub),
            email: payload.email,
            roles: payload.roles ?? ['user'],
            sessionId: payload.sid,
        };
    }
};
exports.JwtStrategy = JwtStrategy;
exports.JwtStrategy = JwtStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], JwtStrategy);
let JwtAuthGuard = class JwtAuthGuard extends (0, passport_2.AuthGuard)('jwt') {
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)()
], JwtAuthGuard);
exports.CurrentUser = (0, common_1.createParamDecorator)((_data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
});
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
//# sourceMappingURL=auth.jwt.js.map