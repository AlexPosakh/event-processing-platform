import {
  BadRequestException,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Endpoint } from '../endpoints/endpoint.entity.js';
import { EndpointsService } from '../endpoints/endpoints.service.js';
import { WebhookEvent } from '../events/webhook-event.entity.js';
import { WebhooksService } from './webhooks.service.js';

describe('WebhooksService', () => {
  let webhooksService: WebhooksService;
  let eventsRepository: ReturnType<typeof createEventsRepositoryMock>;
  let endpointsService: { findActiveByInboundToken: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    eventsRepository = createEventsRepositoryMock();
    endpointsService = {
      findActiveByInboundToken: vi.fn(async () => createEndpoint()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: getRepositoryToken(WebhookEvent),
          useValue: eventsRepository,
        },
        {
          provide: EndpointsService,
          useValue: endpointsService,
        },
      ],
    }).compile();

    webhooksService = module.get(WebhooksService);
  });

  it('persists a valid event and returns its platform ID', async () => {
    const payload = { orderId: 'order-123' };
    const acknowledgement = await webhooksService.receive({
      token: 'A'.repeat(43),
      contentType: 'application/json; charset=utf-8',
      eventType: 'order.created',
      idempotencyKey: 'provider-event-123',
      payload,
    });
    const savedEvent = eventsRepository.save.mock.calls[0][0];

    expect(acknowledgement.eventId).toBe(savedEvent.id);
    expect(savedEvent).toMatchObject({
      endpointId: 'a0d43147-1940-4b79-8437-8796ea1cc8b0',
      eventType: 'order.created',
      idempotencyKey: 'provider-event-123',
      payload,
      status: 'pending',
    });
  });

  it('rejects invalid tokens and does not store their events', async () => {
    endpointsService.findActiveByInboundToken.mockResolvedValue(null);

    await expect(
      webhooksService.receive({
        token: 'A'.repeat(43),
        contentType: 'application/json',
        eventType: undefined,
        idempotencyKey: undefined,
        payload: { action: 'push' },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(eventsRepository.save).not.toHaveBeenCalled();
  });

  it('requires an application/json object payload', async () => {
    await expect(
      webhooksService.receive({
        token: 'A'.repeat(43),
        contentType: 'text/plain',
        eventType: undefined,
        idempotencyKey: undefined,
        payload: { action: 'push' },
      }),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);

    await expect(
      webhooksService.receive({
        token: 'A'.repeat(43),
        contentType: 'application/json',
        eventType: undefined,
        idempotencyKey: undefined,
        payload: ['not', 'an', 'object'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns the existing event for a repeated idempotency key', async () => {
    eventsRepository.findOneBy.mockResolvedValue(
      createEvent({ id: 'e0be7f3b-2b7c-4c33-9fe5-d2d033171f11' }),
    );

    const acknowledgement = await webhooksService.receive({
      token: 'A'.repeat(43),
      contentType: 'application/json',
      eventType: undefined,
      idempotencyKey: 'provider-event-123',
      payload: { orderId: 'order-123' },
    });

    expect(acknowledgement.eventId).toBe(
      'e0be7f3b-2b7c-4c33-9fe5-d2d033171f11',
    );
    expect(eventsRepository.save).not.toHaveBeenCalled();
  });
});

function createEndpoint(): Endpoint {
  return {
    id: 'a0d43147-1940-4b79-8437-8796ea1cc8b0',
    name: 'Orders',
    destinationUrl: 'https://customer.example/webhooks',
    inboundTokenHash: 'token-hash',
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function createEvent(overrides: Partial<WebhookEvent> = {}): WebhookEvent {
  return {
    id: overrides.id ?? 'bdd83ca2-f905-41ac-9893-cb34be73eef5',
    endpointId: overrides.endpointId ?? 'a0d43147-1940-4b79-8437-8796ea1cc8b0',
    eventType: overrides.eventType ?? null,
    payload: overrides.payload ?? {},
    idempotencyKey: overrides.idempotencyKey ?? 'provider-event-123',
    status: overrides.status ?? 'pending',
    receivedAt: overrides.receivedAt ?? new Date('2026-01-01T00:00:00.000Z'),
  };
}

function createEventsRepositoryMock() {
  return {
    create: vi.fn((event: Partial<WebhookEvent>) => event),
    findOneBy: vi.fn(async (): Promise<WebhookEvent | null> => null),
    save: vi.fn(async (event: Partial<WebhookEvent>): Promise<WebhookEvent> =>
      createEvent(event),
    ),
  };
}
