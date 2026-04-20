import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { VariantService } from './variant.service';
import { VariantJob } from './variant.job';
import { LocalStorageDriver } from './storage/local.driver';
import { S3StorageDriver } from './storage/s3.driver';
import { STORAGE_DRIVER } from './storage/storage.interface';

@Module({
  imports: [DbModule, AuditModule, UsersModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    VariantService,
    VariantJob,
    {
      provide: STORAGE_DRIVER,
      useFactory: () => {
        if (process.env.STORAGE_DRIVER === 's3') return new S3StorageDriver();
        return new LocalStorageDriver();
      },
    },
  ],
  exports: [MediaService, VariantService, VariantJob],
})
export class MediaModule {}
