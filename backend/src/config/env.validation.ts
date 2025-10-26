import { IsString, IsNumber, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class EnvironmentVariables {
    @IsString()
    DATABASE_URL: string;

    @IsString()
    REDIS_URL: string;

    @IsString()
    JWT_SECRET: string;

    @Transform(({ value }) => parseInt(value))
    @IsNumber()
    @IsOptional()
    PORT?: number = 3000;

    @IsString()
    RAZORPAY_KEY_ID: string;

    @IsString()
    RAZORPAY_KEY_SECRET: string;
}