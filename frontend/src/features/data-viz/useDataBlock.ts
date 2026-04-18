import { useCallback, useEffect, useRef, useState } from 'react';
import { useCrossFilter } from './CrossFilterContext';

export type Row = Record<string, unknown>;

export interface QueryConfig {
  sql?: string;
  jsonPath?: string;
  page?: number;
  pageSize?: number;
}

export type RefreshInterval = 15 | 30 | 60 | 300 | 'off';

const MAX_BACKOFF_MULTIPLIER = 8;

export interface UseDataBlockOptions {
  sourceId: string;
  query: QueryConfig;
  cacheTtl?: number;
  refreshInterval?: RefreshInterval;
}

export interface UseDataBlockResult {
  data: Row[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
  exportCsv: () => void;
}

function applyFilters(rows: Row[], filters: Record<string, unknown>): Row[] {
  const entries = Object.entries(filters);
  if (entries.length === 0) return rows;
  return rows.filter((row) =>
    entries.every(([key, value]) => String(row[key] ?? '') === String(value ?? '')),
  );
}

export function useDataBlock({
  sourceId,
  query,
  cacheTtl = 60,
  refreshInterval = 'off',
}: UseDataBlockOptions): UseDataBlockResult {
  const { filters } = useCrossFilter();
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Refs avoid stale closures inside the polling callback
  const errorCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Stable string dep prevents infinite re-render when caller passes a literal object
  const queryJson = JSON.stringify(query);

  const execute = useCallback(async () => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setLoading(true);
    try {
      const res = await fetch('/api/v1/data-queries/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, query: JSON.parse(queryJson) as QueryConfig, cacheTtl }),
        signal: abort.signal,
      });
      if (!res.ok) throw new Error(await res.text());
      const result = (await res.json()) as { data: Row[] };
      errorCount.current = 0;
      setData(result.data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      errorCount.current = Math.min(errorCount.current + 1, MAX_BACKOFF_MULTIPLIER);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, queryJson, cacheTtl]);

  // Initial fetch + re-fetch when filters/query change
  useEffect(() => {
    void execute();
    return () => {
      abortRef.current?.abort();
    };
  }, [execute, filters]);

  // Polling with exponential backoff on error
  useEffect(() => {
    if (refreshInterval === 'off') return;

    const schedule = () => {
      const baseMs = refreshInterval * 1000;
      const delay = baseMs * Math.pow(2, errorCount.current);
      timerRef.current = setTimeout(() => {
        void execute().then(schedule);
      }, delay);
    };

    schedule();
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [execute, refreshInterval]);

  const refresh = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    void execute();
  }, [execute]);

  const exportCsv = useCallback(() => {
    const params = new URLSearchParams({ format: 'csv' });
    if (query.sql) params.set('sql', query.sql);
    const url = `/api/v1/data-queries/${encodeURIComponent(sourceId)}/export?${params.toString()}`;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `query-${sourceId}.csv`;
    anchor.click();
  }, [sourceId, query.sql]);

  const filteredData = applyFilters(data, filters);

  return { data: filteredData, loading, error, lastUpdated, refresh, exportCsv };
}
