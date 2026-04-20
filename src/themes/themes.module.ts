import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { ContentModule } from '../content/content.module';
import { UsersModule } from '../users/users.module';
import { ThemeService } from './theme.service';
import { RendererService } from './renderer.service';
import { ThemesController } from './themes.controller';
import { SsrController } from './ssr.controller';

@Module({
  imports: [DbModule, ContentModule, UsersModule],
  controllers: [ThemesController, SsrController],
  providers: [ThemeService, RendererService],
  exports: [ThemeService, RendererService],
})
export class ThemesModule {}
