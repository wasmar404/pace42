import 'reflect-metadata';

import compression from 'compression';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function main() {
  const app = await NestFactory.create(AppModule);

  app.use(compression()); 

  const rawOrigins = String(process.env.CORS_ORIGIN ?? '').trim();
  const origins = rawOrigins
    ? rawOrigins
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  app.enableCors({
    origin: origins && origins.length ? origins : rawOrigins || true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Access-Control-Allow-Private-Network'],
    exposedHeaders: ['Access-Control-Allow-Private-Network'],
  });

  // Allow Chrome's Private Network Access preflight requests
  app.use((_req: any, res: any, next: any) => {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    next();
  });

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

void main();
