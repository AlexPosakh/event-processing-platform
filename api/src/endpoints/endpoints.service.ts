import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Endpoint } from './endpoint.entity.js';

export interface EndpointSummary {
  id: string;
  name: string;
  destinationUrl: string;
  active: boolean;
  createdAt: Date;
}

export interface CreatedEndpoint extends EndpointSummary {
  inboundPath: string;
}

@Injectable()
export class EndpointsService {
  constructor(
    @InjectRepository(Endpoint)
    private readonly endpointsRepository: Repository<Endpoint>,
  ) {}

  async create(input: unknown): Promise<CreatedEndpoint> {
    const { name, destinationUrl } = this.validateInput(input);
    const inboundToken = randomBytes(32).toString('base64url');
    const inboundTokenHash = createHash('sha256')
      .update(inboundToken)
      .digest('hex');

    const endpoint = this.endpointsRepository.create({
      id: randomUUID(),
      name,
      destinationUrl,
      inboundTokenHash,
      active: true,
    });
    const savedEndpoint = await this.endpointsRepository.save(endpoint);

    return {
      ...this.toSummary(savedEndpoint),
      inboundPath: `/webhooks/${inboundToken}`,
    };
  }

  async findAll(): Promise<EndpointSummary[]> {
    const endpoints = await this.endpointsRepository.find({
      order: { createdAt: 'DESC' },
    });
    return endpoints.map((endpoint) => this.toSummary(endpoint));
  }

  private validateInput(input: unknown): {
    name: string;
    destinationUrl: string;
  } {
    if (!isRecord(input)) {
      throw new BadRequestException('Request body must be an object');
    }

    if (typeof input.name !== 'string' || input.name.trim().length === 0) {
      throw new BadRequestException('name must be a non-empty string');
    }

    const name = input.name.trim();
    if (name.length > 120) {
      throw new BadRequestException('name must be at most 120 characters');
    }

    if (
      typeof input.destinationUrl !== 'string' ||
      input.destinationUrl.trim().length === 0
    ) {
      throw new BadRequestException(
        'destinationUrl must be a non-empty URL string',
      );
    }

    const destinationUrl = input.destinationUrl.trim();
    if (destinationUrl.length > 2048) {
      throw new BadRequestException('destinationUrl is too long');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(destinationUrl);
    } catch {
      throw new BadRequestException('destinationUrl must be an absolute URL');
    }

    if (
      parsedUrl.username.length > 0 ||
      parsedUrl.password.length > 0 ||
      parsedUrl.hash.length > 0
    ) {
      throw new BadRequestException(
        'destinationUrl must not include credentials or a fragment',
      );
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const isLocalHttp =
      parsedUrl.protocol === 'http:' &&
      process.env.NODE_ENV !== 'production' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(
        parsedUrl.hostname.toLowerCase(),
      );

    if (!isHttps && !isLocalHttp) {
      throw new BadRequestException(
        'destinationUrl must use HTTPS; HTTP is allowed only for local development',
      );
    }

    return { name, destinationUrl: parsedUrl.toString() };
  }

  private toSummary(endpoint: Endpoint): EndpointSummary {
    return {
      id: endpoint.id,
      name: endpoint.name,
      destinationUrl: endpoint.destinationUrl,
      active: endpoint.active,
      createdAt: endpoint.createdAt,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
