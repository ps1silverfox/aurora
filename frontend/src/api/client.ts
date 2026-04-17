const BASE_URL = (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? '/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
    public readonly title?: string,
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}

// TODO: Replace with your preferred token strategy:
//   • Module var (current): simple, no persistence across refresh
//   • sessionStorage: persists through refresh, XSS-exposed
//   • Injected callback: cleanest DI, needs wiring at app init
let _authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  _authToken = token;
}

function getAuthToken(): string | null {
  return _authToken;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token !== null) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string;
      title?: string;
    };
    throw new ApiError(res.status, body.detail ?? res.statusText, body.title);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
