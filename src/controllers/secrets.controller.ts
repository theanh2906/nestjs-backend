import { Controller, Get, Inject, Param } from '@nestjs/common';

@Controller({
  path: '/api/secrets',
})
export class SecretsController {
  @Inject('APP_SECRETS') private readonly appSecrets: { [key: string]: any };

  @Get(':name')
  getSecrets(@Param('name') name: string) {
    return this.appSecrets[name];
  }
}
