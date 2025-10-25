import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingNumberService } from './services/booking-number.service';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { ErrorHandlerService } from '../common/services/error-handler.service';
import { VenueBookingsController } from './controllers/venue-bookings.controller';

@Module({
  imports: [PrismaModule, RedisModule, UsersModule],
  controllers: [BookingsController, VenueBookingsController],
  providers: [BookingsService, BookingNumberService, ErrorHandlerService],
  exports: [BookingsService, BookingNumberService],
})
export class BookingsModule {}
