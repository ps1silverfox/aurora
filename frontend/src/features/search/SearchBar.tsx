import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

interface SearchResult {
  id: string;
  title: string;
  slug: string;
  score: number;
  publishedAt: string | null;
}

interface SearchPage {
  data: SearchResult[];
  nextCursor: string | null;
}

const DEBOUNCE_MS = 300;
const DROPDOWN_LIMIT = 5;

export function SearchBar({ className }: { className?: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchResults = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const page = await api.get<SearchPage>(
        `/search?q=${encodeURIComponent(q.trim())}&limit=${DROPDOWN_LIMIT}`,
      );
      setResults(page.data);
      setOpen(page.data.length > 0);
      setActiveIdx(-1);
    } catch {
      setResults([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void fetchResults(val), DEBOUNCE_MS);
    },
    [fetchResults],
  );

  // Navigate to full results page on Enter or explicit submit
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim().length < 2) return;
      setOpen(false);
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    },
    [query, navigate],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, -1));
      } else if (e.key === 'Escape') {
        setOpen(false);
        setActiveIdx(-1);
      } else if (e.key === 'Enter' && activeIdx >= 0) {
        e.preventDefault();
        const item = results[activeIdx];
        if (item) {
          setOpen(false);
          navigate(`/${item.slug}`);
        }
      }
    },
    [open, results, activeIdx, navigate],
  );

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className={`search-bar${className ? ` ${className}` : ''}`} style={{ position: 'relative' }}>
      <form onSubmit={handleSubmit} role="search">
        <input
          type="search"
          aria-label="Search content"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-activedescendant={activeIdx >= 0 ? `search-item-${activeIdx}` : undefined}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Search…"
          autoComplete="off"
          style={{ width: '100%', padding: '6px 10px', fontSize: 14 }}
        />
        {loading && (
          <span
            aria-live="polite"
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#888' }}
          >
            …
          </span>
        )}
      </form>

      {open && (
        <ul
          role="listbox"
          aria-label="Search suggestions"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            margin: 0,
            padding: 0,
            listStyle: 'none',
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            zIndex: 1000,
          }}
        >
          {results.map((item, idx) => (
            <li
              key={item.id}
              id={`search-item-${idx}`}
              role="option"
              aria-selected={idx === activeIdx}
              onMouseDown={() => {
                setOpen(false);
                navigate(`/${item.slug}`);
              }}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: idx === activeIdx ? '#f0f4ff' : 'transparent',
                borderBottom: idx < results.length - 1 ? '1px solid #f0f0f0' : 'none',
              }}
            >
              <span style={{ fontWeight: 500, fontSize: 14 }}>{item.title}</span>
              <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>/{item.slug}</span>
            </li>
          ))}
          <li
            style={{
              padding: '6px 12px',
              fontSize: 12,
              color: '#555',
              borderTop: '1px solid #f0f0f0',
              cursor: 'pointer',
            }}
            onMouseDown={handleSubmit as unknown as React.MouseEventHandler}
          >
            See all results for <strong>{query}</strong>
          </li>
        </ul>
      )}
    </div>
  );
}
