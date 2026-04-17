import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { RolesService } from './roles.service';
import { RolesGuard } from './roles.guard';
import { UsersController } from './users.controller';

@Module({
  imports: [DbModule],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService, RolesService, RolesGuard],
  exports: [UsersService, RolesService, RolesGuard],
})
export class UsersModule {}
