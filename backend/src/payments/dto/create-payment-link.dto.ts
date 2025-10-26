import {
  IsString,
  IsUUID,
  IsOptional,
  IsInt,
  Min,
  IsUrl,
  IsDateString,
  IsObject,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for creating Razorpay payment links
 * Designed to integrate seamlessly with booking workflow
 */
export class CreatePaymentLinkDto {
  @ApiProperty({
    description: 'Booking ID for which payment link is being created',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid'
  })
  @IsUUID(4, { message: 'Booking ID must be a valid UUID' })
  bookingId: string;

  @ApiProperty({
    description: 'Payment amount in cents (paise for INR)',
    example: 5000000,
    minimum: 100
  })
  @IsInt()
  @Min(100, { message: 'Amount must be at least ₹1 (100 paise)' })
  amountCents: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'INR',
    default: 'INR'
  })
  @IsString()
  currency: string = 'INR';

  @ApiProperty({
    description: 'Payment link description',
    example: 'Payment for Hall Booking #HB-2024-001',
    required: false
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Customer name for payment',
    example: 'John Doe'
  })
  @IsString()
  customerName: string;

  @ApiProperty({
    description: 'Customer phone number',
    example: '+919876543210'
  })
  @IsString()
  customerPhone: string;

  @ApiProperty({
    description: 'Customer email (optional)',
    example: 'john.doe@example.com',
    required: false
  })
  @IsOptional()
  @IsString()
  customerEmail?: string;

  @ApiProperty({
    description: 'Payment link expiry time (ISO 8601)',
    example: '2024-12-25T15:00:00.000Z',
    format: 'date-time',
    required: false
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiProperty({
    description: 'Success callback URL',
    example: 'https://yourdomain.com/payment/success',
    required: false
  })
  @IsOptional()
  @IsUrl()
  callbackUrl?: string;

  @ApiProperty({
    description: 'Cancel callback URL',
    example: 'https://yourdomain.com/payment/cancel',
    required: false
  })
  @IsOptional()
  @IsUrl()
  cancelUrl?: string;

  @ApiProperty({
    description: 'Additional metadata for the payment',
    example: { venueId: 'venue-123', eventType: 'wedding' },
    required: false
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * Response DTO for payment link creation
 */
export class PaymentLinkResponseDto {
  @ApiProperty({
    description: 'Payment link ID from Razorpay',
    example: 'plink_KKBLjhmrasdf23'
  })
  id: string;

  @ApiProperty({
    description: 'Payment link URL',
    example: 'https://rzp.io/i/KKBLjhmr'
  })
  shortUrl: string;

  @ApiProperty({
    description: 'Payment amount in cents',
    example: 5000000
  })
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'INR'
  })
  currency: string;

  @ApiProperty({
    description: 'Payment status',
    example: 'created'
  })
  status: string;

  @ApiProperty({
    description: 'Payment link expiry timestamp',
    example: '2024-12-25T15:00:00.000Z'
  })
  expireBy: Date;

  @ApiProperty({
    description: 'Internal payment record ID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  paymentId: string;

  @ApiProperty({
    description: 'Associated booking ID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  bookingId: string;

  @ApiProperty({
    description: 'Minutes until expiry',
    example: 15
  })
  expiresInMinutes: number;
}

/**
 * Webhook payload DTO for Razorpay webhook events
 */
export class RazorpayWebhookDto {
  @ApiProperty({
    description: 'Webhook event type',
    example: 'payment_link.paid'
  })
  event: string;

  @ApiProperty({
    description: 'Webhook payload data'
  })
  payload: {
    payment_link: {
      entity: any;
    };
    payment?: {
      entity: any;
    };
  };

  @ApiProperty({
    description: 'Webhook creation timestamp',
    example: 1640995200
  })
  created_at: number;
}