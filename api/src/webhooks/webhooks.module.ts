import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EndpointsModule } from '../endpoints/endpoints.module.js';
import { WebhookEvent } from '../events/webhook-event.entity.js';
import { WebhooksController } from './webhooks.controller.js';
import { WebhooksService } from './webhooks.service.js';

@Module({
  imports: [EndpointsModule, TypeOrmModule.forFeature([WebhookEvent])],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
