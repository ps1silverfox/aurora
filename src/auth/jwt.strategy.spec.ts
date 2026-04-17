import { JwtStrategy } from './jwt.strategy';
import { JwksService } from './jwks.service';
import type { KeycloakJwtPayload } from './types';

const ISSUER = 'http://localhost:8080/realms/aurora';
const JWKS_URI = `${ISSUER}/protocol/openid-connect/certs`;

function makeStrategy(getPublicKey = jest.fn()): JwtStrategy {
  const jwksService = { getPublicKey } as unknown as JwksService;
  return new JwtStrategy(jwksService, ISSUER, JWKS_URI);
}

function makePayload(overrides: Partial<KeycloakJwtPayload> = {}): KeycloakJwtPayload {
  return {
    sub: 'user-uuid-123',
    email: 'alice@example.com',
    name: 'Alice',
    preferred_username: 'alice',
    realm_access: { roles: ['editor'] },
    iss: ISSUER,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

describe('JwtStrategy.validate()', () => {
  it('returns AuthenticatedUser for a valid token payload', () => {
    const strategy = makeStrategy();
    const result = strategy.validate(null, makePayload());
    expect(result).toEqual({
      id: 'user-uuid-123',
      email: 'alice@example.com',
      name: 'Alice',
      roles: ['editor'],
    });
  });

  it('falls back to preferred_username when name is absent', () => {
    const strategy = makeStrategy();
    const result = strategy.validate(null, makePayload({ name: undefined }));
    expect(result).toMatchObject({ name: 'alice' });
  });

  it('falls back to email when name and preferred_username are absent', () => {
    const strategy = makeStrategy();
    const result = strategy.validate(
      null,
      makePayload({ name: undefined, preferred_username: undefined }),
    );
    expect(result).toMatchObject({ name: 'alice@example.com' });
  });

  it('returns empty roles array when realm_access is absent', () => {
    const strategy = makeStrategy();
    const result = strategy.validate(null, makePayload({ realm_access: undefined }));
    expect(result).toMatchObject({ roles: [] });
  });

  it('returns false when issuer does not match (unknown issuer → 401)', () => {
    const strategy = makeStrategy();
    const result = strategy.validate(null, makePayload({ iss: 'https://evil.com/realms/fake' }));
    expect(result).toBe(false);
  });
});

describe('JwksService', () => {
  let service: JwksService;

  beforeEach(() => {
    service = new JwksService(undefined);
  });

  it('caches the resolved key in memory', async () => {
    const resolveKey = jest
      .spyOn(service as unknown as { resolveKey: () => Promise<string> }, 'resolveKey')
      .mockResolvedValue('-----BEGIN PUBLIC KEY-----\nFAKE\n-----END PUBLIC KEY-----');

    const key1 = await service.getPublicKey('kid-abc', JWKS_URI);
    const key2 = await service.getPublicKey('kid-abc', JWKS_URI);

    expect(key1).toBe(key2);
    expect(resolveKey).toHaveBeenCalledTimes(1);
  });

  it('resolves a fresh key after cache expiry', async () => {
    const resolveKey = jest
      .spyOn(service as unknown as { resolveKey: () => Promise<string> }, 'resolveKey')
      .mockResolvedValue('PEM');

    await service.getPublicKey('kid-xyz', JWKS_URI);
    expect(resolveKey).toHaveBeenCalledTimes(1);

    // Expire the cached entry
    const memCache = (service as unknown as { memCache: Map<string, { expiresAt: number }> })
      .memCache;
    const entry = memCache.get('jwks:kid-xyz');
    if (entry) entry.expiresAt = Date.now() - 1;

    await service.getPublicKey('kid-xyz', JWKS_URI);

    // Should have been called a second time since cache expired
    expect(resolveKey).toHaveBeenCalledTimes(2);
  });
});
