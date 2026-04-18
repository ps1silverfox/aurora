export interface Theme {
  id: number;
  name: string;
  slug: string;
  path: string;
  isActive: boolean;
  settings: Record<string, unknown>;
  createdAt: Date;
}

export interface ThemeManifest {
  name: string;
  slug: string;
  version: string;
  description: string;
  author: string;
}
