"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const compression_1 = __importDefault(require("compression"));
const helmet_1 = __importDefault(require("helmet"));
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const http_exception_filter_1 = require("./common/http-exception.filter");
const request_timing_middleware_1 = require("./common/request-timing.middleware");
function parseCorsOrigins(value) {
    if (!value)
        return [];
    return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}
function isLocalhostOrigin(origin) {
    return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(\:\d+)?$/.test(origin);
}
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.use(request_timing_middleware_1.requestTimingMiddleware);
    app.use((0, compression_1.default)());
    app.use((0, helmet_1.default)());
    app.use((0, cookie_parser_1.default)());
    const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);
    app.enableCors({
        origin: (origin, cb) => {
            // Allow non-browser clients (curl/postman) and same-origin requests.
            if (!origin)
                return cb(null, true);
            // If explicitly configured, only allow those origins.
            if (corsOrigins.length)
                return cb(null, corsOrigins.includes(origin));
            // Dev-friendly default: allow all origins unless explicitly locked down.
            // In production, set CORS_ORIGIN to a strict allow-list.
            if (process.env.NODE_ENV === 'production')
                return cb(null, false);
            return cb(null, true);
        },
        credentials: true,
        optionsSuccessStatus: 204,
    });
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const port = Number(process.env.PORT ?? 3000);
    await app.listen(port);
}
void bootstrap();
//# sourceMappingURL=main.js.map