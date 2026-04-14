import { Controller, Get, Inject, Param } from '@nestjs/common';

/**
 * Controller for accessing application secrets.
 */
@Controller({
  path: '/api/secrets',
})
export class SecretsController {
  @Inject('APP_SECRETS') private readonly appSecrets: { [key: string]: any };

  /**
   * Gets a specific secret by name.
   * @param name The name of the secret to retrieve.
   * @returns The secret value.
   */
  @Get(':name')
  getSecrets(@Param('name') name: string) {
    return this.appSecrets[name];
  }
}
