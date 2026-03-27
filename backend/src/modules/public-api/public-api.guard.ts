import { CanActivate, ExecutionContext, ForbiddenException, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type Bucket = {
  resetAt: number;
  count: number;
};

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

function readIp(req: any): string {
  const h = req?.headers || {};
  const xf = (h['x-forwarded-for'] || h['X-Forwarded-For']) as string | undefined;
  if (xf) return String(xf).split(',')[0].trim();
  return String(req?.ip || req?.connection?.remoteAddress || 'unknown');
}

@Injectable()
export class PublicApiGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly config: ConfigService) {}

  private hit(key: string, limit: number, windowMs: number, now: number) {
    const cur = this.buckets.get(key);
    if (!cur || now >= cur.resetAt) {
      const next: Bucket = { resetAt: now + windowMs, count: 1 };
      this.buckets.set(key, next);
      return { ok: true, remaining: limit - 1, resetAt: next.resetAt };
    }

    if (cur.count >= limit) return { ok: false, remaining: 0, resetAt: cur.resetAt };
    cur.count += 1;
    return { ok: true, remaining: limit - cur.count, resetAt: cur.resetAt };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const expected = (this.config.get<string>('PUBLIC_API_KEY') || '').trim();
    if (!expected) throw new ForbiddenException('Public API is disabled');

    const provided = readApiKey(req);
    if (!provided || provided !== expected) throw new ForbiddenException('Invalid API key');

    // Simple in-memory rate limit (school-project level): per API key + IP.
    const LIMIT = 120;
    const WINDOW_MS = 60_000;
    const ip = readIp(req);
    const bucketKey = `${provided}:${ip}`;
    const now = Date.now();
    const hit = this.hit(bucketKey, LIMIT, WINDOW_MS, now);

    try {
      res?.setHeader?.('X-RateLimit-Limit', String(LIMIT));
      res?.setHeader?.('X-RateLimit-Remaining', String(hit.remaining));
      res?.setHeader?.('X-RateLimit-Reset', String(Math.ceil(hit.resetAt / 1000)));
    } catch {
      // ignore
    }

    if (!hit.ok) throw new HttpException('Rate limit exceeded', 429);
    return true;
  }
}
