import { test, expect } from '@playwright/test';
import { authHeaders } from './helpers';

/**
 * Workflow E2E — full status machine walk:
 * Author creates draft → (submit) → Editor approves → Admin publishes → page is live.
 *
 * In CSV mode all users share admin role via the test bypass header, so the
 * role-based guard approvals are exercised via the same actor (sufficient to
 * verify the transition state machine end-to-end).
 */
test.describe.serial('Workflow', () => {
  let pageId: string;

  test('create draft page', async ({ request }) => {
    const res = await request.post('/api/v1/pages', {
      data: {
        title: 'Workflow E2E Page',
        slug: 'workflow-e2e-page',
        blocks: [{ blockType: 'text', blockOrder: 0, content: { html: '<p>Workflow test</p>' } }],
      },
      headers: authHeaders(),
    });
    expect(res.status()).toBe(201);
    const body = (await res.json()) as { id: string; status: string };
    expect(body.status).toBe('draft');
    pageId = body.id;
  });

  test('submit for review', async ({ request }) => {
    const res = await request.post(`/api/v1/pages/${pageId}/transition`, {
      data: { action: 'submit' },
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('review');
  });

  test('approve', async ({ request }) => {
    const res = await request.post(`/api/v1/pages/${pageId}/transition`, {
      data: { action: 'approve' },
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('approved');
  });

  test('publish — page is live', async ({ request }) => {
    const res = await request.post(`/api/v1/pages/${pageId}/transition`, {
      data: { action: 'publish' },
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('published');
  });

  test('published page is accessible via public SSR route', async ({ request }) => {
    const res = await request.get('/workflow-e2e-page');
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain('Workflow test');
  });

  test('invalid transition returns 422', async ({ request }) => {
    // Page is now published; 'submit' is not a valid transition from 'published'
    const res = await request.post(`/api/v1/pages/${pageId}/transition`, {
      data: { action: 'submit' },
      headers: authHeaders(),
    });
    expect([400, 409, 422]).toContain(res.status());
  });
});
