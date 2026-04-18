import React, { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../api/client';

interface MediaItem {
  id: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  storagePath: string;
  createdAt: string;
}

interface CursorPage {
  data: MediaItem[];
  nextCursor: string | null;
}

interface MediaPickerProps {
  onSelect: (item: MediaItem) => void;
  onClose: () => void;
  accept?: string[];
}

const BASE_URL = (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? '/api/v1';

function getAuthToken(): string | null {
  return (window as unknown as Record<string, string | null>)['__authToken'] ?? null;
}

async function fetchMedia(cursor?: string): Promise<CursorPage> {
  const params = new URLSearchParams({ limit: '24' });
  if (cursor) params.set('cursor', cursor);
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}/media?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  return res.json() as Promise<CursorPage>;
}

export default function MediaPicker({ onSelect, onClose, accept }: MediaPickerProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<MediaItem | null>(null);

  const loadPage = useCallback(async (cursor?: string) => {
    setLoading(true);
    try {
      const page = await fetchMedia(cursor);
      const filtered =
        accept && accept.length > 0
          ? page.data.filter((m) => accept.some((a) => m.mimeType?.startsWith(a)))
          : page.data;
      setItems((prev) => (cursor ? [...prev, ...filtered] : filtered));
      setNextCursor(page.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [accept]);

  useEffect(() => { void loadPage(); }, [loadPage]);

  const handleSelect = useCallback(() => {
    if (selected) onSelect(selected);
  }, [selected, onSelect]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Media picker"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          width: '80vw',
          maxWidth: 900,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #eee',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0 }}>Select Media</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>
            ×
          </button>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelected(item)}
                style={{
                  border: `2px solid ${selected?.id === item.id ? '#0070f3' : '#eee'}`,
                  borderRadius: 6,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  background: selected?.id === item.id ? '#f0f8ff' : '#fff',
                }}
              >
                {item.mimeType?.startsWith('image/') ? (
                  <img
                    src={`${BASE_URL}/media/${item.id}/thumbnail`}
                    alt={item.filename}
                    style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div
                    style={{
                      height: 90,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#f5f5f5',
                      fontSize: 11,
                      color: '#888',
                    }}
                  >
                    {item.mimeType ?? 'file'}
                  </div>
                )}
                <div
                  style={{
                    padding: '0.3rem 0.4rem',
                    fontSize: 11,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={item.filename}
                >
                  {item.filename}
                </div>
              </div>
            ))}
          </div>

          {nextCursor && (
            <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
              <button
                onClick={() => { void loadPage(nextCursor); }}
                disabled={loading}
                style={{ padding: '0.4rem 1rem', cursor: 'pointer' }}
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            borderTop: '1px solid #eee',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button onClick={onClose} style={{ padding: '0.4rem 1rem', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={selected === null}
            style={{
              padding: '0.4rem 1.2rem',
              background: selected ? '#0070f3' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: selected ? 'pointer' : 'not-allowed',
            }}
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
}
