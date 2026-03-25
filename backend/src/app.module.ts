import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './prisma';
import { MeModule } from './modules/me/me.module';
import { UsersModule } from './modules/users/users.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ChatModule } from './modules/chat/chat.module';
import { AuthPolicyModule } from './modules/auth-policy/auth-policy.module';
import { HomeModule } from './modules/home/home.module';
import { ClubsModule } from './modules/clubs/clubs.module';
import { PublicApiModule } from './modules/public-api/public-api.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    PrismaModule,
    MeModule,
    UsersModule,
    ActivitiesModule,
    NotificationsModule,
    ChatModule,
    AuthPolicyModule,
    HomeModule,
    ClubsModule,
    PublicApiModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
