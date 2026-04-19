import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PluginLifecycleService } from './plugin-lifecycle.service';
import { Plugin } from './plugin.entity';

@Controller('api/v1/plugins')
export class PluginsController {
  constructor(private readonly lifecycle: PluginLifecycleService) {}

  @Get()
  async list(): Promise<Plugin[]> {
    return this.lifecycle.listAll();
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id') id: string): Promise<Plugin> {
    return this.lifecycle.activate(id);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id') id: string): Promise<Plugin> {
    return this.lifecycle.deactivate(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async uninstall(@Param('id') id: string): Promise<void> {
    return this.lifecycle.uninstall(id);
  }
}
