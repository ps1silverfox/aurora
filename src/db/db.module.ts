import { DynamicModule, Global, Module } from '@nestjs/common';
import { CsvDriver } from './csv.driver';
import { DB_SERVICE } from './db.interface';
import { OracleDriver } from './oracle.driver';

@Global()
@Module({})
export class DbModule {
  static forRoot(): DynamicModule {
    const driverClass =
      process.env['DB_DRIVER'] === 'oracle' ? OracleDriver : CsvDriver;

    return {
      module: DbModule,
      global: true,
      providers: [{ provide: DB_SERVICE, useClass: driverClass }],
      exports: [DB_SERVICE],
    };
  }
}
