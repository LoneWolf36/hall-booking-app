import { Module } from '@nestjs/common';
import { VenuesModule } from './venues.module';
import { VenueTimeslotsController } from './venue-timeslots.controller';
import { VenueTimeslotsService } from './venue-timeslots.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, VenuesModule],
  controllers: [VenueTimeslotsController],
  providers: [VenueTimeslotsService],
  exports: [VenueTimeslotsService],
})
export class VenueTimeslotsModule {}
