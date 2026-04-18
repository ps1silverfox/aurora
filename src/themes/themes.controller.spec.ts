import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ThemesController } from './themes.controller';
import { ThemeService } from './theme.service';
import { RendererService } from './renderer.service';
import { RolesGuard } from '../users/roles.guard';
import { Theme } from './theme.entity';

const mockTheme: Theme = {
  id: 1,
  name: 'Aurora Default',
  slug: 'aurora-default',
  path: '/themes/aurora-default',
  isActive: true,
  settings: { primaryColor: '#0066cc' },
  createdAt: new Date('2024-01-01'),
};

const mockThemeService = {
  discover: jest.fn(),
  activate: jest.fn(),
  getActive: jest.fn(),
  getSettings: jest.fn(),
  updateSettings: jest.fn(),
};

const mockRendererService = {
  invalidateCache: jest.fn(),
};

describe('ThemesController', () => {
  let controller: ThemesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ThemesController],
      providers: [
        { provide: ThemeService, useValue: mockThemeService },
        { provide: RendererService, useValue: mockRendererService },
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ThemesController);
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('returns discovered themes', async () => {
      mockThemeService.discover.mockResolvedValue([mockTheme]);
      const result = await controller.list();
      expect(result).toEqual([mockTheme]);
      expect(mockThemeService.discover).toHaveBeenCalled();
    });

    it('returns empty array when no themes', async () => {
      mockThemeService.discover.mockResolvedValue([]);
      expect(await controller.list()).toEqual([]);
    });
  });

  describe('activate', () => {
    it('activates a theme and invalidates renderer cache', async () => {
      mockThemeService.activate.mockResolvedValue(undefined);
      mockThemeService.getActive.mockResolvedValue(mockTheme);

      await controller.activate(1);

      expect(mockThemeService.activate).toHaveBeenCalledWith(1);
      expect(mockRendererService.invalidateCache).toHaveBeenCalledWith('aurora-default');
    });

    it('does not invalidate cache when no active theme after activation', async () => {
      mockThemeService.activate.mockResolvedValue(undefined);
      mockThemeService.getActive.mockResolvedValue(null);

      await controller.activate(1);

      expect(mockRendererService.invalidateCache).not.toHaveBeenCalled();
    });
  });

  describe('getSettings', () => {
    it('returns theme settings', async () => {
      mockThemeService.getSettings.mockResolvedValue({ primaryColor: '#0066cc' });
      const result = await controller.getSettings(1);
      expect(result).toEqual({ primaryColor: '#0066cc' });
    });

    it('propagates NotFoundException from service', async () => {
      mockThemeService.getSettings.mockRejectedValue(new NotFoundException('Theme 99 not found'));
      await expect(controller.getSettings(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSettings', () => {
    it('updates settings and returns new settings', async () => {
      const newSettings = { primaryColor: '#ff0000' };
      mockThemeService.updateSettings.mockResolvedValue(undefined);
      mockThemeService.getActive.mockResolvedValue(mockTheme);
      mockThemeService.getSettings.mockResolvedValue(newSettings);

      const result = await controller.updateSettings(1, { settings: newSettings });

      expect(mockThemeService.updateSettings).toHaveBeenCalledWith(1, newSettings);
      expect(result).toEqual(newSettings);
    });

    it('invalidates renderer cache when updated theme is active', async () => {
      mockThemeService.updateSettings.mockResolvedValue(undefined);
      mockThemeService.getActive.mockResolvedValue(mockTheme);
      mockThemeService.getSettings.mockResolvedValue({});

      await controller.updateSettings(1, { settings: {} });

      expect(mockRendererService.invalidateCache).toHaveBeenCalledWith('aurora-default');
    });

    it('does not invalidate cache when updated theme is not active', async () => {
      mockThemeService.updateSettings.mockResolvedValue(undefined);
      mockThemeService.getActive.mockResolvedValue({ ...mockTheme, id: 2 });
      mockThemeService.getSettings.mockResolvedValue({});

      await controller.updateSettings(1, { settings: {} });

      expect(mockRendererService.invalidateCache).not.toHaveBeenCalled();
    });
  });
});
