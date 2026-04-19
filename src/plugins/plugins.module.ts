import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { ContentModule } from '../content/content.module';
import { AuditModule } from '../audit/audit.module';
import { PluginDiscoveryService } from './plugin-discovery.service';
import { PluginLifecycleService } from './plugin-lifecycle.service';
import { PluginSandboxService } from './plugin-sandbox.service';
import { BlockRegistry } from './block-registry';
import { PluginRouteRegistry } from './plugin-route-registry';
import { PluginsController } from './plugins.controller';

@Module({
  imports: [DbModule, ContentModule, AuditModule],
  controllers: [PluginsController],
  providers: [
    PluginDiscoveryService,
    PluginLifecycleService,
    PluginSandboxService,
    BlockRegistry,
    PluginRouteRegistry,
  ],
  exports: [PluginDiscoveryService, PluginLifecycleService, BlockRegistry, PluginRouteRegistry],
})
export class PluginsModule {}
