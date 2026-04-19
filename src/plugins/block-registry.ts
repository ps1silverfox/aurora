import { Injectable } from '@nestjs/common';
import { PluginSettingSchema } from './plugin.entity';

export interface BlockTypeDefinition {
  name: string;
  renderComponent: string;
  settingsSchema: PluginSettingSchema[];
  pluginName: string;
}

@Injectable()
export class BlockRegistry {
  private readonly blocks = new Map<string, BlockTypeDefinition>();

  register(def: BlockTypeDefinition): void {
    this.blocks.set(def.name, def);
  }

  getAll(): BlockTypeDefinition[] {
    return Array.from(this.blocks.values());
  }

  get(name: string): BlockTypeDefinition | undefined {
    return this.blocks.get(name);
  }

  unregisterByPlugin(pluginName: string): void {
    for (const [key, def] of this.blocks) {
      if (def.pluginName === pluginName) this.blocks.delete(key);
    }
  }
}
