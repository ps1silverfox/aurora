import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PluginList } from './PluginList';
import { PluginSettings } from './PluginSettings';
import type { Plugin } from './PluginList';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    id: 'plug-1',
    name: 'Test Plugin',
    version: '1.0.0',
    status: 'inactive',
    manifest: {
      name: 'Test Plugin',
      version: '1.0.0',
      entrypoint: 'index.js',
      permissions: [],
      hooks: [],
      blocks: [],
      routes: [],
      settings: [
        { key: 'apiKey', label: 'API Key', type: 'text', defaultValue: '' },
        { key: 'timeout', label: 'Timeout', type: 'number', defaultValue: '30' },
        { key: 'enabled', label: 'Enabled', type: 'boolean', defaultValue: 'false' },
        { key: 'mode', label: 'Mode', type: 'select', options: ['fast', 'slow'], defaultValue: 'fast' },
      ],
    },
    installedAt: '2026-01-01T00:00:00.000Z',
    activatedAt: null,
    ...overrides,
  };
}

function mockFetch(data: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

// ─── PluginList ───────────────────────────────────────────────────────────────

describe('PluginList', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows loading state initially', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    render(<PluginList />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText(/loading plugins/i)).toBeInTheDocument();
  });

  it('renders plugin rows after loading', async () => {
    vi.stubGlobal('fetch', mockFetch([makePlugin()]));
    render(<PluginList />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    await waitFor(() => expect(screen.getByText('Test Plugin')).toBeInTheDocument());
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('shows empty state when no plugins', async () => {
    vi.stubGlobal('fetch', mockFetch([]));
    render(<PluginList />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    await waitFor(() => expect(screen.getByText(/no plugins installed/i)).toBeInTheDocument());
  });

  it('shows error state on fetch failure', async () => {
    vi.stubGlobal('fetch', mockFetch({ detail: 'Server error' }, 500));
    render(<PluginList />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('renders Settings link for plugins with settings', async () => {
    vi.stubGlobal('fetch', mockFetch([makePlugin()]));
    render(<PluginList />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    await waitFor(() => expect(screen.getByText('Test Plugin')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /settings for test plugin/i })).toBeInTheDocument();
  });

  it('does not render Settings link for plugins with no settings', async () => {
    const noSettings = makePlugin({ manifest: { ...makePlugin().manifest, settings: [] } });
    vi.stubGlobal('fetch', mockFetch([noSettings]));
    render(<PluginList />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    await waitFor(() => expect(screen.getByText('Test Plugin')).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: /settings/i })).toBeNull();
  });

  it('activates an inactive plugin optimistically', async () => {
    const plugin = makePlugin({ status: 'inactive' });
    const activated = { ...plugin, status: 'active' as const };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve([plugin]) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(activated) });
    vi.stubGlobal('fetch', fetchMock);

    render(<PluginList />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    await waitFor(() => screen.getByText('Test Plugin'));

    const btn = screen.getByRole('button', { name: /activate test plugin/i });
    await act(async () => { fireEvent.click(btn); });
    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument());
  });

  it('disables toggle button for error-status plugins', async () => {
    vi.stubGlobal('fetch', mockFetch([makePlugin({ status: 'error' })]));
    render(<PluginList />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    await waitFor(() => screen.getByText('Test Plugin'));
    const btn = screen.getByRole('button', { name: /activate test plugin/i });
    expect(btn).toBeDisabled();
  });
});

// ─── PluginSettings ───────────────────────────────────────────────────────────

describe('PluginSettings', () => {
  afterEach(() => vi.restoreAllMocks());

  function renderSettings(id = 'plug-1') {
    return render(
      <MemoryRouter initialEntries={[`/plugins/${id}/settings`]}>
        <Routes>
          <Route path="/plugins/:id/settings" element={<PluginSettings />} />
          <Route path="/plugins" element={<div>Plugin List</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('loads plugin and settings data', async () => {
    const plugin = makePlugin();
    const settings = { apiKey: 'abc', timeout: '60', enabled: 'true', mode: 'slow' };
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(plugin) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(settings) }),
    );
    renderSettings();
    await waitFor(() => expect(screen.getByText(/Test Plugin/)).toBeInTheDocument());
    expect(screen.getByLabelText('API Key')).toHaveValue('abc');
    expect(screen.getByLabelText('Timeout')).toHaveValue(60);
    expect(screen.getByLabelText('Enabled')).toBeChecked();
    expect(screen.getByLabelText('Mode')).toHaveValue('slow');
  });

  it('saves settings on form submit', async () => {
    const plugin = makePlugin();
    const settings = { apiKey: '', timeout: '30', enabled: 'false', mode: 'fast' };
    const updated = { apiKey: 'new-key', timeout: '30', enabled: 'false', mode: 'fast' };
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(plugin) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(settings) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(updated) }),
    );
    renderSettings();
    await waitFor(() => screen.getByLabelText('API Key'));

    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'new-key' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save settings/i }));
    });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved!'));
  });

  it('shows empty state for plugin with no settings', async () => {
    const plugin = makePlugin({ manifest: { ...makePlugin().manifest, settings: [] } });
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(plugin) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) }),
    );
    renderSettings();
    await waitFor(() => expect(screen.getByText(/no configurable settings/i)).toBeInTheDocument());
  });

  it('shows error on save failure', async () => {
    const plugin = makePlugin();
    const settings = { apiKey: '', timeout: '30', enabled: 'false', mode: 'fast' };
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(plugin) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(settings) })
        .mockResolvedValueOnce({ ok: false, status: 400, json: () => Promise.resolve({ detail: 'Invalid key' }) }),
    );
    renderSettings();
    await waitFor(() => screen.getByLabelText('API Key'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save settings/i }));
    });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid key'));
  });
});
