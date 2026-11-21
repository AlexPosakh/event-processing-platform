import { Body, Controller, Get, Post } from '@nestjs/common';
import { EndpointsService } from './endpoints.service.js';

@Controller('endpoints')
export class EndpointsController {
  constructor(private readonly endpointsService: EndpointsService) {}

  @Post()
  create(@Body() body: unknown) {
    return this.endpointsService.create(body);
  }

  @Get()
  findAll() {
    return this.endpointsService.findAll();
  }
}
