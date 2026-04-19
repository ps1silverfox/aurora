import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuditLogBrowser, type AuditEntry } from './AuditLogBrowser';

function mockFetch(data: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 'entry-1',
    entityType: 'page',
    entityId: 'page-1',
    action: 'publish',
    actorId: 'user-1',
    actorEmail: 'alice@example.com',
    diff: { title: { before: 'Draft', after: 'Published' } },
    createdAt: '2026-04-01T12:00:00.000Z',
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('AuditLogBrowser', () => {
  it('shows loading state', () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<MemoryRouter><AuditLogBrowser /></MemoryRouter>);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders entry rows', async () => {
    global.fetch = mockFetch({ data: [makeEntry()], nextCursor: null });
    render(<MemoryRouter><AuditLogBrowser /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('alice@example.com')).toBeInTheDocument());
    expect(screen.getByText('publish')).toBeInTheDocument();
    expect(screen.getByText(/page\/page-1/i)).toBeInTheDocument();
  });

  it('shows empty state', async () => {
    global.fetch = mockFetch({ data: [], nextCursor: null });
    render(<MemoryRouter><AuditLogBrowser /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/no audit entries/i)).toBeInTheDocument());
  });

  it('shows error on fetch failure', async () => {
    global.fetch = mockFetch({ detail: 'Forbidden' }, 403);
    render(<MemoryRouter><AuditLogBrowser /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('expands diff on row toggle', async () => {
    global.fetch = mockFetch({ data: [makeEntry()], nextCursor: null });
    render(<MemoryRouter><AuditLogBrowser /></MemoryRouter>);
    await waitFor(() => screen.getByText('alice@example.com'));

    const expandBtn = screen.getByRole('button', { name: /expand diff/i });
    fireEvent.click(expandBtn);

    await waitFor(() => expect(screen.getByText(/before/i)).toBeInTheDocument());
    expect(screen.getByText(/Draft/)).toBeInTheDocument();
  });

  it('collapses diff on second toggle', async () => {
    global.fetch = mockFetch({ data: [makeEntry()], nextCursor: null });
    render(<MemoryRouter><AuditLogBrowser /></MemoryRouter>);
    await waitFor(() => screen.getByText('alice@example.com'));

    const expandBtn = screen.getByRole('button', { name: /expand diff/i });
    fireEvent.click(expandBtn);
    await waitFor(() => screen.getByText(/Draft/));

    const collapseBtn = screen.getByRole('button', { name: /collapse diff/i });
    fireEvent.click(collapseBtn);
    expect(screen.queryByText(/Draft/)).not.toBeInTheDocument();
  });

  it('shows Load more button when nextCursor present', async () => {
    global.fetch = mockFetch({ data: [makeEntry()], nextCursor: 'abc123' });
    render(<MemoryRouter><AuditLogBrowser /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument());
  });

  it('fetches next page on Load more click', async () => {
    const pageFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [makeEntry()], nextCursor: 'cursor1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [makeEntry({ id: 'entry-2', actorEmail: 'bob@example.com' })], nextCursor: null }),
      });
    global.fetch = pageFetch;

    render(<MemoryRouter><AuditLogBrowser /></MemoryRouter>);
    await waitFor(() => screen.getByRole('button', { name: /load more/i }));

    fireEvent.click(screen.getByRole('button', { name: /load more/i }));
    await waitFor(() => expect(screen.getByText('bob@example.com')).toBeInTheDocument());
    expect(pageFetch).toHaveBeenCalledTimes(2);
  });

  it('re-fetches when entity type filter changes', async () => {
    const filterFetch = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [], nextCursor: null }),
      });
    global.fetch = filterFetch;

    render(<MemoryRouter><AuditLogBrowser /></MemoryRouter>);
    await waitFor(() => screen.getByText(/no audit entries/i));

    fireEvent.change(screen.getByRole('combobox', { name: /entity type/i }), { target: { value: 'user' } });

    await waitFor(() => expect(filterFetch).toHaveBeenCalledTimes(2));
    const secondCallUrl = filterFetch.mock.calls[1][0] as string;
    expect(secondCallUrl).toContain('entityType=user');
  });
});
