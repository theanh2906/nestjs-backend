import {
  Controller,
  Get,
  Inject,
  Query,
  Redirect,
  Req,
  Res,
} from '@nestjs/common';
import { AzureService } from 'src/services/azure.service';

@Controller('/api/azure')
export class AzureController {
  @Inject() private readonly azureService: AzureService;

  @Get('/login')
  @Redirect()
  async login() {
    const url = await this.azureService.getAuthUrl();
    return { url };
  }

  @Get('/callback')
  async callback(@Query('code') code: string) {
    const token = await this.azureService.getToken(code);
    return { token };
  }

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
