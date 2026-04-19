import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { ContentModule } from '../content/content.module';
import { AuditModule } from '../audit/audit.module';
import { PluginDiscoveryService } from './plugin-discovery.service';
import { PluginLifecycleService } from './plugin-lifecycle.service';
import { PluginsController } from './plugins.controller';

@Module({
  imports: [DbModule, ContentModule, AuditModule],
  controllers: [PluginsController],
  providers: [PluginDiscoveryService, PluginLifecycleService],
  exports: [PluginDiscoveryService, PluginLifecycleService],
})
export class PluginsModule {}
