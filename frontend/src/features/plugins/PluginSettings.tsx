import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import type { Plugin, PluginStatus } from './PluginList';

interface PluginSettingSchema {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  options?: string[];
  defaultValue?: unknown;
}

function SettingField({
  schema,
  value,
  onChange,
}: {
  schema: PluginSettingSchema;
  value: string;
  onChange: (key: string, value: string) => void;
}) {
  const id = `setting-${schema.key}`;

  switch (schema.type) {
    case 'boolean':
      return (
        <div className="setting-field">
          <label htmlFor={id} className="setting-field__label">
            {schema.label}
          </label>
          <input
            id={id}
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) => onChange(schema.key, e.target.checked ? 'true' : 'false')}
          />
        </div>
      );

    case 'number':
      return (
        <div className="setting-field">
          <label htmlFor={id} className="setting-field__label">
            {schema.label}
          </label>
          <input
            id={id}
            type="number"
            value={value}
            onChange={(e) => onChange(schema.key, e.target.value)}
            className="setting-field__input"
          />
        </div>
      );

    case 'select':
      return (
        <div className="setting-field">
          <label htmlFor={id} className="setting-field__label">
            {schema.label}
          </label>
          <select
            id={id}
            value={value}
            onChange={(e) => onChange(schema.key, e.target.value)}
            className="setting-field__select"
          >
            {(schema.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );

    default:
      return (
        <div className="setting-field">
          <label htmlFor={id} className="setting-field__label">
            {schema.label}
          </label>
          <input
            id={id}
            type="text"
            value={value}
            onChange={(e) => onChange(schema.key, e.target.value)}
            className="setting-field__input"
          />
        </div>
      );
  }
}

export function PluginSettings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [plugin, setPlugin] = useState<Plugin | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const [pluginData, settings] = await Promise.all([
          api.get<Plugin>(`/plugins/${id}`),
          api.get<Record<string, string>>(`/plugins/${id}/settings`),
        ]);
        setPlugin(pluginData);
        setValues(settings);
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : 'Failed to load plugin settings');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  function handleChange(key: string, value: string) {
    setSaved(false);
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.put<Record<string, string>>(`/plugins/${id}/settings`, values);
      setValues(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="plugin-settings__loading">Loading…</div>;
  if (error && !plugin) return <div className="plugin-settings__error" role="alert">{error}</div>;
  if (!plugin) return null;

  const schemas: PluginSettingSchema[] = plugin.manifest.settings;

  return (
    <div className="plugin-settings">
      <button className="plugin-settings__back" onClick={() => navigate('/plugins')}>
        ← Back to Plugins
      </button>
      <h2 className="plugin-settings__title">
        {plugin.name} <span className="plugin-settings__version">v{plugin.version}</span> — Settings
      </h2>

      {error && (
        <div className="plugin-settings__error" role="alert">
          {error}
        </div>
      )}

      {schemas.length === 0 ? (
        <p className="plugin-settings__empty">This plugin has no configurable settings.</p>
      ) : (
        <form className="plugin-settings__form" onSubmit={(e) => void handleSubmit(e)}>
          {schemas.map((schema) => (
            <SettingField
              key={schema.key}
              schema={schema}
              value={values[schema.key] ?? ''}
              onChange={handleChange}
            />
          ))}
          <div className="plugin-settings__footer">
            <button type="submit" disabled={saving} className="plugin-settings__save">
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
            {saved && <span className="plugin-settings__saved" role="status">Saved!</span>}
          </div>
        </form>
      )}
    </div>
  );
}
