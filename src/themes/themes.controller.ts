import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  HttpCode,
  ParseIntPipe,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IsObject } from 'class-validator';
import { ThemeService } from './theme.service';
import { RendererService } from './renderer.service';
import { RolesGuard } from '../users/roles.guard';
import { Roles } from '../users/roles.decorator';

class UpdateThemeSettingsDto {
  @IsObject()
  settings!: Record<string, unknown>;
}

@Controller('api/v1/themes')
@UseGuards(RolesGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class ThemesController {
  constructor(
    private readonly themeService: ThemeService,
    private readonly rendererService: RendererService,
  ) {}

  @Get()
  @Roles('admin.themes.read')
  async list() {
    return this.themeService.discover();
  }

  @Put(':id/activate')
  @Roles('admin.themes.manage')
  @HttpCode(204)
  async activate(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.themeService.activate(id);
    const active = await this.themeService.getActive();
    if (active) {
      this.rendererService.invalidateCache(active.slug);
    }
  }

  @Get(':id/settings')
  @Roles('admin.themes.read')
  async getSettings(@Param('id', ParseIntPipe) id: number) {
    return this.themeService.getSettings(id);
  }

  @Put(':id/settings')
  @Roles('admin.themes.manage')
  async updateSettings(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateThemeSettingsDto,
  ) {
    await this.themeService.updateSettings(id, dto.settings);
    const active = await this.themeService.getActive();
    if (active?.id === id) {
      this.rendererService.invalidateCache(active.slug);
    }
    return this.themeService.getSettings(id);
  }
}

export { UpdateThemeSettingsDto };
