import { IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for Redis SET operations
 * Ensures proper validation of value and TTL parameters
 */
export class RedisSetDto {
  @ApiProperty({
    description: 'The value to store in Redis',
    example: 'Hello World',
    required: true
  })
  @IsNotEmpty({ message: 'Value is required' })
  value: any;

  @ApiProperty({
    description: 'Time-to-live in seconds (optional)',
    example: 3600,
    minimum: 1,
    required: false
  })
  @IsOptional()
  @IsNumber({}, { message: 'TTL must be a number' })
  @Min(1, { message: 'TTL must be at least 1 second' })
  @Type(() => Number)
  ttl?: number;
}