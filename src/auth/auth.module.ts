import { Module, Global } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import Redis from 'ioredis';
import { JwtStrategy } from './jwt.strategy';
import { JwksService } from './jwks.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthController } from './auth.controller';
import { VALKEY_CLIENT, KEYCLOAK_ISSUER, KEYCLOAK_JWKS_URI } from './auth.constants';

function buildJwksUri(): string {
  const url = process.env['KEYCLOAK_URL'] ?? 'http://localhost:8080';
  const realm = process.env['KEYCLOAK_REALM'] ?? 'aurora';
  return `${url}/realms/${realm}/protocol/openid-connect/certs`;
}

function buildIssuer(): string {
  const url = process.env['KEYCLOAK_URL'] ?? 'http://localhost:8080';
  const realm = process.env['KEYCLOAK_REALM'] ?? 'aurora';
  return `${url}/realms/${realm}`;
}

@Global()
@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AuthController],
  providers: [
    JwksService,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: KEYCLOAK_ISSUER,
      useFactory: buildIssuer,
    },
    {
      provide: KEYCLOAK_JWKS_URI,
      useFactory: buildJwksUri,
    },
    {
      provide: VALKEY_CLIENT,
      useFactory: (): Redis | undefined => {
        const url = process.env['VALKEY_URL'];
        if (!url) return undefined;
        return new Redis(url);
      },
    },
  ],
  exports: [JwksService, VALKEY_CLIENT],
})
export class AuthModule {}
