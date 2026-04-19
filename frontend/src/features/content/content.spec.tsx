import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PageList, type PageSummary } from './PageList';
import { PageEditor } from './PageEditor';
import { RevisionSidebar } from './RevisionSidebar';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockFetch(data: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

function makePage(overrides: Partial<PageSummary> = {}): PageSummary {
  return {
    id: 'page-1',
    title: 'Hello World',
    slug: 'hello-world',
    status: 'draft',
    authorId: 'user-1',
    updatedAt: '2026-04-01T10:00:00.000Z',
    publishedAt: null,
    ...overrides,
  };
}

function makePageDetail(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'page-1',
    title: 'Hello World',
    slug: 'hello-world',
    status: 'draft',
    authorId: 'user-1',
    scheduledAt: null,
    blocks: [],
    tags: ['news'],
    categories: [],
    updatedAt: '2026-04-01T10:00:00.000Z',
    ...overrides,
  };
}

// ─── PageList ─────────────────────────────────────────────────────────────────

describe('PageList', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows loading state initially', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    render(<PageList />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText(/loading pages/i)).toBeInTheDocument();
  });

  it('renders page rows after loading', async () => {
    vi.stubGlobal('fetch', mockFetch({ data: [makePage()], nextCursor: null }));
    render(<PageList />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    await waitFor(() => expect(screen.getByText('Hello World')).toBeInTheDocument());
    expect(screen.getByText('/hello-world')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('shows empty state when no pages', async () => {
    vi.stubGlobal('fetch', mockFetch({ data: [], nextCursor: null }));
    render(<PageList />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    await waitFor(() => expect(screen.getByText(/no pages yet/i)).toBeInTheDocument());
  });

  it('shows error on fetch failure', async () => {
    vi.stubGlobal('fetch', mockFetch({ detail: 'Server error' }, 500));
    render(<PageList />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('removes row after delete', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
      calls.push(`${opts?.method ?? 'GET'} ${url}`);
      return Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve({}) });
    }));

    // Prefill initial load as GET
    const page = makePage();
    vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
      const method = opts?.method ?? 'GET';
      if (method === 'GET') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [page], nextCursor: null }) });
      return Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve({}) });
    }));

    vi.stubGlobal('confirm', () => true);
    render(<PageList />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    await waitFor(() => expect(screen.getByText('Hello World')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Delete Hello World'));
    await waitFor(() => expect(screen.queryByText('Hello World')).not.toBeInTheDocument());
  });

  it('renders New Page button', async () => {
    vi.stubGlobal('fetch', mockFetch({ data: [], nextCursor: null }));
    render(<PageList />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    await waitFor(() => expect(screen.getByText(/new page/i)).toBeInTheDocument());
  });
});

// ─── PageEditor ───────────────────────────────────────────────────────────────

vi.mock('../../editor/AuroraEditor', () => ({
  AuroraEditor: ({ onSave, onChange }: { onSave?: (b: unknown[]) => void; onChange?: (b: unknown[]) => void }) => (
    <div data-testid="aurora-editor">
      <button onClick={() => onSave?.([])}>Save from Editor</button>
      <button onClick={() => onChange?.([])}>Change</button>
    </div>
  ),
}));

describe('PageEditor', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows loading state initially for existing page', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    render(
      <MemoryRouter initialEntries={['/pages/page-1']}>
        <Routes>
          <Route path="/pages/:id" element={<PageEditor />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/loading page/i)).toBeInTheDocument();
  });

  it('renders page title and editor after load', async () => {
    vi.stubGlobal('fetch', mockFetch(makePageDetail()));
    render(
      <MemoryRouter initialEntries={['/pages/page-1']}>
        <Routes>
          <Route path="/pages/:id" element={<PageEditor />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByDisplayValue('Hello World')).toBeInTheDocument());
    expect(screen.getByTestId('aurora-editor')).toBeInTheDocument();
  });

  it('shows Submit workflow button for draft + editor role', async () => {
    vi.stubGlobal('fetch', mockFetch(makePageDetail({ status: 'draft' })));
    render(
      <MemoryRouter initialEntries={['/pages/page-1']}>
        <Routes>
          <Route path="/pages/:id" element={<PageEditor userRole="editor" />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByLabelText('Submit for Review')).toBeInTheDocument());
  });

  it('shows Approve button for review + approver role', async () => {
    vi.stubGlobal('fetch', mockFetch(makePageDetail({ status: 'review' })));
    render(
      <MemoryRouter initialEntries={['/pages/page-1']}>
        <Routes>
          <Route path="/pages/:id" element={<PageEditor userRole="approver" />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByLabelText('Approve')).toBeInTheDocument());
  });

  it('shows Revisions button for existing page', async () => {
    vi.stubGlobal('fetch', mockFetch(makePageDetail()));
    render(
      <MemoryRouter initialEntries={['/pages/page-1']}>
        <Routes>
          <Route path="/pages/:id" element={<PageEditor />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Revisions')).toBeInTheDocument());
  });

  it('renders new page form without loading', () => {
    render(
      <MemoryRouter initialEntries={['/pages/new']}>
        <Routes>
          <Route path="/pages/:id" element={<PageEditor />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByPlaceholderText('Page title')).toBeInTheDocument();
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });
});

// ─── RevisionSidebar ──────────────────────────────────────────────────────────

describe('RevisionSidebar', () => {
  const onRestore = vi.fn();
  afterEach(() => { vi.restoreAllMocks(); onRestore.mockReset(); });

  it('shows loading initially', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    render(<RevisionSidebar pageId="page-1" currentTitle="Hello" onRestore={onRestore} />, {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });
    expect(screen.getByText(/loading revisions/i)).toBeInTheDocument();
  });

  it('shows empty state when no revisions', async () => {
    vi.stubGlobal('fetch', mockFetch([]));
    render(<RevisionSidebar pageId="page-1" currentTitle="Hello" onRestore={onRestore} />, {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });
    await waitFor(() => expect(screen.getByText(/no revisions yet/i)).toBeInTheDocument());
  });

  it('renders revision items and toggles diff', async () => {
    const rev = { id: 'rev-1', pageId: 'page-1', title: 'Old Title', blocks: [], createdBy: 'user-1', createdAt: '2026-03-01T10:00:00.000Z' };
    vi.stubGlobal('fetch', mockFetch([rev]));
    render(<RevisionSidebar pageId="page-1" currentTitle="Hello" onRestore={onRestore} />, {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });
    await waitFor(() => expect(screen.getByTestId('revision-rev-1')).toBeInTheDocument());

    fireEvent.click(screen.getByText('View diff'));
    expect(screen.getByText('Hide diff')).toBeInTheDocument();
    expect(screen.getByLabelText('Revision diff')).toBeInTheDocument();
  });

  it('calls onRestore after confirming restore', async () => {
    const rev = { id: 'rev-1', pageId: 'page-1', title: 'Old', blocks: [], createdBy: null, createdAt: '2026-03-01T10:00:00.000Z' };
    vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
      const method = opts?.method ?? 'GET';
      if (method === 'GET') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([rev]) });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    }));
    vi.stubGlobal('confirm', () => true);
    render(<RevisionSidebar pageId="page-1" currentTitle="Hello" onRestore={onRestore} />, {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });
    await waitFor(() => screen.getByText('Restore'));
    await act(async () => { fireEvent.click(screen.getByText('Restore')); });
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith(rev));
  });
});
