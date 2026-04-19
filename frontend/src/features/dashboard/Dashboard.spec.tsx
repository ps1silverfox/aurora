import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { Dashboard } from './Dashboard';
import * as client from '../../api/client';

vi.mock('../../api/client', () => ({
  api: { get: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(public status: number, public detail: string) { super(detail); }
  },
}));

describe('Dashboard', () => {
  it('renders title', () => {
    vi.mocked(client.api.get).mockResolvedValue({
      publishedPages: 0,
      openDrafts: 0,
      mediaSizeMb: 0,
      activePlugins: 0,
    });
    render(<Dashboard />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('shows placeholder dashes while loading', () => {
    vi.mocked(client.api.get).mockResolvedValue({ publishedPages: 10, openDrafts: 2, mediaSizeMb: 512, activePlugins: 3 });
    render(<Dashboard />);
    // Before resolution, values show —
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders stat cards after load', async () => {
    vi.mocked(client.api.get).mockResolvedValue({
      publishedPages: 42,
      openDrafts: 5,
      mediaSizeMb: 128,
      activePlugins: 3,
    });
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    expect(screen.getByText('Published Pages')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows error message on API failure', async () => {
    vi.mocked(client.api.get).mockRejectedValue(new client.ApiError(500, 'Server error'));
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Server error'));
  });
});
