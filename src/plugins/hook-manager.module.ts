import { Global, Module } from '@nestjs/common';
import { HookManager } from './hook-manager';

@Global()
@Module({
  providers: [HookManager],
  exports: [HookManager],
})
export class HookManagerModule {}
