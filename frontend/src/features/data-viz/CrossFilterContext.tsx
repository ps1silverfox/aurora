import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type FilterMap = Record<string, unknown>;

interface CrossFilterState {
  filters: FilterMap;
  setFilter: (key: string, value: unknown) => void;
  clearFilter: (key: string) => void;
  clearAll: () => void;
}

const CrossFilterContext = createContext<CrossFilterState>({
  filters: {},
  setFilter: () => {},
  clearFilter: () => {},
  clearAll: () => {},
});

export function CrossFilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<FilterMap>({});

  const setFilter = useCallback((key: string, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilter = useCallback((key: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setFilters({}), []);

  const value = useMemo(
    () => ({ filters, setFilter, clearFilter, clearAll }),
    [filters, setFilter, clearFilter, clearAll],
  );

  return <CrossFilterContext.Provider value={value}>{children}</CrossFilterContext.Provider>;
}

export function useCrossFilter(): CrossFilterState {
  return useContext(CrossFilterContext);
}
