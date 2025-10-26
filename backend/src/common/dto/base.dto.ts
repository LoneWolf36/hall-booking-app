import { IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BaseDto {
  @ApiProperty({ description: 'Unique identifier', example: 'uuid-v4' })
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @IsDateString()
  createdAt: string;

  @ApiProperty({ description: 'Last update timestamp' })
  @IsDateString()
  updatedAt: string;
}

export class PaginationDto {
  @ApiProperty({ description: 'Page number', example: 1, required: false })
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', example: 10, required: false })
  @IsOptional()
  limit?: number = 10;

  @ApiProperty({ description: 'Sort by field', required: false })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({ description: 'Sort direction', example: 'asc', required: false })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class ResponseDto<T> {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  data?: T;

  @ApiProperty()
  message?: string;

  @ApiProperty()
  timestamp: string;

  constructor(data?: T, message?: string, success: boolean = true) {
    this.success = success;
    this.data = data;
    this.message = message;
    this.timestamp = new Date().toISOString();
  }
}
