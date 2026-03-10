import 'reflect-metadata';

import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { requestTimingMiddleware } from './common/request-timing.middleware';

function parseCorsOrigins(value: string | undefined): string[] {
  if (!value) return [];

  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isLocalhostOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(\:\d+)?$/.test(origin);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(requestTimingMiddleware);
  app.use(compression());
  app.use(helmet());
  app.use(cookieParser());

  const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);

  app.enableCors({
    origin: (origin, cb) => {
      // Allow non-browser clients (curl/postman) and same-origin requests.
      if (!origin) return cb(null, true);

      // If explicitly configured, only allow those origins.
      if (corsOrigins.length) return cb(null, corsOrigins.includes(origin));

      // Dev-friendly default: allow all origins unless explicitly locked down.
      // In production, set CORS_ORIGIN to a strict allow-list.
      if (process.env.NODE_ENV === 'production') return cb(null, false);
      return cb(null, true);
    },
    credentials: true,
    optionsSuccessStatus: 204,
  });

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
