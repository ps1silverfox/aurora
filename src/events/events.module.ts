import { Global, Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { OracleAqService } from './oracle-aq.service';
import { EVENT_PUBLISHER } from './event-publisher.interface';

@Global()
@Module({
  imports: [DbModule],
  providers: [
    OracleAqService,
    {
      provide: EVENT_PUBLISHER,
      useExisting: OracleAqService,
    },
  ],
  exports: [OracleAqService, EVENT_PUBLISHER],
})
export class EventsModule {}
