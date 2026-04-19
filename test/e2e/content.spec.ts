import { test, expect } from '@playwright/test';
import { authHeaders } from './helpers';

/**
 * Content E2E — create a page with text+image blocks, publish it,
 * verify the SSR output contains block content (CSV mode).
 */
test.describe('Content lifecycle', () => {
  let pageId: string;

  test('create page with text and image blocks', async ({ request }) => {
    const res = await request.post('/api/v1/pages', {
      data: {
        title: 'E2E Test Page',
        slug: 'e2e-test-page',
        blocks: [
          { block_type: 'text', block_order: 0, content: { html: '<p>Hello world</p>' } },
          {
            block_type: 'image',
            block_order: 1,
            content: { src: '/media/test.jpg', alt: 'test image' },
          },
        ],
      },
      headers: authHeaders(),
    });
    expect(res.status()).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBeDefined();
    pageId = body.id;
  });

  test('page appears in list', async ({ request }) => {
    const res = await request.get('/api/v1/pages', { headers: authHeaders() });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data: { id: string }[] };
    expect(body.data.some((p) => p.id === pageId)).toBe(true);
  });

  test('retrieve page by id', async ({ request }) => {
    const res = await request.get(`/api/v1/pages/${pageId}`, { headers: authHeaders() });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { id: string; title: string };
    expect(body.id).toBe(pageId);
    expect(body.title).toBe('E2E Test Page');
  });

  test('workflow: submit, approve, publish', async ({ request }) => {
    const submit = await request.post(`/api/v1/pages/${pageId}/transition`, {
      data: { action: 'submit' },
      headers: authHeaders(),
    });
    expect(submit.status()).toBe(200);

    const approve = await request.post(`/api/v1/pages/${pageId}/transition`, {
      data: { action: 'approve' },
      headers: authHeaders(),
    });
    expect(approve.status()).toBe(200);

    const publish = await request.post(`/api/v1/pages/${pageId}/transition`, {
      data: { action: 'publish' },
      headers: authHeaders(),
    });
    expect(publish.status()).toBe(200);
  });

  test('published page renders SSR HTML with block content', async ({ request }) => {
    const res = await request.get('/e2e-test-page');
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain('Hello world');
    expect(html).toContain('E2E Test Page');
  });
});
