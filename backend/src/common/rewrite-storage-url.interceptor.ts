import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class RewriteStorageUrlInterceptor implements NestInterceptor {
  private readonly publicOrigin: string | null;

  constructor() {
    const pub = process.env.SUPABASE_PUBLIC_URL;
    if (!pub) {
      this.publicOrigin = null;
      return;
    }
    try {
      const parsed = new URL(pub);
      this.publicOrigin = `${parsed.protocol}//${parsed.host}`;
    } catch {
      this.publicOrigin = null;
    }
  }

  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.publicOrigin) return next.handle();
    return next.handle().pipe(map((data) => this.rewrite(data)));
  }

  private rewrite(value: unknown): unknown {
    if (typeof value === 'string') return this.rewriteUrl(value);
    if (Array.isArray(value)) return value.map((v) => this.rewrite(v));
    if (value !== null && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = this.rewrite(v);
      }
      return out;
    }
    return value;
  }

  private rewriteUrl(url: string): string {
    if (!url.includes('/storage/v1/')) return url;
    try {
      const parsed = new URL(url);
      return this.publicOrigin + parsed.pathname + parsed.search + parsed.hash;
    } catch {
      return url;
    }
  }
}
