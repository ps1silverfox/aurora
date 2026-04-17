import { Injectable, Inject, Optional } from '@nestjs/common';
import JwksRsa from 'jwks-rsa';
import type Redis from 'ioredis';
import { VALKEY_CLIENT } from './auth.constants';

const JWKS_TTL_SECONDS = 300;

interface CacheEntry {
  pem: string;
  expiresAt: number;
}

@Injectable()
export class JwksService {
  private readonly clients = new Map<string, JwksRsa.JwksClient>();
  private readonly memCache = new Map<string, CacheEntry>();

  constructor(
    @Optional() @Inject(VALKEY_CLIENT) private readonly redis: Redis | undefined,
  ) {}

  async getPublicKey(kid: string, jwksUri: string): Promise<string> {
    const cacheKey = `jwks:${kid}`;

    if (this.redis) {
      const cached = await this.redis.get(cacheKey);
      if (cached) return cached;
    } else {
      const entry = this.memCache.get(cacheKey);
      if (entry && entry.expiresAt > Date.now()) return entry.pem;
    }

    const pem = await this.resolveKey(kid, jwksUri);

    if (this.redis) {
      await this.redis.setex(cacheKey, JWKS_TTL_SECONDS, pem);
    } else {
      this.memCache.set(cacheKey, { pem, expiresAt: Date.now() + JWKS_TTL_SECONDS * 1000 });
    }

    return pem;
  }

  private async resolveKey(kid: string, jwksUri: string): Promise<string> {
    let client = this.clients.get(jwksUri);
    if (!client) {
      client = JwksRsa({ jwksUri, cache: false, rateLimit: true });
      this.clients.set(jwksUri, client);
    }
    const signingKey = await client.getSigningKey(kid);
    return signingKey.getPublicKey();
  }
}
