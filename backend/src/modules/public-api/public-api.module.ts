import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma';
import { PublicApiController } from './public-api.controller';
import { PublicApiGuard } from './public-api.guard';

@Module({
  imports: [PrismaModule],
  controllers: [PublicApiController],
  providers: [PublicApiGuard],
})
export class PublicApiModule {}
