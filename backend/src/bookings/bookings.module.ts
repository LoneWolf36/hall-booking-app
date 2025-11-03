import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingNumberService } from './services/booking-number.service';
import { BookingStateMachineService } from './services/state-machine.service';
import { BookingExpiryJob } from './jobs/booking-expiry.job';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { ErrorHandlerService } from '../common/services/error-handler.service';
import { CacheService } from '../common/services/cache.service';
import { ValidationService } from '../common/services/validation.service';
import { VenueBookingsController } from './controllers/venue-bookings.controller';
import { AvailabilitySlotsController } from './availability-slots.controller';
import { AvailabilityService } from './services/availability.service';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    UsersModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [BookingsController, VenueBookingsController, AvailabilitySlotsController],
  providers: [
    BookingsService,
    BookingNumberService,
    AvailabilityService,
    BookingStateMachineService,
    BookingExpiryJob,
    ErrorHandlerService,
    CacheService,
    ValidationService,
  ],
  exports: [
    BookingsService,
    BookingNumberService,
    AvailabilityService,
    BookingStateMachineService,
    CacheService,
    ValidationService,
  ],
})
export class BookingsModule {}
