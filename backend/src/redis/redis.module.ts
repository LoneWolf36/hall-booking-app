import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisTestController } from './redis.controller';
import { CacheService } from '../common/services/cache.service';

@Global() // Makes RedisService and CacheService available everywhere without importing
@Module({
  controllers: [RedisTestController],
  providers: [RedisService, CacheService],
  exports: [RedisService, CacheService],
})
export class RedisModule {}
