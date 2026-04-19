import { test, expect } from '@playwright/test';
import { authHeaders } from './helpers';

/**
 * Media E2E — upload an image, verify it appears in the library,
 * then delete it (CSV mode; no actual file written to disk).
 */
test.describe('Media', () => {
  let mediaId: string;

  test('upload image returns 201 with media record', async ({ request }) => {
    const res = await request.post('/api/v1/media', {
      headers: authHeaders(),
      multipart: {
        file: {
          name: 'e2e-test.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake-jpeg-content'),
        },
      },
    });
    expect(res.status()).toBe(201);
    const body = (await res.json()) as { id: string; filename: string };
    expect(body.id).toBeDefined();
    expect(body.filename).toBe('e2e-test.jpg');
    mediaId = body.id;
  });

  test('media appears in list', async ({ request }) => {
    const res = await request.get('/api/v1/media', { headers: authHeaders() });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data: { id: string }[] };
    expect(body.data.some((m) => m.id === mediaId)).toBe(true);
  });

  test('get media by id', async ({ request }) => {
    const res = await request.get(`/api/v1/media/${mediaId}`, { headers: authHeaders() });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(mediaId);
  });

  test('delete media returns 204', async ({ request }) => {
    const res = await request.delete(`/api/v1/media/${mediaId}`, { headers: authHeaders() });
    expect(res.status()).toBe(204);
  });
});
