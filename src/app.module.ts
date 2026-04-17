import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [DbModule.forRoot(), AuthModule, UsersModule, AuditModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
