import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  UsePipes,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types';
import { ValidationError } from '../common/errors';

@Controller('api/v1/users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('admin.users.read')
  async list(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const pageSize = limit != null ? parseInt(limit, 10) : 20;
    if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new ValidationError('limit must be between 1 and 100');
    }
    return this.usersService.list(cursor ?? null, pageSize);
  }

  @Get(':id')
  @Roles('admin.users.read')
  async findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Put(':id/role')
  @Roles('admin.users.manage')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async assignRole(
    @Param('id') targetUserId: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.assignRole(actor.id, targetUserId, dto.roleId);
  }
}
