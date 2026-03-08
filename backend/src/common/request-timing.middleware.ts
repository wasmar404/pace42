import type { Request, Response, NextFunction } from 'express';

function shouldLog(): boolean {
  return (process.env.LOG_REQUEST_TIMES ?? '1') !== '0';
}

function shouldSkip(pathname: string): boolean {
  // Avoid noise from hot reload / simple checks.
  if (pathname === '/api/health') return true;
  return false;
}

export function requestTimingMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!shouldLog() || shouldSkip(req.originalUrl || req.url)) return next();

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1e6;
    const status = res.statusCode;
    const method = req.method;
    const url = req.originalUrl || req.url;

    // eslint-disable-next-line no-console
    console.log(`[api] ${method} ${url} -> ${status} ${ms.toFixed(1)}ms`);
  });

  next();
}
