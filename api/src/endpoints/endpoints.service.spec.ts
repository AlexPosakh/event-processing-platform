import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Endpoint } from './endpoint.entity.js';
import { EndpointsService } from './endpoints.service.js';

describe('EndpointsService', () => {
  let endpointsService: EndpointsService;
  let endpointsRepository: ReturnType<typeof createRepositoryMock>;

  beforeEach(async () => {
    endpointsRepository = createRepositoryMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EndpointsService,
        {
          provide: getRepositoryToken(Endpoint),
          useValue: endpointsRepository,
        },
      ],
    }).compile();

    endpointsService = module.get(EndpointsService);
  });

  it('creates an endpoint with a one-time ingress token and stores only its hash', async () => {
    const endpoint = await endpointsService.create({
      name: ' Orders ',
      destinationUrl: 'https://customer.example/webhooks',
    });
    const storedEndpoint = endpointsRepository.save.mock.calls[0][0];
    const token = endpoint.inboundPath.split('/').at(-1);

    if (!token) {
      throw new Error('Expected the endpoint path to contain its token');
    }

    expect(endpoint.name).toBe('Orders');
    expect(endpoint.destinationUrl).toBe('https://customer.example/webhooks');
    expect(storedEndpoint.inboundTokenHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(endpoint).not.toHaveProperty('inboundTokenHash');
  });

  it('lists endpoint summaries without exposing the inbound token hash', async () => {
    endpointsRepository.find.mockResolvedValue([
      {
        id: 'a0d43147-1940-4b79-8437-8796ea1cc8b0',
        name: 'Orders',
        destinationUrl: 'https://customer.example/webhooks',
        inboundTokenHash: 'secret-hash',
        active: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    const endpoints = await endpointsService.findAll();

    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]).not.toHaveProperty('inboundTokenHash');
    expect(endpointsRepository.find).toHaveBeenCalledWith({
      order: { createdAt: 'DESC' },
    });
  });

  it('looks up active endpoints using the inbound token hash', async () => {
    const token = 'A'.repeat(43);
    const endpoint = {
      id: 'a0d43147-1940-4b79-8437-8796ea1cc8b0',
      name: 'Orders',
      destinationUrl: 'https://customer.example/webhooks',
      inboundTokenHash: createHash('sha256').update(token).digest('hex'),
      active: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    endpointsRepository.findOneBy.mockResolvedValue(endpoint);

    await expect(
      endpointsService.findActiveByInboundToken(token),
    ).resolves.toEqual(endpoint);
    expect(endpointsRepository.findOneBy).toHaveBeenCalledWith({
      inboundTokenHash: endpoint.inboundTokenHash,
      active: true,
    });
  });

  it('rejects invalid and non-local insecure destination URLs', async () => {
    await expect(
      endpointsService.create({
        name: 'Orders',
        destinationUrl: 'not-a-url',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      endpointsService.create({
        name: 'Orders',
        destinationUrl: 'http://customer.example/webhooks',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows HTTP destinations on localhost during development', async () => {
    const endpoint = await endpointsService.create({
      name: 'Local',
      destinationUrl: 'http://localhost:4000/webhooks',
    });

    expect(endpoint.destinationUrl).toBe('http://localhost:4000/webhooks');
  });
});

function createRepositoryMock() {
  return {
    create: vi.fn((endpoint: Partial<Endpoint>) => endpoint),
    save: vi.fn(async (endpoint: Partial<Endpoint>): Promise<Endpoint> => ({
      id: endpoint.id ?? '',
      name: endpoint.name ?? '',
      destinationUrl: endpoint.destinationUrl ?? '',
      inboundTokenHash: endpoint.inboundTokenHash ?? '',
      active: endpoint.active ?? true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    })),
    find: vi.fn(async (): Promise<Endpoint[]> => []),
    findOneBy: vi.fn(async (): Promise<Endpoint | null> => null),
  };
}
