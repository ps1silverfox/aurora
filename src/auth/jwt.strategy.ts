import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { decode } from 'jsonwebtoken';
import { JwksService } from './jwks.service';
import { KEYCLOAK_ISSUER, KEYCLOAK_JWKS_URI } from './auth.constants';
import type { AuthenticatedUser, KeycloakJwtPayload } from './types';

type DoneCallback = (err: Error | null, secret?: string) => void;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly jwksService: JwksService,
    @Inject(KEYCLOAK_ISSUER) private readonly expectedIssuer: string,
    @Inject(KEYCLOAK_JWKS_URI) private readonly jwksUri: string,
  ) {
    const options: StrategyOptionsWithRequest = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      passReqToCallback: true,
      secretOrKeyProvider: (_req, rawJwt, done: DoneCallback) => {
        const decoded = decode(String(rawJwt), { complete: true });
        const kid = decoded?.header.kid;
        if (!kid) {
          done(new Error('JWT missing kid header'));
          return;
        }

        jwksService.getPublicKey(kid, jwksUri).then(
          (pem) => { done(null, pem); },
          (err: unknown) => { done(err instanceof Error ? err : new Error(String(err))); },
        );
      },
      // Issuer validation is done manually in validate() so we can return 401 on mismatch
      ignoreExpiration: false,
    };
    super(options);
  }

  validate(
    _req: unknown,
    payload: KeycloakJwtPayload,
  ): AuthenticatedUser | false {
    if (payload.iss !== this.expectedIssuer) return false;

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.preferred_username ?? payload.email,
      roles: payload.realm_access?.roles ?? [],
    };
  }
}
