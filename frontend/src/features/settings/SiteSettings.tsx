import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese (Simplified)' },
  { code: 'ar', label: 'Arabic' },
  { code: 'pt', label: 'Portuguese' },
];

interface SiteConfig {
  siteName: string;
  tagline: string;
  defaultLanguage: string;
  adminEmail: string;
  timezone: string;
}

export function SiteSettings() {
  const [config, setConfig] = useState<SiteConfig>({
    siteName: '',
    tagline: '',
    defaultLanguage: 'en',
    adminEmail: '',
    timezone: 'UTC',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [flushSuccess, setFlushSuccess] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const data = await api.get<SiteConfig>('/settings/site');
      setConfig(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Failed to load site settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await api.put<SiteConfig>('/settings/site', config);
      setConfig(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.detail : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleCacheFlush() {
    if (!confirm('Flush all Valkey cache entries? This will temporarily increase database load.')) return;
    setFlushing(true);
    setFlushSuccess(false);
    try {
      await api.post('/cache/flush', {});
      setFlushSuccess(true);
      setTimeout(() => setFlushSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Cache flush failed');
    } finally {
      setFlushing(false);
    }
  }

  function handleField(field: keyof SiteConfig, value: string) {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }

  if (loading) return <div className="site-settings__loading">Loading settings…</div>;

  return (
    <div className="site-settings">
      <h2 className="site-settings__title">Site Settings</h2>

      {error && (
        <div className="site-settings__error" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={(e) => void handleSave(e)} className="site-settings__form">
        <fieldset className="site-settings__group">
          <legend className="site-settings__group-title">General</legend>

          <label className="site-settings__label">
            Site Name
            <input
              className="site-settings__input"
              value={config.siteName}
              onChange={(e) => handleField('siteName', e.target.value)}
              required
            />
          </label>

          <label className="site-settings__label">
            Tagline
            <input
              className="site-settings__input"
              value={config.tagline}
              onChange={(e) => handleField('tagline', e.target.value)}
            />
          </label>

          <label className="site-settings__label">
            Default Language
            <select
              className="site-settings__select"
              value={config.defaultLanguage}
              onChange={(e) => handleField('defaultLanguage', e.target.value)}
            >
              {SUPPORTED_LANGUAGES.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="site-settings__label">
            Admin Email
            <input
              className="site-settings__input"
              type="email"
              value={config.adminEmail}
              onChange={(e) => handleField('adminEmail', e.target.value)}
            />
          </label>

          <label className="site-settings__label">
            Timezone
            <input
              className="site-settings__input"
              value={config.timezone}
              onChange={(e) => handleField('timezone', e.target.value)}
              placeholder="e.g. America/Chicago"
            />
          </label>
        </fieldset>

        {saveError && (
          <div className="site-settings__save-error" role="alert">
            {saveError}
          </div>
        )}
        {saveSuccess && (
          <div className="site-settings__save-success" role="status">
            Settings saved.
          </div>
        )}

        <div className="site-settings__save-row">
          <button type="submit" className="site-settings__save-btn" disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>

      <section className="site-settings__cache">
        <h3 className="site-settings__section-title">Cache Management</h3>
        <p className="site-settings__cache-desc">
          Flush all Valkey cache entries. Use this after bulk content changes or when stale data is
          suspected.
        </p>
        {flushSuccess && (
          <div className="site-settings__flush-success" role="status">
            Cache flushed successfully.
          </div>
        )}
        <button
          className="site-settings__flush-btn"
          onClick={() => void handleCacheFlush()}
          disabled={flushing}
        >
          {flushing ? 'Flushing…' : 'Flush Cache'}
        </button>
      </section>
    </div>
  );
}
