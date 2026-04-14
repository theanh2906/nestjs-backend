import {
  Controller,
  Get,
  Inject,
  Query,
  Redirect,
  Req,
  Res,
} from '@nestjs/common';
import { AzureService } from '../services';

/**
 * Controller for handling Azure authentication.
 */
@Controller('/api/azure')
export class AzureController {
  @Inject() private readonly azureService: AzureService;

  /**
   * Redirects the user to the Azure login page.
   * @returns A redirect URL.
   */
  @Get('/login')
  @Redirect()
  async login() {
    const url = await this.azureService.getAuthUrl();
    return { url };
  }

  /**
   * Handles the callback from Azure after authentication.
   * @param code The authorization code from Azure.
   * @returns The access token.
   */
  @Get('/callback')
  async callback(@Query('code') code: string) {
    const token = await this.azureService.getToken(code);
    return { token };
  }

  /**
   * Attempts to silently log in the user.
   * @param _req The request object.
   * @param res The response object.
   * @returns The access token if successful, otherwise an error message.
   */
  @Get('silent-login')
  async silentLogin(@Req() _req, @Res() res) {
    try {
      const tokenCache = this.azureService.msalClient.getTokenCache();
      const account = await this.azureService.getAccount(tokenCache);
      console.log(account);

      if (!account) {
        return res
          .status(401)
          .json({ message: 'No account found, login required' });
      }

      const accessToken = await this.azureService.getSilentToken(account);
      return res.status(200).json({ accessToken });
    } catch (error) {
      return res
        .status(401)
        .json({ message: 'Silent login failed', error: error.message });
    }
  }
}
