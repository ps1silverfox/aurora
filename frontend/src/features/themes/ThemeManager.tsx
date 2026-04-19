import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';

interface ThemeSetting {
  key: string;
  label: string;
  type: 'text' | 'color' | 'select' | 'boolean';
  options?: string[];
  value: string | boolean;
}

interface Theme {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  active: boolean;
  screenshot: string | null;
  settings: ThemeSetting[];
}

export function ThemeManager() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [editTheme, setEditTheme] = useState<Theme | null>(null);
  const [settingsValues, setSettingsValues] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const data = await api.get<Theme[]>('/themes');
      setThemes(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Failed to load themes');
    } finally {
      setLoading(false);
    }
  }

  async function activate(theme: Theme) {
    if (activating || theme.active) return;
    setActivating(theme.id);
    try {
      await api.post(`/themes/${theme.id}/activate`, {});
      setThemes((prev) =>
        prev.map((t) => ({ ...t, active: t.id === theme.id })),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : `Failed to activate ${theme.name}`);
    } finally {
      setActivating(null);
    }
  }

  function openSettings(theme: Theme) {
    const initial: Record<string, string | boolean> = {};
    for (const s of theme.settings) {
      initial[s.key] = s.value;
    }
    setSettingsValues(initial);
    setSaveError(null);
    setEditTheme(theme);
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!editTheme) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.put<Theme>(`/themes/${editTheme.id}/settings`, settingsValues);
      setThemes((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditTheme(null);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.detail : 'Failed to save theme settings');
    } finally {
      setSaving(false);
    }
  }

  function handleSettingChange(key: string, value: string | boolean) {
    setSettingsValues((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) return <div className="theme-mgr__loading">Loading themes…</div>;

  return (
    <div className="theme-mgr">
      <h2 className="theme-mgr__title">Themes</h2>

      {error && (
        <div className="theme-mgr__error" role="alert">
          {error}
        </div>
      )}

      {themes.length === 0 ? (
        <div className="theme-mgr__empty">No themes installed.</div>
      ) : (
        <div className="theme-mgr__grid">
          {themes.map((theme) => (
            <div
              key={theme.id}
              className={`theme-card${theme.active ? ' theme-card--active' : ''}`}
              data-testid={`theme-card-${theme.id}`}
            >
              {theme.screenshot && (
                <img
                  className="theme-card__screenshot"
                  src={theme.screenshot}
                  alt={`${theme.name} preview`}
                />
              )}
              <div className="theme-card__body">
                <div className="theme-card__header">
                  <strong className="theme-card__name">{theme.name}</strong>
                  {theme.active && (
                    <span className="theme-card__active-badge">Active</span>
                  )}
                </div>
                <p className="theme-card__meta">
                  v{theme.version} by {theme.author}
                </p>
                <p className="theme-card__description">{theme.description}</p>
                <div className="theme-card__actions">
                  <button
                    className="theme-card__activate-btn"
                    onClick={() => void activate(theme)}
                    disabled={theme.active || activating !== null}
                    aria-label={`Activate ${theme.name}`}
                  >
                    {activating === theme.id ? 'Activating…' : theme.active ? 'Active' : 'Activate'}
                  </button>
                  {theme.settings.length > 0 && (
                    <button
                      className="theme-card__settings-btn"
                      onClick={() => openSettings(theme)}
                      aria-label={`Settings for ${theme.name}`}
                    >
                      Settings
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editTheme && (
        <div
          className="theme-settings__overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`${editTheme.name} Settings`}
        >
          <div className="theme-settings">
            <h3 className="theme-settings__title">{editTheme.name} — Settings</h3>
            {saveError && (
              <div className="theme-settings__error" role="alert">
                {saveError}
              </div>
            )}
            <form onSubmit={(e) => void saveSettings(e)}>
              {editTheme.settings.map((setting) => (
                <label key={setting.key} className="theme-settings__label">
                  {setting.label}
                  {setting.type === 'boolean' ? (
                    <input
                      type="checkbox"
                      checked={settingsValues[setting.key] as boolean}
                      onChange={(e) => handleSettingChange(setting.key, e.target.checked)}
                    />
                  ) : setting.type === 'select' ? (
                    <select
                      className="theme-settings__select"
                      value={settingsValues[setting.key] as string}
                      onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                    >
                      {setting.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="theme-settings__input"
                      type={setting.type === 'color' ? 'color' : 'text'}
                      value={settingsValues[setting.key] as string}
                      onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                    />
                  )}
                </label>
              ))}
              <div className="theme-settings__actions">
                <button type="submit" className="theme-settings__save-btn" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Settings'}
                </button>
                <button
                  type="button"
                  className="theme-settings__cancel-btn"
                  onClick={() => setEditTheme(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
