import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { CrossFilterProvider, useCrossFilter } from './CrossFilterContext';
import { useDataBlock } from './useDataBlock';

// ─── CrossFilterContext ───────────────────────────────────────────────────────

describe('CrossFilterContext', () => {
  function wrapper({ children }: { children: React.ReactNode }) {
    return <CrossFilterProvider>{children}</CrossFilterProvider>;
  }

  it('initialises with empty filters', () => {
    const { result } = renderHook(() => useCrossFilter(), { wrapper });
    expect(result.current.filters).toEqual({});
  });

  it('setFilter adds a key', () => {
    const { result } = renderHook(() => useCrossFilter(), { wrapper });
    act(() => result.current.setFilter('category', 'sports'));
    expect(result.current.filters).toEqual({ category: 'sports' });
  });

  it('setFilter updates an existing key', () => {
    const { result } = renderHook(() => useCrossFilter(), { wrapper });
    act(() => result.current.setFilter('category', 'sports'));
    act(() => result.current.setFilter('category', 'news'));
    expect(result.current.filters['category']).toBe('news');
  });

  it('clearFilter removes a specific key', () => {
    const { result } = renderHook(() => useCrossFilter(), { wrapper });
    act(() => {
      result.current.setFilter('category', 'sports');
      result.current.setFilter('region', 'EU');
    });
    act(() => result.current.clearFilter('category'));
    expect(result.current.filters).toEqual({ region: 'EU' });
  });

  it('clearAll removes all filters', () => {
    const { result } = renderHook(() => useCrossFilter(), { wrapper });
    act(() => {
      result.current.setFilter('category', 'sports');
      result.current.setFilter('region', 'EU');
    });
    act(() => result.current.clearAll());
    expect(result.current.filters).toEqual({});
  });

  it('is safe to use outside a Provider (no-op default)', () => {
    const { result } = renderHook(() => useCrossFilter());
    expect(() => result.current.setFilter('x', 1)).not.toThrow();
    expect(result.current.filters).toEqual({});
  });
});

// ─── useDataBlock ─────────────────────────────────────────────────────────────

const MOCK_ROWS = [
  { category: 'sports', views: 100 },
  { category: 'news', views: 200 },
];

function makeWrapper(filters?: Record<string, unknown>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <CrossFilterProvider>{children}</CrossFilterProvider>;
  };
}

describe('useDataBlock', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: MOCK_ROWS }),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('fetches data on mount', async () => {
    const { result } = renderHook(
      () => useDataBlock({ sourceId: 'ds1', query: { sql: 'SELECT 1' } }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual(MOCK_ROWS);
    expect(result.current.error).toBeNull();
    expect(result.current.lastUpdated).toBeInstanceOf(Date);
  });

  it('sets error when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Server error'),
      }),
    );

    const { result } = renderHook(
      () => useDataBlock({ sourceId: 'ds1', query: { sql: 'SELECT 1' } }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Server error');
    expect(result.current.data).toEqual([]);
  });

  it('applies cross-filters to returned rows', async () => {
    function useTest() {
      const ctx = useCrossFilter();
      const block = useDataBlock({ sourceId: 'ds1', query: { sql: 'SELECT 1' } });
      return { ctx, block };
    }

    const { result } = renderHook(() => useTest(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.block.loading).toBe(false));

    act(() => result.current.ctx.setFilter('category', 'sports'));
    await waitFor(() =>
      expect(result.current.block.data).toEqual([{ category: 'sports', views: 100 }]),
    );
  });

  it('refresh re-executes the query', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: MOCK_ROWS }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(
      () => useDataBlock({ sourceId: 'ds1', query: { sql: 'SELECT 1' } }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    const callsBefore = fetchMock.mock.calls.length;

    act(() => result.current.refresh());
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('exportCsv creates an anchor and clicks it', async () => {
    const clickSpy = vi.fn();
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'a') vi.spyOn(el as HTMLAnchorElement, 'click').mockImplementation(clickSpy);
      return el;
    });

    const { result } = renderHook(
      () => useDataBlock({ sourceId: 'ds1', query: { sql: 'SELECT 1' } }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.exportCsv());

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('auto-refresh polls at configured interval', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: MOCK_ROWS }),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderHook(
      () => useDataBlock({ sourceId: 'ds1', query: { sql: 'SELECT 1' }, refreshInterval: 15 }),
      { wrapper: makeWrapper() },
    );

    // Drain initial mount fetch
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const initial = fetchMock.mock.calls.length;
    expect(initial).toBeGreaterThanOrEqual(1);

    // Advance past one polling interval and drain microtasks
    await act(async () => {
      vi.advanceTimersByTime(16_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(initial);
  });
});
