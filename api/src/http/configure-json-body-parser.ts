import type { NestExpressApplication } from '@nestjs/platform-express';

export const MAX_JSON_BODY_SIZE_BYTES = 1024 * 1024;

export function configureJsonBodyParser(app: NestExpressApplication): void {
  app.useBodyParser('json', { limit: MAX_JSON_BODY_SIZE_BYTES });
}
