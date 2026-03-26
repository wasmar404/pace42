import 'reflect-metadata';

import compression from 'compression';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function main() {
  const app = await NestFactory.create(AppModule);

  app.use(compression()); //compress HTTP responses before sending them to the client

  app.enableCors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  });

  app.setGlobalPrefix('api'); // this just to add /api
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