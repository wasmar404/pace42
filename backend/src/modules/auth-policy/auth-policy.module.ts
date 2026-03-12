import { Module } from '@nestjs/common';

import { AuthPolicyController } from './auth-policy.controller';

@Module({
  controllers: [AuthPolicyController],
})
export class AuthPolicyModule {}
