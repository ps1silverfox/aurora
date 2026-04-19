import {
  All,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { PluginLifecycleService } from './plugin-lifecycle.service';
import { Plugin } from './plugin.entity';
import { BlockRegistry, BlockTypeDefinition } from './block-registry';
import { PluginRouteRegistry } from './plugin-route-registry';
import { PluginSandboxService } from './plugin-sandbox.service';

@Controller('api/v1/plugins')
export class PluginsController {
  constructor(
    private readonly lifecycle: PluginLifecycleService,
    private readonly blockRegistry: BlockRegistry,
    private readonly routeRegistry: PluginRouteRegistry,
    private readonly sandbox: PluginSandboxService,
  ) {}

  @Get()
  async list(): Promise<Plugin[]> {
    return this.lifecycle.listAll();
  }

  @Get('blocks')
  listBlocks(): BlockTypeDefinition[] {
    return this.blockRegistry.getAll();
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<Plugin> {
    return this.lifecycle.getById(id);
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

  @Get(':id/settings')
  async getSettings(@Param('id') id: string): Promise<Record<string, string>> {
    return this.lifecycle.getSettings(id);
  }

  @Put(':id/settings')
  async updateSettings(
    @Param('id') id: string,
    @Body() body: Record<string, string>,
  ): Promise<Record<string, string>> {
    return this.lifecycle.updateSettings(id, body);
  }

  // Dynamic plugin routes — must be declared last so specific routes above win
  @All(':pluginName/*')
  async handlePluginRoute(
    @Param('pluginName') pluginName: string,
    @Req() req: Request,
    @Body() body: unknown,
    @Query() query: Record<string, string>,
  ): Promise<unknown> {
    await this.sandbox.checkRateLimit(pluginName);

    // Extract sub-path: everything after /api/v1/plugins/:pluginName/
    const prefix = `/api/v1/plugins/${pluginName}/`;
    const rawPath = req.path;
    const subPath = '/' + rawPath.slice(rawPath.indexOf(prefix) + prefix.length);

    const match = this.routeRegistry.find(pluginName, req.method, subPath);
    if (!match) {
      throw new NotFoundException(
        `No plugin route registered: ${req.method} ${pluginName}${subPath}`,
      );
    }

    try {
      return await match.handler({}, body, query);
    } catch (err) {
      await this.sandbox.markPluginError(match.pluginId, pluginName, err);
      throw new InternalServerErrorException(
        `Plugin "${pluginName}" route handler failed`,
      );
    }
  }
}
