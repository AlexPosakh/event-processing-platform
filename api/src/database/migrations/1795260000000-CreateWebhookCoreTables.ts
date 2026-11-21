import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWebhookCoreTables1795260000000
  implements MigrationInterface
{
  name = 'CreateWebhookCoreTables1795260000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "endpoints" (
        "id" uuid NOT NULL,
        "name" text NOT NULL,
        "destination_url" text NOT NULL,
        "inbound_token_hash" text NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_endpoints" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_endpoints_inbound_token_hash" UNIQUE ("inbound_token_hash")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "events" (
        "id" uuid NOT NULL,
        "endpoint_id" uuid NOT NULL,
        "event_type" text,
        "payload" jsonb NOT NULL,
        "idempotency_key" text,
        "status" text NOT NULL DEFAULT 'pending',
        "received_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_events_endpoint"
          FOREIGN KEY ("endpoint_id") REFERENCES "endpoints" ("id"),
        CONSTRAINT "CHK_events_status"
          CHECK ("status" IN ('pending', 'delivering', 'retrying', 'delivered', 'failed'))
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_events_endpoint_idempotency_key"
        ON "events" ("endpoint_id", "idempotency_key")
        WHERE "idempotency_key" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_events_endpoint_received_at"
        ON "events" ("endpoint_id", "received_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_events_status_received_at"
        ON "events" ("status", "received_at")
    `);

    await queryRunner.query(`
      CREATE TABLE "delivery_attempts" (
        "id" uuid NOT NULL,
        "event_id" uuid NOT NULL,
        "attempt_number" integer NOT NULL,
        "status" text NOT NULL,
        "status_code" smallint,
        "response_body" text,
        "duration_ms" integer,
        "error" text,
        "started_at" timestamptz NOT NULL DEFAULT now(),
        "finished_at" timestamptz,
        CONSTRAINT "PK_delivery_attempts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_delivery_attempts_event"
          FOREIGN KEY ("event_id") REFERENCES "events" ("id"),
        CONSTRAINT "UQ_delivery_attempts_event_attempt"
          UNIQUE ("event_id", "attempt_number"),
        CONSTRAINT "CHK_delivery_attempts_attempt_number"
          CHECK ("attempt_number" > 0),
        CONSTRAINT "CHK_delivery_attempts_status"
          CHECK ("status" IN ('succeeded', 'failed')),
        CONSTRAINT "CHK_delivery_attempts_status_code"
          CHECK ("status_code" IS NULL OR "status_code" BETWEEN 100 AND 599),
        CONSTRAINT "CHK_delivery_attempts_duration_ms"
          CHECK ("duration_ms" IS NULL OR "duration_ms" >= 0)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "delivery_attempts"');
    await queryRunner.query('DROP TABLE "events"');
    await queryRunner.query('DROP TABLE "endpoints"');
  }
}
