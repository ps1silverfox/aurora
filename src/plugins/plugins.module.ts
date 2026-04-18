import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { PluginDiscoveryService } from './plugin-discovery.service';

@Module({
  imports: [DbModule],
  providers: [PluginDiscoveryService],
  exports: [PluginDiscoveryService],
})
export class PluginsModule {}
