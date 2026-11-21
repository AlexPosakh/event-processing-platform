import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule, ObserveInstrument } from './app.module.js';
import { configureJsonBodyParser } from './http/configure-json-body-parser.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    instrument: ObserveInstrument,
  });
  configureJsonBodyParser(app);
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
