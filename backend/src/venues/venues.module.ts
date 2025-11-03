import { Module } from '@nestjs/common';
import { VenuesController } from './venues.controller';
import { VenuesService } from './venues.service';
import { VenueTimeslotsController } from './venue-timeslots.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VenuesController, VenueTimeslotsController],
  providers: [VenuesService],
  exports: [VenuesService],
})
export class VenuesModule {}