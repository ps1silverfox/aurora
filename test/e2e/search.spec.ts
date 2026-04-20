import { test, expect } from '@playwright/test';
import { authHeaders } from './helpers';

/**
 * Search E2E — publish a page, then verify the search endpoint
 * returns a valid response shape (CSV mode uses fixture data).
 */
test.describe('Search', () => {
  test('search endpoint returns 400 without q param', async ({ request }) => {
    const res = await request.get('/api/v1/search', { headers: authHeaders() });
    expect(res.status()).toBe(400);
  });

  test('search endpoint returns 200 with q param', async ({ request }) => {
    const res = await request.get('/api/v1/search?q=test', { headers: authHeaders() });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data: unknown[]; nextCursor: string | null };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body).toHaveProperty('nextCursor');
  });

  test('search endpoint supports status filter', async ({ request }) => {
    const res = await request.get('/api/v1/search?q=test&status=published', {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
  });

  test('search query shorter than 2 chars returns 400', async ({ request }) => {
    const res = await request.get('/api/v1/search?q=x', { headers: authHeaders() });
    expect(res.status()).toBe(400);
  });
});
