import { Controller, Get, Query, Redirect } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from './public.decorator';

@Controller('api/v1/auth')
@Throttle({ auth: { ttl: 60000, limit: 10 } })
export class AuthController {
  private get keycloakBase(): string {
    const url = process.env['KEYCLOAK_URL'] ?? 'http://localhost:8080';
    const realm = process.env['KEYCLOAK_REALM'] ?? 'aurora';
    return `${url}/realms/${realm}/protocol/openid-connect`;
  }

  private get appUrl(): string {
    return process.env['APP_URL'] ?? 'http://localhost:3000';
  }

  private get clientId(): string {
    return process.env['KEYCLOAK_CLIENT_ID'] ?? 'aurora-cms';
  }

  @Get('login')
  @Public()
  @Redirect()
  login(): { url: string } {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: `${this.appUrl}/api/v1/auth/callback`,
      response_type: 'code',
      scope: 'openid email profile',
    });
    return { url: `${this.keycloakBase}/auth?${params.toString()}` };
  }

  @Get('callback')
  @Public()
  @Redirect()
  callback(@Query('code') code: string | undefined): { url: string } {
    const target = code
      ? `${this.appUrl}/auth/callback?${new URLSearchParams({ code }).toString()}`
      : this.appUrl;
    return { url: target };
  }

  @Get('logout')
  @Public()
  @Redirect()
  logout(): { url: string } {
    const params = new URLSearchParams({
      client_id: this.clientId,
      post_logout_redirect_uri: this.appUrl,
    });
    return { url: `${this.keycloakBase}/logout?${params.toString()}` };
  }
}
