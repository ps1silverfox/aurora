import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';

interface DashboardStats {
  publishedPages: number;
  openDrafts: number;
  mediaSizeMb: number;
  activePlugins: number;
}

interface StatCardProps {
  label: string;
  value: number | string;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="stat-card">
      <span className="stat-card__value">{value}</span>
      <span className="stat-card__label">{label}</span>
    </div>
  );
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.get<DashboardStats>('/dashboard/stats');
        setStats(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : 'Failed to load dashboard');
      }
    })();
  }, []);

  return (
    <div className="dashboard">
      <h1 className="dashboard__title">Dashboard</h1>
      {error && (
        <div className="dashboard__error" role="alert">
          {error}
        </div>
      )}
      <div className="dashboard__stats">
        <StatCard label="Published Pages" value={stats?.publishedPages ?? '—'} />
        <StatCard label="Open Drafts" value={stats?.openDrafts ?? '—'} />
        <StatCard label="Media (MB)" value={stats?.mediaSizeMb ?? '—'} />
        <StatCard label="Active Plugins" value={stats?.activePlugins ?? '—'} />
      </div>
    </div>
  );
}
