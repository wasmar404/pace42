import { Module } from '@nestjs/common';

import { IntraAuthController } from './intra-auth.controller';

@Module({
  controllers: [IntraAuthController],
})
export class IntraAuthModule {}
