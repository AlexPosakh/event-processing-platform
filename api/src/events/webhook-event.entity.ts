import { CreateDateColumn, Column, Entity, PrimaryColumn } from 'typeorm';

export type EventStatus =
  'pending' | 'delivering' | 'retrying' | 'delivered' | 'failed';

@Entity({ name: 'events' })
export class WebhookEvent {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'endpoint_id', type: 'uuid' })
  endpointId: string;

  @Column({ name: 'event_type', type: 'text', nullable: true })
  eventType: string | null;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ name: 'idempotency_key', type: 'text', nullable: true })
  idempotencyKey: string | null;

  @Column({ type: 'text', default: 'pending' })
  status: EventStatus;

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;
}
