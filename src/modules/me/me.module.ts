import { Module } from '@nestjs/common';

import { MeController } from './me.controller';

@Module({
  // Contains onboarding endpoints under /api/me
  controllers: [MeController],
})
export class MeModule {}
