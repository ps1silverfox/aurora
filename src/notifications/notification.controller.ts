import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../users/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types';
import { NotificationService } from './notification.service';
import { ValidationError } from '../common/errors';

@Controller('api/v1/notifications')
@UseGuards(RolesGuard)
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    const pageSize = limit != null ? parseInt(limit, 10) : 20;
    if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new ValidationError('limit must be between 1 and 100');
    }
    return this.notifications.list(user.id, pageSize);
  }

  @Patch(':id/read')
  async markRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.notifications.markRead(id, user.id);
    return { ok: true };
  }
}
