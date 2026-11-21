import { CreateDateColumn, Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'endpoints' })
export class Endpoint {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'destination_url', type: 'text' })
  destinationUrl: string;

  @Column({ name: 'inbound_token_hash', type: 'text', unique: true })
  inboundTokenHash: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
