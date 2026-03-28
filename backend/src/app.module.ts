import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';

import { PrismaModule } from './prisma';
import { MeModule } from './modules/me/me.module';
import { UsersModule } from './modules/users/users.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { ChatModule } from './modules/chat/chat.module';
import { AuthPolicyModule } from './modules/auth-policy/auth-policy.module';
import { HomeModule } from './modules/home/home.module';
import { PublicApiModule } from './modules/public-api/public-api.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [resolve(process.cwd(), '..', '.env')],
    }),

    PrismaModule,
    MeModule,
    UsersModule,
    ActivitiesModule,
    ChatModule,
    AuthPolicyModule,
    HomeModule,
    PublicApiModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
