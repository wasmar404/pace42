import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { SupabaseRequestUser } from './supabase.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => { //_data: unknown means I am going to ignore any incoming parameter passed to this decorator, and ctx: ExecutionContext gives me access to the request.
    const request = ctx.switchToHttp().getRequest();//switch to http  and get the request object
    return request.user as SupabaseRequestUser | undefined;
  },
);