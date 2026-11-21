import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service.js';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post(':token')
  @HttpCode(HttpStatus.ACCEPTED)
  receive(
    @Param('token') token: string,
    @Headers('content-type') contentType: string | undefined,
    @Headers('x-event-type') eventType: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() payload: unknown,
  ) {
    return this.webhooksService.receive({
      token,
      contentType,
      eventType,
      idempotencyKey,
      payload,
    });
  }
}
