import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { ThemeService } from './theme.service';
import { RendererService } from './renderer.service';

@Module({
  imports: [DbModule],
  providers: [ThemeService, RendererService],
  exports: [ThemeService, RendererService],
})
export class ThemesModule {}
