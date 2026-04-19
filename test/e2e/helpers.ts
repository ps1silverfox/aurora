import { APIRequestContext } from '@playwright/test';

export const TEST_USER_ID = 'e2e-test-user-00000001';

export function authHeaders(): Record<string, string> {
  return { 'x-test-user-id': TEST_USER_ID };
}

export function apiPost(
  request: APIRequestContext,
  path: string,
  body: unknown,
): Promise<Response> {
  return request.post(path, {
    data: body,
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
  }) as unknown as Promise<Response>;
}
