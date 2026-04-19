import { Injectable } from '@nestjs/common';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type PluginRouteHandler = (
  params: Record<string, string>,
  body: unknown,
  query: Record<string, string>,
) => Promise<unknown> | unknown;

interface RouteEntry {
  pluginId: string;
  pluginName: string;
  method: HttpMethod;
  path: string;
  handler: PluginRouteHandler;
}

@Injectable()
export class PluginRouteRegistry {
  private readonly routes: RouteEntry[] = [];

  register(
    pluginId: string,
    pluginName: string,
    method: HttpMethod,
    path: string,
    handler: PluginRouteHandler,
  ): void {
    this.routes.push({ pluginId, pluginName, method, path, handler });
  }

  find(
    pluginName: string,
    method: string,
    subPath: string,
  ): { handler: PluginRouteHandler; pluginId: string } | undefined {
    const entry = this.routes.find(
      (r) =>
        r.pluginName === pluginName &&
        r.method === method.toUpperCase() &&
        r.path === subPath,
    );
    return entry ? { handler: entry.handler, pluginId: entry.pluginId } : undefined;
  }

  unregisterPlugin(pluginName: string): void {
    for (let i = this.routes.length - 1; i >= 0; i--) {
      if (this.routes[i]!.pluginName === pluginName) this.routes.splice(i, 1);
    }
  }
}
