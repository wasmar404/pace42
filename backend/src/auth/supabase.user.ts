import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { SupabaseRequestUser } from './supabase.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SupabaseRequestUser | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as SupabaseRequestUser | undefined;
  },
);
