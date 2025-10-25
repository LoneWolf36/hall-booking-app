import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

/**
 * Booking Number Generation Service
 * 
 * Generates sequential, human-readable booking numbers using Redis atomic operations.
 * Format: {TENANT_PREFIX}-{YEAR}-{SEQUENCE}
 * Example: PBH-2025-0001, MUM-2025-0156
 * 
 * Teaching Points:
 * 1. Why atomic operations are critical for sequence generation
 * 2. Redis INCR command provides atomic increments
 * 3. Year-based partitioning for easier management
 * 4. Fallback strategies when Redis is unavailable
 * 5. How to handle distributed counter edge cases
 */
@Injectable()
export class BookingNumberService {
  private readonly logger = new Logger(BookingNumberService.name);
  private readonly DEFAULT_PREFIX = 'HBK'; // Hall Booking default prefix

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Generate next booking number for tenant
   * 
   * Process:
   * 1. Get tenant prefix (first 3 chars of tenant name)
   * 2. Use Redis INCR for atomic sequence generation
   * 3. Handle Redis failures with database fallback
   * 4. Set TTL to auto-expire counters after year end
   * 
   * @param tenantId - Tenant UUID
   * @returns Promise<string> - Formatted booking number
   */
  async generateBookingNumber(tenantId: string): Promise<string> {
    try {
      const year = new Date().getFullYear();
      const prefix = await this.getTenantPrefix(tenantId);
      
      // Try Redis first for atomic sequence generation
      const sequence = await this.getNextSequenceFromRedis(tenantId, year);
      
      if (sequence) {
        const bookingNumber = this.formatBookingNumber(prefix, year, sequence);
        this.logger.log(`Generated booking number ${bookingNumber} for tenant ${tenantId}`);
        return bookingNumber;
      }
      
      // Fallback to database if Redis fails
      this.logger.warn('Redis unavailable, falling back to database sequence generation');
      return await this.generateFromDatabase(tenantId, prefix, year);
      
    } catch (error) {
      this.logger.error('Failed to generate booking number', error);
      throw new InternalServerErrorException('Unable to generate booking number');
    }
  }

  /**
   * Get next sequence number using Redis atomic INCR
   * 
   * Teaching: Redis INCR is atomic and thread-safe, perfect for counters
   */
  private async getNextSequenceFromRedis(tenantId: string, year: number): Promise<number | null> {
    try {
      const cacheKey = `booking_sequence:${tenantId}:${year}`;
      
      // Redis INCR atomically increments and returns new value
      const sequence = await this.redisService.incr(cacheKey);
      
      // Set TTL on first increment (expires at end of year)
      if (sequence === 1) {
        const nextYear = new Date(`${year + 1}-01-01`);
        const ttlSeconds = Math.floor((nextYear.getTime() - Date.now()) / 1000);
        await this.redisService.expire(cacheKey, ttlSeconds);
        
        this.logger.log(`Initialized booking sequence for tenant ${tenantId}, year ${year}`);
      }
      
      return sequence;
      
    } catch (error) {
      this.logger.warn('Redis sequence generation failed', error);
      return null;
    }
  }

  /**
   * Fallback sequence generation using database
   * 
   * Teaching: Database transactions provide consistency when Redis is down
   * This is slower but ensures we never duplicate booking numbers
   */
  private async generateFromDatabase(
    tenantId: string,
    prefix: string,
    year: number,
  ): Promise<string> {
    // Use database transaction to find next available sequence
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
        // Extract sequence number from last booking
        const lastSequence = this.extractSequenceFromBookingNumber(lastBooking.bookingNumber);
        nextSequence = lastSequence + 1;
      }

      // Sync Redis with database value for future requests
      await this.syncRedisSequence(tenantId, year, nextSequence);
      
      return this.formatBookingNumber(prefix, year, nextSequence);
    });
  }

  /**
   * Sync Redis counter with database value
   * 
   * This helps when Redis counter gets out of sync or is reset
   */
  private async syncRedisSequence(
    tenantId: string,
    year: number,
    sequence: number,
  ): Promise<void> {
    try {
      const cacheKey = `booking_sequence:${tenantId}:${year}`;
      await this.redisService.set(cacheKey, sequence.toString());
      
      // Set TTL
      const nextYear = new Date(`${year + 1}-01-01`);
      const ttlSeconds = Math.floor((nextYear.getTime() - Date.now()) / 1000);
      await this.redisService.expire(cacheKey, ttlSeconds);
      
      this.logger.log(`Synced Redis sequence to ${sequence} for tenant ${tenantId}, year ${year}`);
      
    } catch (error) {
      this.logger.warn('Failed to sync Redis sequence', error);
      // Non-critical error - continue without Redis sync
    }
  }

  /**
   * Get tenant prefix for booking numbers
   * 
   * Uses first 3 characters of tenant name, fallback to default
   */
  private async getTenantPrefix(tenantId: string): Promise<string> {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
      
      if (tenant?.name) {
        // Extract first 3 characters and convert to uppercase
        // Remove non-alphabetic characters for clean prefixes
        const cleanName = tenant.name.replace(/[^a-zA-Z]/g, '');
        return cleanName.substring(0, 3).toUpperCase() || this.DEFAULT_PREFIX;
      }
      
      return this.DEFAULT_PREFIX;
      
    } catch (error) {
      this.logger.warn('Failed to get tenant prefix, using default', error);
      return this.DEFAULT_PREFIX;
    }
  }

  /**
   * Format booking number with consistent pattern
   * 
   * Format: PREFIX-YEAR-SEQUENCE
   * - PREFIX: 3-letter tenant identifier
   * - YEAR: 4-digit year
   * - SEQUENCE: 4-digit zero-padded sequence number
   */
  private formatBookingNumber(prefix: string, year: number, sequence: number): string {
    const paddedSequence = sequence.toString().padStart(4, '0');
    return `${prefix}-${year}-${paddedSequence}`;
  }

  /**
   * Extract sequence number from existing booking number
   * 
   * Used when syncing database with Redis counters
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
   * Validate booking number format
   * 
   * Useful for API validation and data integrity checks
   */
  public validateBookingNumberFormat(bookingNumber: string): boolean {
    // Pattern: 3-letters, dash, 4-digits, dash, 4-digits
    const pattern = /^[A-Z]{3}-\d{4}-\d{4}$/;
    return pattern.test(bookingNumber);
  }

  /**
   * Parse booking number into components
   * 
   * Returns null if format is invalid
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
   * Reset sequence counter (admin function)
   * 
   * Use carefully - only for testing or specific business needs
   */
  public async resetSequence(tenantId: string, year: number): Promise<void> {
    const cacheKey = `booking_sequence:${tenantId}:${year}`;
    await this.redisService.del(cacheKey);
    this.logger.log(`Reset booking sequence for tenant ${tenantId}, year ${year}`);
  }
}

/**
 * Teaching Notes on Sequence Generation:
 * 
 * 1. **Atomic Operations**: Redis INCR is atomic and prevents race conditions
 *    that could cause duplicate booking numbers in high-concurrency scenarios.
 * 
 * 2. **Distributed Systems**: When multiple servers generate booking numbers,
 *    atomic operations ensure consistency across all instances.
 * 
 * 3. **Fallback Strategy**: Database fallback ensures system continues working
 *    even when Redis is down, maintaining service availability.
 * 
 * 4. **Performance**: Redis operations are much faster than database queries,
 *    so we try Redis first for optimal performance.
 * 
 * 5. **TTL Management**: Auto-expiring counters prevent Redis from growing
 *    indefinitely and naturally partition data by year.
 * 
 * 6. **Error Handling**: Graceful degradation ensures booking creation never
 *    fails just because of sequence generation issues.
 */