import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function readApiKey(req: any): string | null {
  const h = req?.headers || {};
  const key = (h['x-api-key'] || h['X-Api-Key'] || h['X-API-KEY']) as string | undefined;
  if (key && String(key).trim()) return String(key).trim();

  const auth = (h['authorization'] || h['Authorization']) as string | undefined;
  if (auth && auth.startsWith('Bearer ')) {
    const t = auth.slice('Bearer '.length).trim();
    if (t) return t;
  }

  return null;
}

@Injectable()
export class PublicApiGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const expected = (this.config.get<string>('PUBLIC_API_KEY') || '').trim();
    if (!expected) throw new ForbiddenException('Public API is disabled');

    const provided = readApiKey(req);
    if (!provided || provided !== expected) throw new ForbiddenException('Invalid API key');
    return true;
  }
}
