import { Test } from '@nestjs/testing';
import { HookManager } from './hook-manager';

async function buildManager(): Promise<HookManager> {
  const mod = await Test.createTestingModule({ providers: [HookManager] }).compile();
  return mod.get(HookManager);
}

describe('HookManager — actions', () => {
  it('fires registered action callback', async () => {
    const hm = await buildManager();
    const calls: string[] = [];
    hm.registerAction('content.published', () => { calls.push('a'); });
    await hm.doAction('content.published');
    expect(calls).toEqual(['a']);
  });

  it('fires multiple callbacks in priority order', async () => {
    const hm = await buildManager();
    const order: number[] = [];
    hm.registerAction('content.published', () => { order.push(2); }, 20);
    hm.registerAction('content.published', () => { order.push(1); }, 10);
    hm.registerAction('content.published', () => { order.push(3); }, 30);
    await hm.doAction('content.published');
    expect(order).toEqual([1, 2, 3]);
  });

  it('passes args to action callback', async () => {
    const hm = await buildManager();
    const received: unknown[] = [];
    hm.registerAction('api.request', (...args) => { received.push(...args); });
    await hm.doAction('api.request', 'foo', 42);
    expect(received).toEqual(['foo', 42]);
  });

  it('isolates error in one action — others still run', async () => {
    const hm = await buildManager();
    const calls: string[] = [];
    hm.registerAction('content.published', () => { throw new Error('boom'); }, 10);
    hm.registerAction('content.published', () => { calls.push('ok'); }, 20);
    await expect(hm.doAction('content.published')).resolves.toBeUndefined();
    expect(calls).toEqual(['ok']);
  });

  it('no-ops on unknown hook', async () => {
    const hm = await buildManager();
    await expect(hm.doAction('unknown.hook')).resolves.toBeUndefined();
  });
});

describe('HookManager — filters', () => {
  it('returns unmodified value when no filters registered', async () => {
    const hm = await buildManager();
    const result = await hm.applyFilters('content.render', 'hello');
    expect(result).toBe('hello');
  });

  it('pipes value through filter chain in priority order', async () => {
    const hm = await buildManager();
    hm.registerFilter('content.render', (v) => `${String(v)}-B`, 20);
    hm.registerFilter('content.render', (v) => `${String(v)}-A`, 10);
    const result = await hm.applyFilters('content.render', 'start');
    expect(result).toBe('start-A-B');
  });

  it('passes extra args to filter callbacks', async () => {
    const hm = await buildManager();
    hm.registerFilter('content.render', (v, ctx) => `${String(v)}-${String(ctx)}`);
    const result = await hm.applyFilters('content.render', 'x', 'ctx1');
    expect(result).toBe('x-ctx1');
  });

  it('isolates error in one filter — chain continues with last good value', async () => {
    const hm = await buildManager();
    hm.registerFilter('content.render', () => { throw new Error('bad filter'); }, 10);
    hm.registerFilter('content.render', (v) => `${String(v)}-safe`, 20);
    const result = await hm.applyFilters('content.render', 'init');
    expect(result).toBe('init-safe');
  });

  it('supports async filter callbacks', async () => {
    const hm = await buildManager();
    hm.registerFilter('content.render', async (v) => {
      await Promise.resolve();
      return `${String(v)}-async`;
    });
    const result = await hm.applyFilters('content.render', 'val');
    expect(result).toBe('val-async');
  });
});

describe('HookManager — removeAllHandlers', () => {
  it('removes actions and filters for a hook', async () => {
    const hm = await buildManager();
    const calls: string[] = [];
    hm.registerAction('content.published', () => { calls.push('action'); });
    hm.registerFilter('content.published', (v) => `${String(v)}-filtered`);
    hm.removeAllHandlers('content.published');
    await hm.doAction('content.published');
    const result = await hm.applyFilters('content.published', 'raw');
    expect(calls).toEqual([]);
    expect(result).toBe('raw');
  });
});
