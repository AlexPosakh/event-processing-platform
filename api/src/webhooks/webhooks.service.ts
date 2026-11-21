import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { EndpointsService } from '../endpoints/endpoints.service.js';
import { WebhookEvent } from '../events/webhook-event.entity.js';

const IDEMPOTENCY_CONSTRAINT = 'UQ_events_endpoint_idempotency_key';

export interface ReceiveWebhookInput {
  token: string;
  contentType: string | undefined;
  eventType: string | undefined;
  idempotencyKey: string | undefined;
  payload: unknown;
}

export interface WebhookAcknowledgement {
  eventId: string;
}

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(WebhookEvent)
    private readonly eventsRepository: Repository<WebhookEvent>,
    private readonly endpointsService: EndpointsService,
  ) {}

  async receive(input: ReceiveWebhookInput): Promise<WebhookAcknowledgement> {
    if (!isJsonContentType(input.contentType)) {
      throw new UnsupportedMediaTypeException(
        'Content-Type must be application/json',
      );
    }

    if (!isJsonObject(input.payload)) {
      throw new BadRequestException('Webhook payload must be a JSON object');
    }

    const endpoint = await this.endpointsService.findActiveByInboundToken(
      input.token,
    );
    if (!endpoint) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    const eventType = normalizeHeaderValue(input.eventType, 'X-Event-Type');
    const idempotencyKey = normalizeHeaderValue(
      input.idempotencyKey,
      'Idempotency-Key',
    );

    if (idempotencyKey) {
      const existingEvent = await this.eventsRepository.findOneBy({
        endpointId: endpoint.id,
        idempotencyKey,
      });
      if (existingEvent) {
        return { eventId: existingEvent.id };
      }
    }

    const event = this.eventsRepository.create({
      id: randomUUID(),
      endpointId: endpoint.id,
      eventType,
      payload: input.payload,
      idempotencyKey,
      status: 'pending',
    });

    try {
      const savedEvent = await this.eventsRepository.save(event);
      return { eventId: savedEvent.id };
    } catch (error) {
      if (!idempotencyKey || !isIdempotencyKeyConflict(error)) {
        throw error;
      }

      const existingEvent = await this.eventsRepository.findOneBy({
        endpointId: endpoint.id,
        idempotencyKey,
      });
      if (!existingEvent) {
        throw error;
      }

      return { eventId: existingEvent.id };
    }
  }
}

function isJsonContentType(contentType: string | undefined): boolean {
  return (
    contentType?.split(';', 1)[0].trim().toLowerCase() === 'application/json'
  );
}

function isJsonObject(payload: unknown): payload is Record<string, unknown> {
  return (
    typeof payload === 'object' && payload !== null && !Array.isArray(payload)
  );
}

function normalizeHeaderValue(
  value: string | undefined,
  headerName: string,
): string | null {
  if (value === undefined) {
    return null;
  }

  const normalizedValue = value.trim();
  if (normalizedValue.length === 0 || normalizedValue.length > 255) {
    throw new BadRequestException(
      `${headerName} must contain between 1 and 255 characters`,
    );
  }

  return normalizedValue;
}

function isIdempotencyKeyConflict(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError;
  return (
    isRecord(driverError) &&
    driverError.code === '23505' &&
    driverError.constraint === IDEMPOTENCY_CONSTRAINT
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
