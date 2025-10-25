import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisTestController } from './redis.controller';

@Global() // Makes RedisService available everywhere without importing
@Module({
  controllers: [RedisTestController],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
