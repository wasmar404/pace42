"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_1 = require("./prisma");
const me_module_1 = require("./modules/me/me.module");
const users_module_1 = require("./modules/users/users.module");
const activities_module_1 = require("./modules/activities/activities.module");
const notifications_module_1 = require("./modules/notifications/notifications.module");
const chat_module_1 = require("./modules/chat/chat.module");
const auth_policy_module_1 = require("./modules/auth-policy/auth-policy.module");
const home_module_1 = require("./modules/home/home.module");
const clubs_module_1 = require("./modules/clubs/clubs.module");
const public_api_module_1 = require("./modules/public-api/public-api.module");
const health_controller_1 = require("./health.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env.local', '.env'],
            }),
            prisma_1.PrismaModule,
            me_module_1.MeModule,
            users_module_1.UsersModule,
            activities_module_1.ActivitiesModule,
            notifications_module_1.NotificationsModule,
            chat_module_1.ChatModule,
            auth_policy_module_1.AuthPolicyModule,
            home_module_1.HomeModule,
            clubs_module_1.ClubsModule,
            public_api_module_1.PublicApiModule,
        ],
        controllers: [health_controller_1.HealthController],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map