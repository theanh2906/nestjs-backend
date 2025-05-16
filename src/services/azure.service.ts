import { Inject, Injectable } from '@nestjs/common';
import { Client } from '@microsoft/microsoft-graph-client';
import { PublicClientApplication, TokenCache } from '@azure/msal-node';
import { UtilsService } from '../shared/utils.service';

@Injectable()
export class AzureService {
  msalClient: PublicClientApplication;
  private client: Client;
  private codeVerifier: string;

  constructor(
    @Inject('APP_SECRETS') private readonly appSecrets: { [key: string]: any },
    private readonly utils: UtilsService
  ) {
    console.log(this.appSecrets.azureConfig);
    const msalConfig = {
      auth: {
        clientId: this.appSecrets.azureConfig.clientId,
        clientSecret: this.appSecrets.azureConfig.clientSecret,
        authority: `https://login.microsoftonline.com/${this.appSecrets.azureConfig.tenantId}`,
        redirectUri: 'http://localhost:3000/api/azure/callback',
      },
      cache: {
        cachePlugin: null,
      },
    };

    this.msalClient = new PublicClientApplication(msalConfig);
    this.codeVerifier = this.utils.generatePCKECode();
  }

  async getAuthUrl() {
    const codeChallenge = this.utils.generatePCKECodeChallenge(
      this.codeVerifier
    );
    return await this.msalClient.getAuthCodeUrl({
      scopes: ['User.Read', 'Calendars.Read', 'Calendars.ReadWrite'],
      redirectUri: 'http://localhost:3000/api/azure/callback',
      codeChallenge,
      codeChallengeMethod: 'S256',
    });
  }

  async getToken(authCode: string) {
    const tokenResponse = await this.msalClient.acquireTokenByCode({
      code: authCode,
      scopes: ['User.Read', 'Calendars.Read', 'Calendars.ReadWrite'],
      redirectUri: 'http://localhost:3000/api/azure/callback',
      codeVerifier: this.codeVerifier,
    });
    return tokenResponse.accessToken;
  }

  async getEvents(accessToken: string) {
    const client = Client.init({
      authProvider: (done) => done(null, accessToken),
    });

    return client.api('/me/events').get();
  }

  async getSilentToken(account: any): Promise<string> {
    try {
      const result = await this.msalClient.acquireTokenSilent({
        account,
        scopes: ['User.Read', 'Calendars.Read', 'Calendars.ReadWrite'],
      });

      return result.accessToken;
    } catch (error) {
      console.error('Silent token acquisition failed:', error);
      throw error;
    }
  }

  async getAccount(tokenCache: TokenCache): Promise<any> {
    const accounts = await tokenCache.getAllAccounts();
    if (accounts.length > 0) {
      return accounts[0]; // Return the first account for simplicity.
    }
    return null;
  }
}
