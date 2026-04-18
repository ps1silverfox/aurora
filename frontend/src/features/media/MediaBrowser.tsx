import React, { useCallback, useEffect, useRef, useState } from 'react';
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

interface UploadState {
  filename: string;
  progress: number;
  error: string | null;
}

const BASE_URL = (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? '/api/v1';

function getAuthToken(): string | null {
  return (window as unknown as Record<string, string | null>)['__authToken'] ?? null;
}

function thumbnailUrl(item: MediaItem): string {
  if (item.mimeType?.startsWith('image/')) {
    return `${BASE_URL}/media/${item.id}/thumbnail`;
  }
  return '';
}

function uploadFile(
  file: File,
  onProgress: (pct: number) => void,
): Promise<MediaItem> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as MediaItem);
      } else {
        const body = JSON.parse(xhr.responseText || '{}') as { detail?: string };
        reject(new ApiError(xhr.status, body.detail ?? xhr.statusText));
      }
    };

    xhr.onerror = () => reject(new ApiError(0, 'Network error'));

    xhr.open('POST', `${BASE_URL}/media`);
    const token = getAuthToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(form);
  });
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

async function deleteMedia(id: string): Promise<void> {
  const token = getAuthToken();
  const res = await fetch(`${BASE_URL}/media/${id}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok && res.status !== 204) throw new ApiError(res.status, res.statusText);
}

export default function MediaBrowser() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPage = useCallback(async (cursor?: string) => {
    setLoading(true);
    try {
      const page = await fetchMedia(cursor);
      setItems((prev) => (cursor ? [...prev, ...page.data] : page.data));
      setNextCursor(page.nextCursor);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPage(); }, [loadPage]);

  const handleFiles = useCallback((files: File[]) => {
    for (const file of files) {
      const state: UploadState = { filename: file.name, progress: 0, error: null };
      setUploads((prev) => [...prev, state]);
      const idx = -1; // placeholder — we track by filename+timestamp below

      void uploadFile(file, (pct) => {
        setUploads((prev) =>
          prev.map((u) => (u.filename === file.name && u.error === null ? { ...u, progress: pct } : u)),
        );
      })
        .then((media) => {
          setUploads((prev) => prev.filter((u) => u !== state));
          setItems((prev) => [media, ...prev]);
        })
        .catch((err: unknown) => {
          const msg = err instanceof ApiError ? err.message : 'Upload failed';
          setUploads((prev) =>
            prev.map((u) => (u === state ? { ...u, error: msg } : u)),
          );
        });

      void idx;
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(Array.from(e.dataTransfer.files));
    },
    [handleFiles],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteMedia(deleteTarget.id);
    setItems((prev) => prev.filter((m) => m.id !== deleteTarget.id));
    setDeleteTarget(null);
  }, [deleteTarget]);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '1rem' }}>
      <h2 style={{ margin: '0 0 1rem' }}>Media Library</h2>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#0070f3' : '#ccc'}`,
          borderRadius: 8,
          padding: '2rem',
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: '1rem',
          background: dragging ? '#f0f8ff' : '#fafafa',
        }}
      >
        <span>Drop files here or click to upload</span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
        />
      </div>

      {/* Upload progress */}
      {uploads.map((u, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <span>{u.filename}</span>
          {u.error ? (
            <span style={{ color: 'red', marginLeft: 8 }}>{u.error}</span>
          ) : (
            <div
              style={{
                height: 6,
                background: '#eee',
                borderRadius: 3,
                marginTop: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${u.progress}%`,
                  height: '100%',
                  background: '#0070f3',
                  transition: 'width 0.2s',
                }}
              />
            </div>
          )}
        </div>
      ))}

      {/* Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '1rem',
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              border: '1px solid #eee',
              borderRadius: 6,
              overflow: 'hidden',
              background: '#fff',
            }}
          >
            {item.mimeType?.startsWith('image/') ? (
              <img
                src={thumbnailUrl(item)}
                alt={item.filename}
                style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: 100,
                  background: '#f5f5f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  color: '#888',
                }}
              >
                {item.mimeType ?? 'file'}
              </div>
            )}
            <div style={{ padding: '0.4rem 0.5rem' }}>
              <div
                style={{
                  fontSize: 12,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={item.filename}
              >
                {item.filename}
              </div>
              <button
                onClick={() => setDeleteTarget(item)}
                style={{
                  marginTop: 4,
                  padding: '2px 8px',
                  fontSize: 11,
                  cursor: 'pointer',
                  background: '#fff',
                  border: '1px solid #e00',
                  color: '#e00',
                  borderRadius: 4,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Load more */}
      {nextCursor && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button
            onClick={() => { void loadPage(nextCursor); }}
            disabled={loading}
            style={{ padding: '0.5rem 1.5rem', cursor: 'pointer' }}
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: '2rem',
              maxWidth: 400,
              width: '90%',
            }}
          >
            <p style={{ margin: '0 0 1rem' }}>
              Delete <strong>{deleteTarget.filename}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)} style={{ padding: '0.4rem 1rem' }}>
                Cancel
              </button>
              <button
                onClick={() => { void confirmDelete(); }}
                style={{
                  padding: '0.4rem 1rem',
                  background: '#e00',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
