import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { PluginSandboxService } from './plugin-sandbox.service';
import { BlockRegistry } from './block-registry';
import { PluginRouteRegistry } from './plugin-route-registry';
import { PluginManifest } from './plugin.entity';

function makeManifest(permissions: string[]): PluginManifest {
  return {
    name: 'test-plugin',
    version: '1.0.0',
    entrypoint: 'index.js',
    permissions,
    hooks: [],
    blocks: [],
    routes: [],
    settings: [],
  };
}

function makeDb() {
  return { execute: jest.fn(), query: jest.fn() };
}

describe('PluginSandboxService', () => {
  let sandbox: PluginSandboxService;
  let blockRegistry: BlockRegistry;
  let routeRegistry: PluginRouteRegistry;
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb();
    blockRegistry = new BlockRegistry();
    routeRegistry = new PluginRouteRegistry();
    sandbox = new PluginSandboxService(db as never, undefined, blockRegistry, routeRegistry);
  });

  describe('registerBlockType', () => {
    it('registers block when plugin has blocks:register permission', () => {
      const api = sandbox.buildSandboxedApi('id-1', makeManifest(['blocks:register']));
      api.registerBlockType('hero', 'HeroComponent', []);
      expect(blockRegistry.get('hero')).toMatchObject({ name: 'hero', renderComponent: 'HeroComponent' });
    });

    it('throws ForbiddenException when blocks:register permission is missing', () => {
      const api = sandbox.buildSandboxedApi('id-1', makeManifest([]));
      expect(() => { api.registerBlockType('hero', 'HeroComponent', []); }).toThrow(ForbiddenException);
    });

    it('tags the block with the plugin name', () => {
      const api = sandbox.buildSandboxedApi('id-1', makeManifest(['blocks:register']));
      api.registerBlockType('card', 'CardComponent', []);
      expect(blockRegistry.get('card')?.pluginName).toBe('test-plugin');
    });
  });

  describe('registerRoute', () => {
    it('registers route when plugin has routes:register permission', () => {
      const api = sandbox.buildSandboxedApi('id-1', makeManifest(['routes:register']));
      const handler = jest.fn();
      api.registerRoute('GET', '/hello', handler);
      expect(routeRegistry.find('test-plugin', 'GET', '/hello')).toBeDefined();
    });

    it('throws ForbiddenException when routes:register permission is missing', () => {
      const api = sandbox.buildSandboxedApi('id-1', makeManifest([]));
      expect(() => { api.registerRoute('GET', '/hello', jest.fn()); }).toThrow(ForbiddenException);
    });

    it('stores pluginId on the route entry', () => {
      const api = sandbox.buildSandboxedApi('id-42', makeManifest(['routes:register']));
      api.registerRoute('POST', '/action', jest.fn());
      const match = routeRegistry.find('test-plugin', 'POST', '/action');
      expect(match?.pluginId).toBe('id-42');
    });
  });

  describe('error isolation in route handlers', () => {
    it('re-throws handler errors (controller catches and marks plugin error)', async () => {
      const api = sandbox.buildSandboxedApi('id-1', makeManifest(['routes:register']));
      api.registerRoute('GET', '/boom', () => { throw new Error('kaboom'); });
      const match = routeRegistry.find('test-plugin', 'GET', '/boom');
      if (!match) throw new Error('route not found');
      await expect(match.handler({}, undefined, {})).rejects.toThrow('kaboom');
    });
  });

  describe('checkRateLimit', () => {
    it('does nothing when redis client is not configured', async () => {
      await expect(sandbox.checkRateLimit('test-plugin')).resolves.toBeUndefined();
    });

    it('throws 429 when redis count exceeds limit', async () => {
      const mockRedis = {
        incr: jest.fn().mockResolvedValue(101),
        expire: jest.fn().mockResolvedValue(1),
      };
      const limitedSandbox = new PluginSandboxService(
        db as never,
        mockRedis as never,
        blockRegistry,
        routeRegistry,
      );
      await expect(limitedSandbox.checkRateLimit('test-plugin')).rejects.toThrow(
        new HttpException('', HttpStatus.TOO_MANY_REQUESTS).constructor as never,
      );
    });

    it('allows requests under the rate limit', async () => {
      const mockRedis = {
        incr: jest.fn().mockResolvedValue(50),
        expire: jest.fn().mockResolvedValue(1),
      };
      const limitedSandbox = new PluginSandboxService(
        db as never,
        mockRedis as never,
        blockRegistry,
        routeRegistry,
      );
      await expect(limitedSandbox.checkRateLimit('test-plugin')).resolves.toBeUndefined();
    });
  });

  describe('markPluginError', () => {
    it('updates plugin status to error in DB', async () => {
      await sandbox.markPluginError('id-99', 'test-plugin', new Error('oops'));
      expect(db.execute).toHaveBeenCalledWith(
        expect.stringContaining("STATUS = 'error'"),
        { id: 'id-99' },
      );
    });
  });
});

describe('BlockRegistry', () => {
  it('unregisters all blocks for a given plugin', () => {
    const registry = new BlockRegistry();
    registry.register({ name: 'a', renderComponent: 'A', settingsSchema: [], pluginName: 'plugin-x' });
    registry.register({ name: 'b', renderComponent: 'B', settingsSchema: [], pluginName: 'plugin-y' });
    registry.unregisterByPlugin('plugin-x');
    expect(registry.get('a')).toBeUndefined();
    expect(registry.get('b')).toBeDefined();
  });
});

describe('PluginRouteRegistry', () => {
  it('unregisters all routes for a given plugin', () => {
    const registry = new PluginRouteRegistry();
    registry.register('id-1', 'plugin-x', 'GET', '/foo', jest.fn());
    registry.register('id-2', 'plugin-y', 'GET', '/bar', jest.fn());
    registry.unregisterPlugin('plugin-x');
    expect(registry.find('plugin-x', 'GET', '/foo')).toBeUndefined();
    expect(registry.find('plugin-y', 'GET', '/bar')).toBeDefined();
  });

  it('returns undefined for unknown routes', () => {
    const registry = new PluginRouteRegistry();
    expect(registry.find('missing', 'GET', '/nope')).toBeUndefined();
  });
});
