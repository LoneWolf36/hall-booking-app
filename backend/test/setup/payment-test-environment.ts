import { PrismaService } from '../../src/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { addDays, addHours } from 'date-fns';

export class PaymentTestEnvironment {
  constructor(private readonly prisma: PrismaService) {}

  async setup() {
    // Ensure test database is clean and ready
    await this.cleanDatabase();

    // Create base test data that persists across tests
    await this.createBaseTestData();
  }

  async cleanup() {
    await this.cleanDatabase();
  }

  async resetTestData() {
    // Clean up test data between individual tests
    await this.prisma.commissionRecord.deleteMany({
      where: { tenant: { slug: { startsWith: 'test-' } } },
    });
    await this.prisma.cashPayment.deleteMany({
      where: { tenant: { slug: { startsWith: 'test-' } } },
    });
    await this.prisma.payment.deleteMany({
      where: { tenant: { slug: { startsWith: 'test-' } } },
    });
    await this.prisma.booking.deleteMany({
      where: { tenant: { slug: { startsWith: 'test-' } } },
    });
    await this.prisma.customerPaymentPreference.deleteMany({
      where: { tenant: { slug: { startsWith: 'test-' } } },
    });
  }

  private async cleanDatabase() {
    // Clean all test data
    await this.prisma.commissionRecord.deleteMany({
      where: { tenant: { slug: { startsWith: 'test-' } } },
    });
    await this.prisma.cashPayment.deleteMany({
      where: { tenant: { slug: { startsWith: 'test-' } } },
    });
    await this.prisma.payment.deleteMany({
      where: { tenant: { slug: { startsWith: 'test-' } } },
    });
    await this.prisma.booking.deleteMany({
      where: { tenant: { slug: { startsWith: 'test-' } } },
    });
    await this.prisma.customerPaymentPreference.deleteMany({
      where: { tenant: { slug: { startsWith: 'test-' } } },
    });
    await this.prisma.venueOnboardingResponse.deleteMany({
      where: { tenant: { slug: { startsWith: 'test-' } } },
    });
    await this.prisma.venue.deleteMany({
      where: { tenant: { slug: { startsWith: 'test-' } } },
    });
    await this.prisma.user.deleteMany({
      where: { tenant: { slug: { startsWith: 'test-' } } },
    });
    await this.prisma.tenant.deleteMany({
      where: { slug: { startsWith: 'test-' } },
    });
  }

  private async createBaseTestData() {
    // Create base tenants, users that are reused across tests
    // This is called once during setup
  }

  async createCashOnlyVenue() {
    const tenant = await this.prisma.tenant.create({
      data: {
        id: uuidv4(),
        name: 'Test Cash Only Tenant',
        slug: `test-cash-only-${Date.now()}`,
        settings: {},
      },
    });

    const venue = await this.prisma.venue.create({
      data: {
        id: uuidv4(),
        tenantId: tenant.id,
        name: 'Traditional Hall',
        address: '123 Traditional Street',
        capacity: 200,
        basePriceCents: 10000,
        paymentProfile: 'cash_only',
        allowCashPayments: true,
        hasRazorpayAccount: false,
        platformHandlesPayments: false,
        confirmationTrigger: 'manual_approval',
        platformCommissionPercentage: 5.0,
        requiresOnlineDeposit: false,
        isActive: true,
      },
    });

    const customer = await this.prisma.user.create({
      data: {
        id: uuidv4(),
        tenantId: tenant.id,
        name: 'Test Customer',
        phone: '+919876543210',
        email: 'customer@test.com',
        role: 'customer',
      },
    });

    return { tenant, venue, customer };
  }

  async createCashDepositVenue() {
    const tenant = await this.prisma.tenant.create({
      data: {
        id: uuidv4(),
        name: 'Test Cash+Deposit Tenant',
        slug: `test-cash-deposit-${Date.now()}`,
        settings: {},
      },
    });

    const venue = await this.prisma.venue.create({
      data: {
        id: uuidv4(),
        tenantId: tenant.id,
        name: 'Progressive Traditional Hall',
        address: '456 Progressive Street',
        capacity: 300,
        basePriceCents: 20000,
        paymentProfile: 'cash_plus_deposit',
        allowCashPayments: true,
        hasRazorpayAccount: true,
        razorpayKeyId: 'rzp_test_cash_deposit_key',
        platformHandlesPayments: false,
        confirmationTrigger: 'deposit_only',
        platformCommissionPercentage: 7.0,
        requiresOnlineDeposit: true,
        depositType: 'percentage',
        depositAmount: 25, // 25%
        isActive: true,
      },
    });

    const customer = await this.prisma.user.create({
      data: {
        id: uuidv4(),
        tenantId: tenant.id,
        name: 'Test Customer 2',
        phone: '+919876543211',
        email: 'customer2@test.com',
        role: 'customer',
      },
    });

    return { tenant, venue, customer };
  }

  async createHybridVenue() {
    const tenant = await this.prisma.tenant.create({
      data: {
        id: uuidv4(),
        name: 'Test Hybrid Tenant',
        slug: `test-hybrid-${Date.now()}`,
        settings: {},
      },
    });

    const venue = await this.prisma.venue.create({
      data: {
        id: uuidv4(),
        tenantId: tenant.id,
        name: 'Modern Flexible Hall',
        address: '789 Flexible Avenue',
        capacity: 250,
        basePriceCents: 15000,
        paymentProfile: 'hybrid_flexible',
        allowCashPayments: true,
        hasRazorpayAccount: true,
        razorpayKeyId: 'rzp_test_hybrid_key',
        platformHandlesPayments: false,
        confirmationTrigger: 'full_payment',
        platformCommissionPercentage: 8.0,
        requiresOnlineDeposit: false,
        cashDiscountPercentage: 5.0, // 5% discount for cash
        isActive: true,
      },
    });

    const customer = await this.prisma.user.create({
      data: {
        id: uuidv4(),
        tenantId: tenant.id,
        name: 'Test Customer 3',
        phone: '+919876543212',
        email: 'customer3@test.com',
        role: 'customer',
      },
    });

    return { tenant, venue, customer };
  }

  async createFullOnlineVenue() {
    const tenant = await this.prisma.tenant.create({
      data: {
        id: uuidv4(),
        name: 'Test Full Online Tenant',
        slug: `test-full-online-${Date.now()}`,
        settings: {},
      },
    });

    const venue = await this.prisma.venue.create({
      data: {
        id: uuidv4(),
        tenantId: tenant.id,
        name: 'Digital Premium Hall',
        address: '101 Digital Boulevard',
        capacity: 400,
        basePriceCents: 25000,
        paymentProfile: 'full_online',
        allowCashPayments: false,
        hasRazorpayAccount: true,
        razorpayKeyId: 'rzp_test_full_online_key',
        platformHandlesPayments: false,
        confirmationTrigger: 'full_payment',
        platformCommissionPercentage: 10.0,
        requiresOnlineDeposit: false,
        autoExpireUnpaidBookings: true,
        paymentDueDaysBeforeEvent: 3,
        isActive: true,
      },
    });

    const customer = await this.prisma.user.create({
      data: {
        id: uuidv4(),
        tenantId: tenant.id,
        name: 'Test Customer 4',
        phone: '+919876543213',
        email: 'customer4@test.com',
        role: 'customer',
      },
    });

    return { tenant, venue, customer };
  }

  async createMarketplaceVenue() {
    const tenant = await this.prisma.tenant.create({
      data: {
        id: uuidv4(),
        name: 'Test Marketplace Tenant',
        slug: `test-marketplace-${Date.now()}`,
        settings: {},
      },
    });

    const venue = await this.prisma.venue.create({
      data: {
        id: uuidv4(),
        tenantId: tenant.id,
        name: 'Luxury Marketplace Hall',
        address: '202 Luxury Lane',
        capacity: 500,
        basePriceCents: 30000,
        paymentProfile: 'marketplace',
        allowCashPayments: false,
        hasRazorpayAccount: false, // Platform handles payments
        platformHandlesPayments: true,
        confirmationTrigger: 'full_payment',
        platformCommissionPercentage: 15.0,
        requiresOnlineDeposit: false,
        autoExpireUnpaidBookings: true,
        paymentDueDaysBeforeEvent: 7,
        isActive: true,
      },
    });

    const customer = await this.prisma.user.create({
      data: {
        id: uuidv4(),
        tenantId: tenant.id,
        name: 'Test Customer 5',
        phone: '+919876543214',
        email: 'customer5@test.com',
        role: 'customer',
      },
    });

    return { tenant, venue, customer };
  }

  async createVenueWithProfile(profile: string) {
    const profileConfigs = {
      cash_only: {
        allowCashPayments: true,
        hasRazorpayAccount: false,
        platformHandlesPayments: false,
        platformCommissionPercentage: 5.0,
        requiresOnlineDeposit: false,
      },
      cash_plus_deposit: {
        allowCashPayments: true,
        hasRazorpayAccount: true,
        platformHandlesPayments: false,
        platformCommissionPercentage: 7.0,
        requiresOnlineDeposit: true,
        depositAmount: 25,
      },
      hybrid_flexible: {
        allowCashPayments: true,
        hasRazorpayAccount: true,
        platformHandlesPayments: false,
        platformCommissionPercentage: 8.0,
        requiresOnlineDeposit: false,
      },
      full_online: {
        allowCashPayments: false,
        hasRazorpayAccount: true,
        platformHandlesPayments: false,
        platformCommissionPercentage: 10.0,
        requiresOnlineDeposit: false,
      },
      marketplace: {
        allowCashPayments: false,
        hasRazorpayAccount: false,
        platformHandlesPayments: true,
        platformCommissionPercentage: 15.0,
        requiresOnlineDeposit: false,
      },
    };

    const config = profileConfigs[profile];
    if (!config) {
      throw new Error(`Unknown payment profile: ${profile}`);
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        id: uuidv4(),
        name: `Test ${profile} Tenant`,
        slug: `test-${profile}-${Date.now()}`,
        settings: {},
      },
    });

    const venue = await this.prisma.venue.create({
      data: {
        id: uuidv4(),
        tenantId: tenant.id,
        name: `${profile} Test Venue`,
        address: '123 Test Street',
        capacity: 200,
        basePriceCents: 10000,
        paymentProfile: profile,
        confirmationTrigger: 'manual_approval',
        isActive: true,
        ...config,
      },
    });

    const customer = await this.prisma.user.create({
      data: {
        id: uuidv4(),
        tenantId: tenant.id,
        name: 'Test Customer',
        phone: `+9198765432${Math.floor(Math.random() * 100)}`,
        email: `customer-${profile}@test.com`,
        role: 'customer',
      },
    });

    return { tenant, venue, customer };
  }

  async createTenantWithVenue(tenantSlug: string) {
    const tenant = await this.prisma.tenant.create({
      data: {
        id: uuidv4(),
        name: `${tenantSlug} Tenant`,
        slug: `test-${tenantSlug}-${Date.now()}`,
        settings: {},
      },
    });

    const venue = await this.prisma.venue.create({
      data: {
        id: uuidv4(),
        tenantId: tenant.id,
        name: `${tenantSlug} Venue`,
        address: '123 Isolation Street',
        capacity: 200,
        basePriceCents: 10000,
        paymentProfile: 'hybrid_flexible',
        allowCashPayments: true,
        hasRazorpayAccount: true,
        platformCommissionPercentage: 8.0,
        isActive: true,
      },
    });

    return { tenant, venue };
  }

  async createBooking(data: {
    venueId: string;
    userId: string;
    tenantId?: string;
    startTs?: Date;
    endTs?: Date;
    totalAmountCents?: number;
    eventType?: string;
  }) {
    const startTs = data.startTs || addDays(new Date(), 30);
    const endTs = data.endTs || addHours(startTs, 8);

    // Get tenant from venue if not provided
    let tenantId = data.tenantId;
    if (!tenantId) {
      const venue = await this.prisma.venue.findUnique({
        where: { id: data.venueId },
      });
      tenantId = venue?.tenantId;
    }

    if (!tenantId) {
      throw new Error('Could not determine tenant ID for booking');
    }

    const booking = await this.prisma.booking.create({
      data: {
        id: uuidv4(),
        tenantId,
        venueId: data.venueId,
        userId: data.userId,
        bookingNumber: `BK-${Date.now()}`,
        startTs,
        endTs,
        totalAmountCents: data.totalAmountCents || 10000,
        eventType: data.eventType || 'wedding',
        status: 'temp_hold',
        paymentStatus: 'pending',
        holdExpiresAt: addHours(new Date(), 2), // 2-hour hold
        requiresManualConfirmation: true,
        idempotencyKey: `test-${uuidv4()}`,
        onlineAmountDue: 0,
        cashAmountDue: data.totalAmountCents || 10000,
      },
    });

    return booking;
  }

  async createTestUser(
    tenantId: string,
    role: 'customer' | 'admin' = 'customer',
  ) {
    return await this.prisma.user.create({
      data: {
        id: uuidv4(),
        tenantId,
        name: `Test ${role}`,
        phone: `+9198765432${Math.floor(Math.random() * 100)}`,
        email: `${role}-${Date.now()}@test.com`,
        role,
      },
    });
  }

  async simulatePaymentComplete(
    bookingId: string,
    method: 'cash' | 'online' = 'cash',
  ) {
    if (method === 'cash') {
      return await this.prisma.cashPayment.create({
        data: {
          id: uuidv4(),
          bookingId,
          amountCents: 10000,
          recordedBy: 'test-staff-user',
          paymentMethod: 'cash',
          verificationStatus: 'verified',
          receiptNumber: `RCPT-${Date.now()}`,
        },
      });
    } else {
      return await this.prisma.payment.create({
        data: {
          id: uuidv4(),
          bookingId,
          provider: 'razorpay',
          providerPaymentId: `pay_test_${Date.now()}`,
          amountCents: 10000,
          status: 'success',
          processedAt: new Date(),
          gatewayResponse: {
            payment_id: `pay_test_${Date.now()}`,
            status: 'captured',
          },
        },
      });
    }
  }

  // Utility methods for test assertions
  async getCommissionRecord(bookingId: string) {
    return await this.prisma.commissionRecord.findFirst({
      where: { bookingId },
    });
  }

  async getPaymentRecords(bookingId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { bookingId },
    });

    const cashPayments = await this.prisma.cashPayment.findMany({
      where: { bookingId },
    });

    return { payments, cashPayments };
  }

  async getCustomerPreferences(userId: string) {
    return await this.prisma.customerPaymentPreference.findFirst({
      where: { userId },
    });
  }
}
