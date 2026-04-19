import { Injectable, Logger } from '@nestjs/common';

export type ActionCallback = (...args: unknown[]) => Promise<void> | void;
export type FilterCallback = (value: unknown, ...args: unknown[]) => unknown;

export const HOOK_POINTS = [
  'content.published',
  'content.render',
  'editor.block.register',
  'admin.menu.register',
  'api.request',
  'api.response',
] as const;

export type HookPoint = string;

interface ActionEntry {
  callback: ActionCallback;
  priority: number;
}

interface FilterEntry {
  callback: FilterCallback;
  priority: number;
}

@Injectable()
export class HookManager {
  private readonly logger = new Logger(HookManager.name);
  private readonly actions = new Map<string, ActionEntry[]>();
  private readonly filters = new Map<string, FilterEntry[]>();

  registerAction(hook: HookPoint, callback: ActionCallback, priority = 10): void {
    const entries = this.actions.get(hook) ?? [];
    entries.push({ callback, priority });
    entries.sort((a, b) => a.priority - b.priority);
    this.actions.set(hook, entries);
  }

  async doAction(hook: HookPoint, ...args: unknown[]): Promise<void> {
    const entries = this.actions.get(hook) ?? [];
    for (const { callback } of entries) {
      try {
        await callback(...args);
      } catch (err) {
        this.logger.error(`Hook action "${hook}" callback threw: ${String(err)}`);
      }
    }
  }

  registerFilter(hook: HookPoint, callback: FilterCallback, priority = 10): void {
    const entries = this.filters.get(hook) ?? [];
    entries.push({ callback, priority });
    entries.sort((a, b) => a.priority - b.priority);
    this.filters.set(hook, entries);
  }

  async applyFilters(hook: HookPoint, value: unknown, ...args: unknown[]): Promise<unknown> {
    const entries = this.filters.get(hook) ?? [];
    let current = value;
    for (const { callback } of entries) {
      try {
        current = await callback(current, ...args);
      } catch (err) {
        this.logger.error(`Hook filter "${hook}" callback threw: ${String(err)}`);
      }
    }
    return current;
  }

  removeAllHandlers(hook: HookPoint): void {
    this.actions.delete(hook);
    this.filters.delete(hook);
  }
}
