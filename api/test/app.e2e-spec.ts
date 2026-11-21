import { Test, TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import {
  configureJsonBodyParser,
  MAX_JSON_BODY_SIZE_BYTES,
} from '../src/http/configure-json-body-parser.js';

describe('AppController (e2e)', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    configureJsonBodyParser(app);
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('returns not found for an unknown webhook token', () => {
    return request(app.getHttpServer())
      .post(`/webhooks/${'A'.repeat(43)}`)
      .set('Content-Type', 'application/json')
      .send({ action: 'push' })
      .expect(404);
  });

  it('accepts a 1 MiB body and rejects a body one byte larger', async () => {
    const token = 'A'.repeat(43);
    const prefix = '{"data":"';
    const suffix = '"}';
    const contentAtLimit = Buffer.from(
      `${prefix}${'x'.repeat(MAX_JSON_BODY_SIZE_BYTES - prefix.length - suffix.length)}${suffix}`,
    );
    expect(contentAtLimit.byteLength).toBe(MAX_JSON_BODY_SIZE_BYTES);

    await request(app.getHttpServer())
      .post(`/webhooks/${token}`)
      .set('Content-Type', 'application/json')
      .send(contentAtLimit.toString('utf8'))
      .expect(404);

    return request(app.getHttpServer())
      .post(`/webhooks/${token}`)
      .set('Content-Type', 'application/json')
      .send(Buffer.concat([contentAtLimit, Buffer.from(' ')]).toString('utf8'))
      .expect(413);
  });

  afterEach(async () => {
    await app.close();
  });
});
