export type PluginStatus = 'inactive' | 'active' | 'error';

export interface PluginSettingSchema {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  options?: string[];
  defaultValue?: unknown;
}

export interface PluginManifest {
  name: string;
  version: string;
  entrypoint: string;
  permissions: string[];
  hooks: string[];
  blocks: string[];
  routes: string[];
  settings: PluginSettingSchema[];
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  status: PluginStatus;
  manifest: PluginManifest;
  installedAt: Date;
  activatedAt: Date | null;
}

export interface PluginSetting {
  id: string;
  pluginId: string;
  key: string;
  value: string | null;
}

// DB row shapes

export interface PluginRow {
  ID: string;
  NAME: string;
  VERSION: string;
  STATUS: string;
  MANIFEST: string;
  INSTALLED_AT: string;
  ACTIVATED_AT: string | null;
}

export function rowToPlugin(row: PluginRow): Plugin {
  return {
    id: row.ID,
    name: row.NAME,
    version: row.VERSION,
    status: row.STATUS as PluginStatus,
    manifest: JSON.parse(row.MANIFEST) as PluginManifest,
    installedAt: new Date(row.INSTALLED_AT),
    activatedAt: row.ACTIVATED_AT ? new Date(row.ACTIVATED_AT) : null,
  };
}
