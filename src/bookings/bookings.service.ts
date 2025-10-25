import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { ErrorHandlerService } from '../common/services/error-handler.service';
import { BookingNumberService } from './services/booking-number.service';
import { AvailabilityService } from './services/availability.service';
import { CreateBookingDto, BookingStatus, PaymentStatus, BookingTimeRangeDto } from './dto/create-booking.dto';
import { BookingResponseDto, AvailabilityResponseDto, CreateBookingResponseDto } from './dto/booking-response.dto';
import { UserRole } from '../users/dto/create-user.dto';
import { Venue } from '@prisma/client';

// ... existing imports and class header retained
