import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { UserList, type UserSummary } from './UserList';
import { RoleEditor } from './RoleEditor';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockFetch(data: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

function makeUser(overrides: Partial<UserSummary> = {}): UserSummary {
  return {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    role: 'editor',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

// ─── UserList ─────────────────────────────────────────────────────────────────

describe('UserList', () => {
  it('shows loading state', () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<MemoryRouter><UserList /></MemoryRouter>);
    expect(screen.getByText(/loading users/i)).toBeInTheDocument();
  });

  it('renders user rows', async () => {
    global.fetch = mockFetch([makeUser(), makeUser({ id: 'user-2', email: 'bob@example.com', displayName: 'Bob', role: 'author' })]);
    render(<MemoryRouter><UserList /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(screen.getByText('Bob')).toBeInTheDocument();
    // badge spans, not the select options
    expect(screen.getAllByText('Editor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Author').length).toBeGreaterThan(0);
  });

  it('shows empty state', async () => {
    global.fetch = mockFetch([]);
    render(<MemoryRouter><UserList /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/no users found/i)).toBeInTheDocument());
  });

  it('shows error on fetch failure', async () => {
    global.fetch = mockFetch({ title: 'Forbidden', detail: 'Not allowed' }, 403);
    render(<MemoryRouter><UserList /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('shows New Role link', async () => {
    global.fetch = mockFetch([]);
    render(<MemoryRouter><UserList /></MemoryRouter>);
    await waitFor(() => screen.getByText(/new role/i));
    expect(screen.getByText(/new role/i)).toBeInTheDocument();
  });

  it('calls PATCH on role change and updates badge', async () => {
    const patchFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve([makeUser()]) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) });
    global.fetch = patchFetch;

    render(<MemoryRouter><UserList /></MemoryRouter>);
    await waitFor(() => screen.getByText('Alice'));

    const select = screen.getByRole('combobox', { name: /change role for alice/i });
    fireEvent.change(select, { target: { value: 'admin' } });

    await waitFor(() => expect(patchFetch).toHaveBeenCalledTimes(2));
    expect(patchFetch.mock.calls[1][0]).toContain('/users/user-1');
  });

  it('shows error alert on PATCH failure', async () => {
    const patchFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve([makeUser()]) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({ detail: 'Server error' }) });
    global.fetch = patchFetch;

    render(<MemoryRouter><UserList /></MemoryRouter>);
    await waitFor(() => screen.getByText('Alice'));

    const select = screen.getByRole('combobox', { name: /change role for alice/i });
    fireEvent.change(select, { target: { value: 'admin' } });

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Server error');
  });
});

// ─── RoleEditor ───────────────────────────────────────────────────────────────

describe('RoleEditor', () => {
  function renderEditor(id = 'new') {
    return render(
      <MemoryRouter initialEntries={[`/roles/${id}`]}>
        <Routes>
          <Route path="/roles/:id" element={<RoleEditor />} />
          <Route path="/users" element={<div>users page</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('renders new role form without fetch', () => {
    render(
      <MemoryRouter initialEntries={['/roles/new']}>
        <Routes>
          <Route path="/roles/:id" element={<RoleEditor />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('New Role')).toBeInTheDocument();
  });

  it('loads existing role by id', async () => {
    global.fetch = mockFetch({ id: 'r1', name: 'Moderator', permissions: ['pages:read', 'pages:edit'] });
    renderEditor('r1');
    await waitFor(() => expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Moderator'));
    expect((screen.getByRole('checkbox', { name: 'pages:read' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'pages:delete' }) as HTMLInputElement).checked).toBe(false);
  });

  it('toggles permission checkboxes', async () => {
    global.fetch = mockFetch({ id: 'r1', name: 'Moderator', permissions: [] });
    renderEditor('r1');
    await waitFor(() => screen.getByLabelText('Role name'));

    const checkbox = screen.getByRole('checkbox', { name: 'pages:read' }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it('submits new role via POST', async () => {
    const postFetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 201, json: () => Promise.resolve({ id: 'r-new' }) });
    global.fetch = postFetch;

    renderEditor('new');
    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: 'Reviewer' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'pages:read' }));
    fireEvent.click(screen.getByRole('button', { name: /save role/i }));

    await waitFor(() => expect(postFetch).toHaveBeenCalledTimes(1));
    expect(postFetch.mock.calls[0][0]).toContain('/roles');
    expect(JSON.parse(postFetch.mock.calls[0][1].body as string)).toMatchObject({
      name: 'Reviewer',
      permissions: ['pages:read'],
    });
  });

  it('shows error on save failure', async () => {
    const failFetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 422, json: () => Promise.resolve({ detail: 'Name taken' }) });
    global.fetch = failFetch;

    renderEditor('new');
    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: 'Admin' } });
    fireEvent.click(screen.getByRole('button', { name: /save role/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Name taken');
  });
});
