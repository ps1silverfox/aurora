import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { VALKEY_CLIENT } from '../auth/auth.constants';
import { DB_SERVICE, IDbService } from '../db/db.interface';
import { BlockRegistry } from './block-registry';
import { HttpMethod, PluginRouteHandler, PluginRouteRegistry } from './plugin-route-registry';
import { PluginManifest, PluginSettingSchema } from './plugin.entity';

export interface SandboxedPluginApi {
  registerBlockType(
    name: string,
    renderComponent: string,
    settingsSchema: PluginSettingSchema[],
  ): void;
  registerRoute(method: HttpMethod, path: string, handler: PluginRouteHandler): void;
}

@Injectable()
export class PluginSandboxService {
  private readonly logger = new Logger(PluginSandboxService.name);
  private readonly RATE_LIMIT = 100;
  private readonly WINDOW_SECONDS = 60;

  constructor(
    @Inject(DB_SERVICE) private readonly db: IDbService,
    @Optional() @Inject(VALKEY_CLIENT) private readonly redis: Redis | undefined,
    private readonly blockRegistry: BlockRegistry,
    private readonly routeRegistry: PluginRouteRegistry,
  ) {}

  buildSandboxedApi(
    pluginId: string,
    manifest: PluginManifest,
  ): SandboxedPluginApi {
    return {
      registerBlockType: (name, renderComponent, settingsSchema) => {
        this.checkPermission(manifest, 'blocks:register');
        this.blockRegistry.register({
          name,
          renderComponent,
          settingsSchema,
          pluginName: manifest.name,
        });
      },
      registerRoute: (method, path, handler) => {
        this.checkPermission(manifest, 'routes:register');
        const isolated = this.wrapWithErrorIsolation(manifest.name, handler);
        this.routeRegistry.register(pluginId, manifest.name, method, path, isolated);
      },
    };
  }

  async checkRateLimit(pluginName: string): Promise<void> {
    if (!this.redis) return;
    const window = Math.floor(Date.now() / (this.WINDOW_SECONDS * 1000));
    const key = `plugin:rl:${pluginName}:${window}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, this.WINDOW_SECONDS * 2);
    if (count > this.RATE_LIMIT) {
      throw new HttpException(
        `Plugin "${pluginName}" exceeded rate limit of ${this.RATE_LIMIT} req/min`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async markPluginError(pluginId: string, pluginName: string, err: unknown): Promise<void> {
    this.logger.error(`Plugin "${pluginName}" route handler threw: ${String(err)}`);
    try {
      await this.db.execute("UPDATE PLUGINS SET STATUS = 'error' WHERE ID = :id", { id: pluginId });
    } catch (dbErr) {
      this.logger.error(`Failed to mark plugin "${pluginName}" as error: ${String(dbErr)}`);
    }
  }

  private checkPermission(manifest: PluginManifest, permission: string): void {
    if (!manifest.permissions.includes(permission)) {
      throw new ForbiddenException(
        `Plugin "${manifest.name}" lacks permission: ${permission}`,
      );
    }
  }

  private wrapWithErrorIsolation(
    pluginName: string,
    handler: PluginRouteHandler,
  ): PluginRouteHandler {
    return async (params, body, query) => {
      try {
        return await handler(params, body, query);
      } catch (err) {
        this.logger.error(`Plugin "${pluginName}" handler error: ${String(err)}`);
        throw err;
      }
    };
  }
}
