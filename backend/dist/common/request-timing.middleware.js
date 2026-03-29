"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestTimingMiddleware = requestTimingMiddleware;
function shouldLog() {
    return (process.env.LOG_REQUEST_TIMES ?? '1') !== '0';
}
function shouldSkip(pathname) {
    // Avoid noise from hot reload / simple checks.
    if (pathname === '/api/health')
        return true;
    return false;
}
function requestTimingMiddleware(req, res, next) {
    if (!shouldLog() || shouldSkip(req.originalUrl || req.url))
        return next();
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
//# sourceMappingURL=request-timing.middleware.js.map