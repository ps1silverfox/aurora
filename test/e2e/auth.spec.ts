import { test, expect } from '@playwright/test';

/**
 * Auth E2E — verifies the auth redirect flow and unauthenticated rejection.
 * Keycloak is not available in CSV mode so we test boundary behaviour only.
 */
test.describe('Auth', () => {
  test('GET /api/v1/auth/login redirects to Keycloak URL', async ({ request }) => {
    const res = await request.get('/api/v1/auth/login', { maxRedirects: 0 });
    // NestJS @Redirect returns 302; Keycloak URL contains openid-connect/auth
    expect([301, 302]).toContain(res.status());
    const location = res.headers()['location'] ?? '';
    expect(location).toContain('openid-connect/auth');
  });

  test('GET /api/v1/auth/logout redirects to Keycloak logout URL', async ({ request }) => {
    const res = await request.get('/api/v1/auth/logout', { maxRedirects: 0 });
    expect([301, 302]).toContain(res.status());
    const location = res.headers()['location'] ?? '';
    expect(location).toContain('openid-connect/logout');
  });

  test('unauthenticated request to protected endpoint returns 401', async ({ request }) => {
    const res = await request.get('/api/v1/pages');
    expect(res.status()).toBe(401);
  });

  test('authenticated request with test bypass header reaches protected endpoint', async ({
    request,
  }) => {
    const res = await request.get('/api/v1/pages', {
      headers: { 'x-test-user-id': 'e2e-test-user-00000001' },
    });
    // 200 with empty list (CSV mode)
    expect(res.status()).toBe(200);
  });
});
