import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { BUSINESS_CONSTANTS, CACHE_PREFIXES } from '../../common/constants/app.constants';

/**
 * Booking Number Generation Service - Refactored to use centralized services
 * 
 * Now uses:
 * - CacheService for consistent caching operations
 * - Centralized constants from app.constants.ts
 * - Eliminates hardcoded values and duplicate cache logic
 */
@Injectable()
export class BookingNumberService {
  private readonly logger = new Logger(BookingNumberService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Generate next booking number for tenant
   */
  async generateBookingNumber(tenantId: string): Promise<string> {
    try {
      const year = new Date().getFullYear();
      const prefix = await this.getTenantPrefix(tenantId);
      
      // Try atomic sequence generation first
      const sequence = await this.getNextSequenceFromCache(tenantId, year);
      
      if (sequence) {
        const bookingNumber = this.formatBookingNumber(prefix, year, sequence);
        this.logger.log(`Generated booking number ${bookingNumber} for tenant ${tenantId}`);
        return bookingNumber;
      }
      
      // Fallback to database if cache fails
      this.logger.warn('Cache unavailable, falling back to database sequence generation');
      return await this.generateFromDatabase(tenantId, prefix, year);
      
    } catch (error) {
      this.logger.error('Failed to generate booking number', error);
      throw new InternalServerErrorException('Unable to generate booking number');
    }
  }

  /**
   * Get next sequence number using centralized cache service
   */
  private async getNextSequenceFromCache(tenantId: string, year: number): Promise<number | null> {
    try {
      const cacheKey = `${CACHE_PREFIXES.BOOKING_SEQUENCE}:${tenantId}:${year}`;
      
      // Use CacheService instead of direct Redis calls
      const currentSequence = await this.cacheService.get<number>(cacheKey);
      const nextSequence = (currentSequence || 0) + 1;
      
      // Calculate TTL until end of year
      const nextYear = new Date(`${year + 1}-01-01`);
      const ttlSeconds = Math.floor((nextYear.getTime() - Date.now()) / 1000);
      
      // Cache the new sequence with TTL
      await this.cacheService.set(cacheKey, nextSequence, ttlSeconds);
      
      if (nextSequence === 1) {
        this.logger.log(`Initialized booking sequence for tenant ${tenantId}, year ${year}`);
      }
      
      return nextSequence;
      
    } catch (error) {
      this.logger.warn('Cache sequence generation failed', error);
      return null;
    }
  }

  /**
   * Fallback sequence generation using database
   */
  private async generateFromDatabase(
    tenantId: string,
    prefix: string,
    year: number,
  ): Promise<string> {
    return await this.prisma.$transaction(async (tx) => {
      // Find the highest booking number for this tenant and year
      const lastBooking = await tx.booking.findFirst({
        where: {
          tenantId,
          bookingNumber: {
            startsWith: `${prefix}-${year}-`,
          },
        },
        orderBy: {
          bookingNumber: 'desc',
        },
        select: {
          bookingNumber: true,
        },
      });

      let nextSequence = 1;
      
      if (lastBooking) {
        const lastSequence = this.extractSequenceFromBookingNumber(lastBooking.bookingNumber);
        nextSequence = lastSequence + 1;
      }

      // Sync cache with database value for future requests
      await this.syncCacheSequence(tenantId, year, nextSequence);
      
      return this.formatBookingNumber(prefix, year, nextSequence);
    });
  }

  /**
   * Sync cache counter with database value using CacheService
   */
  private async syncCacheSequence(
    tenantId: string,
    year: number,
    sequence: number,
  ): Promise<void> {
    try {
      const cacheKey = `${CACHE_PREFIXES.BOOKING_SEQUENCE}:${tenantId}:${year}`;
      
      // Calculate TTL until end of year
      const nextYear = new Date(`${year + 1}-01-01`);
      const ttlSeconds = Math.floor((nextYear.getTime() - Date.now()) / 1000);
      
      await this.cacheService.set(cacheKey, sequence, ttlSeconds);
      
      this.logger.log(`Synced cache sequence to ${sequence} for tenant ${tenantId}, year ${year}`);
      
    } catch (error) {
      this.logger.warn('Failed to sync cache sequence', error);
      // Non-critical error - continue without cache sync
    }
  }

  /**
   * Get tenant prefix using centralized constants
   */
  private async getTenantPrefix(tenantId: string): Promise<string> {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
      
      if (tenant?.name) {
        const cleanName = tenant.name.replace(/[^a-zA-Z]/g, '');
        return cleanName.substring(0, 3).toUpperCase() || BUSINESS_CONSTANTS.DEFAULT_VENUE_PREFIX;
      }
      
      return BUSINESS_CONSTANTS.DEFAULT_VENUE_PREFIX;
      
    } catch (error) {
      this.logger.warn('Failed to get tenant prefix, using default', error);
      return BUSINESS_CONSTANTS.DEFAULT_VENUE_PREFIX;
    }
  }

  /**
   * Format booking number using centralized constants
   */
  private formatBookingNumber(prefix: string, year: number, sequence: number): string {
    const paddedSequence = sequence.toString().padStart(
      BUSINESS_CONSTANTS.BOOKING_NUMBER_SEQUENCE_LENGTH,
      '0'
    );
    return `${prefix}-${year}-${paddedSequence}`;
  }

  /**
   * Extract sequence number from existing booking number
   */
  private extractSequenceFromBookingNumber(bookingNumber: string): number {
    const parts = bookingNumber.split('-');
    if (parts.length === 3) {
      const sequence = parseInt(parts[2], 10);
      return isNaN(sequence) ? 0 : sequence;
    }
    return 0;
  }

  /**
   * Validate booking number format using centralized constants
   */
  public validateBookingNumberFormat(bookingNumber: string): boolean {
    const sequenceLength = BUSINESS_CONSTANTS.BOOKING_NUMBER_SEQUENCE_LENGTH;
    const pattern = new RegExp(`^[A-Z]{3}-\\d{4}-\\d{${sequenceLength}}$`);
    return pattern.test(bookingNumber);
  }

  /**
   * Parse booking number into components
   */
  public parseBookingNumber(bookingNumber: string): {
    prefix: string;
    year: number;
    sequence: number;
  } | null {
    if (!this.validateBookingNumberFormat(bookingNumber)) {
      return null;
    }
    
    const [prefix, yearStr, sequenceStr] = bookingNumber.split('-');
    
    return {
      prefix,
      year: parseInt(yearStr, 10),
      sequence: parseInt(sequenceStr, 10),
    };
  }

  /**
   * Reset sequence counter using CacheService
   */
  public async resetSequence(tenantId: string, year: number): Promise<void> {
    const cacheKey = `${CACHE_PREFIXES.BOOKING_SEQUENCE}:${tenantId}:${year}`;
    
    // Use CacheService's invalidation method if available, or direct key deletion
    try {
      // For now, we'll set to 0 since we don't have a delete method in CacheService
      await this.cacheService.set(cacheKey, 0, 1); // 1 second TTL to effectively delete
      this.logger.log(`Reset booking sequence for tenant ${tenantId}, year ${year}`);
    } catch (error) {
      this.logger.warn('Failed to reset sequence', error);
    }
  }
}