import { IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for Redis SET operations
 * Ensures proper validation of value and TTL parameters
 */
export class RedisSetDto {
  @IsNotEmpty({ message: 'Value is required' })
  value: any;

  @IsOptional()
  @IsNumber({}, { message: 'TTL must be a number' })
  @Min(1, { message: 'TTL must be at least 1 second' })
  @Type(() => Number)
  ttl?: number;
}
