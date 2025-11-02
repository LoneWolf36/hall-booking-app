import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PaymentsService } from '../../src/payments/payments.service';
import { FlexiblePaymentService } from '../../src/payments/services/flexible-payment.service';
import { RazorpayService } from '../../src/payments/services/razorpay.service';
import { AppModule } from '../../src/app.module';
import * as request from 'supertest';
import { PaymentTestEnvironment } from '../setup/payment-test-environment';
import { MockRazorpayWebhook } from '../mocks/razorpay-webhook.mock';
import * as crypto from 'crypto';

describe('Payment System Integration (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let paymentsService: PaymentsService;
  let flexiblePaymentService: FlexiblePaymentService;
  let razorpayService: RazorpayService;
  let testEnv: PaymentTestEnvironment;
  let mockWebhook: MockRazorpayWebhook;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    paymentsService = moduleFixture.get<PaymentsService>(PaymentsService);
    flexiblePaymentService = moduleFixture.get<FlexiblePaymentService>(
      FlexiblePaymentService,
    );
    razorpayService = moduleFixture.get<RazorpayService>(RazorpayService);

    testEnv = new PaymentTestEnvironment(prisma);
    mockWebhook = new MockRazorpayWebhook();

    await app.init();
    await testEnv.setup();
  });

  afterAll(async () => {
    await testEnv.cleanup();
    await app.close();
  });

  beforeEach(async () => {
    await testEnv.resetTestData();
  });

  describe('1. Cash-Only Venue Payment Flow', () => {
    let tenant: any;
    let venue: any;
    let customer: any;

    beforeEach(async () => {
      const testData = await testEnv.createCashOnlyVenue();
      tenant = testData.tenant;
      venue = testData.venue;
      customer = testData.customer;
    });

    it('should handle complete cash-only venue onboarding and booking flow', async () => {
      // 1. Verify venue configuration
      expect(venue.paymentProfile).toBe('cash_only');
      expect(venue.allowCashPayments).toBe(true);
      expect(venue.hasRazorpayAccount).toBe(false);
      expect(venue.platformCommissionPercentage).toEqual(5.0);

      // 2. Create booking
      const bookingData = {
        venueId: venue.id,
        userId: customer.id,
        startTs: new Date('2025-11-01T10:00:00Z'),
        endTs: new Date('2025-11-01T18:00:00Z'),
        totalAmountCents: 10000, // ₹100
        eventType: 'wedding',
      };

      const booking = await testEnv.createBooking(bookingData);
      expect(booking.status).toBe('temp_hold');
      expect(booking.paymentMethod).toBeNull(); // Not yet selected

      // 3. Get payment options - should only show cash
      const response = await request(app.getHttpServer())
        .get(`/api/v1/payments/bookings/${booking.id}/options`)
        .expect(200);

      expect(response.body.availableMethods).toEqual(['cash']);
      expect(response.body.onlinePaymentAvailable).toBe(false);
      expect(response.body.recommendedMethod).toBe('cash');

      // 4. Select cash payment method
      await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.id}/select-method`)
        .send({ paymentMethod: 'cash_full' })
        .expect(200);

      // 5. Verify no online payment link can be generated
      await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.id}/payment-link`)
        .expect(400); // Should fail for cash-only venues

      // 6. Venue staff records cash payment
      const cashPaymentResponse = await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.id}/cash-payment`)
        .send({
          amountCents: 10000,
          paymentMethod: 'cash',
          receiptNumber: 'RCPT-001',
          notes: 'Paid in full at venue',
        })
        .expect(201);

      expect(cashPaymentResponse.body.status).toBe('verified');
      expect(cashPaymentResponse.body.amountCents).toBe(10000);

      // 7. Verify booking status updated
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(updatedBooking.paymentStatus).toBe('paid');
      expect(updatedBooking.status).toBe('confirmed');
      expect(updatedBooking.cashPaymentAcknowledged).toBe(true);

      // 8. Verify commission record created
      const commissionRecord = await prisma.commissionRecord.findFirst({
        where: { bookingId: booking.id },
      });
      expect(commissionRecord).toBeTruthy();
      expect(commissionRecord.commissionPercentage).toEqual(5.0);
      expect(commissionRecord.commissionAmountCents).toBe(500); // 5% of ₹100
      expect(commissionRecord.commissionStatus).toBe('pending');
    });

    it('should prevent online payment attempts for cash-only venues', async () => {
      const booking = await testEnv.createBooking({
        venueId: venue.id,
        userId: customer.id,
        startTs: new Date('2025-11-01T10:00:00Z'),
        endTs: new Date('2025-11-01T18:00:00Z'),
        totalAmountCents: 10000,
      });

      // Attempt to select online payment should fail
      await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.id}/select-method`)
        .send({ paymentMethod: 'full_online' })
        .expect(400);

      // Attempt to generate payment link should fail
      await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.id}/payment-link`)
        .expect(400);
    });
  });

  describe('2. Cash + Deposit Payment Flow', () => {
    let tenant: any;
    let venue: any;
    let customer: any;

    beforeEach(async () => {
      const testData = await testEnv.createCashDepositVenue();
      tenant = testData.tenant;
      venue = testData.venue;
      customer = testData.customer;
    });

    it('should handle cash + deposit payment combination', async () => {
      // 1. Verify venue configuration
      expect(venue.paymentProfile).toBe('cash_plus_deposit');
      expect(venue.requiresOnlineDeposit).toBe(true);
      expect(venue.depositAmount).toBe(25); // 25%
      expect(venue.platformCommissionPercentage).toEqual(7.0);

      // 2. Create booking
      const booking = await testEnv.createBooking({
        venueId: venue.id,
        userId: customer.id,
        startTs: new Date('2025-11-01T10:00:00Z'),
        endTs: new Date('2025-11-01T18:00:00Z'),
        totalAmountCents: 20000, // ₹200
      });

      // 3. Get payment options
      const optionsResponse = await request(app.getHttpServer())
        .get(`/api/v1/payments/bookings/${booking.id}/options`)
        .expect(200);

      expect(optionsResponse.body.availableMethods).toContain('deposit_online');
      expect(optionsResponse.body.depositAmount).toBe(5000); // 25% of ₹200
      expect(optionsResponse.body.cashAmount).toBe(15000); // 75% of ₹200

      // 4. Select deposit + cash payment
      await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.id}/select-method`)
        .send({ paymentMethod: 'deposit_online' })
        .expect(200);

      // 5. Generate payment link for deposit
      const paymentLinkResponse = await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.id}/payment-link`)
        .expect(201);

      expect(paymentLinkResponse.body.paymentLink).toContain('razorpay.com');
      expect(paymentLinkResponse.body.amount).toBe(5000); // Deposit amount

      // 6. Simulate deposit payment via webhook
      const webhook = mockWebhook.createPaymentSuccessWebhook({
        paymentId: 'pay_test_deposit_123',
        amount: 5000,
        bookingId: booking.id,
      });

      await request(app.getHttpServer())
        .post('/api/v1/payments/webhook/razorpay')
        .set('X-Razorpay-Signature', webhook.signature)
        .send(webhook.payload)
        .expect(200);

      // 7. Verify partial payment status
      const partiallyPaidBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(partiallyPaidBooking.paymentStatus).toBe('partial');
      expect(partiallyPaidBooking.onlineAmountDue).toBe(0);
      expect(partiallyPaidBooking.cashAmountDue).toBe(15000);

      // 8. Record remaining cash payment
      await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.id}/cash-payment`)
        .send({
          amountCents: 15000,
          paymentMethod: 'cash',
          receiptNumber: 'RCPT-002',
        })
        .expect(201);

      // 9. Verify full payment completion
      const fullyPaidBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(fullyPaidBooking.paymentStatus).toBe('paid');
      expect(fullyPaidBooking.status).toBe('confirmed');

      // 10. Verify commission calculation (7%)
      const commissionRecord = await prisma.commissionRecord.findFirst({
        where: { bookingId: booking.id },
      });
      expect(commissionRecord.commissionPercentage).toEqual(7.0);
      expect(commissionRecord.commissionAmountCents).toBe(1400); // 7% of ₹200
    });
  });

  describe('3. Hybrid Flexible Payment Flow', () => {
    let tenant: any;
    let venue: any;
    let customer: any;

    beforeEach(async () => {
      const testData = await testEnv.createHybridVenue();
      tenant = testData.tenant;
      venue = testData.venue;
      customer = testData.customer;
    });

    it('should allow customer to choose between cash and online payment', async () => {
      expect(venue.paymentProfile).toBe('hybrid_flexible');
      expect(venue.platformCommissionPercentage).toEqual(8.0);

      const booking = await testEnv.createBooking({
        venueId: venue.id,
        userId: customer.id,
        startTs: new Date('2025-11-01T10:00:00Z'),
        endTs: new Date('2025-11-01T18:00:00Z'),
        totalAmountCents: 15000,
      });

      // Get payment options - should show both methods
      const optionsResponse = await request(app.getHttpServer())
        .get(`/api/v1/payments/bookings/${booking.id}/options`)
        .expect(200);

      expect(optionsResponse.body.availableMethods).toEqual(['cash', 'online']);
      expect(optionsResponse.body.flexiblePayment).toBe(true);

      // Test online payment selection
      await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.id}/select-method`)
        .send({ paymentMethod: 'full_online' })
        .expect(200);

      // Generate online payment link
      const paymentLinkResponse = await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.id}/payment-link`)
        .expect(201);

      expect(paymentLinkResponse.body.amount).toBe(15000);

      // Customer changes mind - switch to cash
      await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.id}/select-method`)
        .send({ paymentMethod: 'cash_full' })
        .expect(200);

      // Record cash payment
      await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.id}/cash-payment`)
        .send({
          amountCents: 15000,
          paymentMethod: 'cash',
          receiptNumber: 'RCPT-003',
        })
        .expect(201);

      // Verify commission is still 8% regardless of payment method
      const commissionRecord = await prisma.commissionRecord.findFirst({
        where: { bookingId: booking.id },
      });
      expect(commissionRecord.commissionPercentage).toEqual(8.0);
      expect(commissionRecord.commissionAmountCents).toBe(1200); // 8% of ₹150
    });

    it('should learn customer payment preferences', async () => {
      // Customer makes 3 bookings with cash payment
      for (let i = 0; i < 3; i++) {
        const booking = await testEnv.createBooking({
          venueId: venue.id,
          userId: customer.id,
          startTs: new Date(`2025-11-0${i + 1}T10:00:00Z`),
          endTs: new Date(`2025-11-0${i + 1}T18:00:00Z`),
          totalAmountCents: 10000,
        });

        await request(app.getHttpServer())
          .post(`/api/v1/payments/bookings/${booking.id}/select-method`)
          .send({ paymentMethod: 'cash_full' })
          .expect(200);

        await request(app.getHttpServer())
          .post(`/api/v1/payments/bookings/${booking.id}/cash-payment`)
          .send({
            amountCents: 10000,
            paymentMethod: 'cash',
          })
          .expect(201);
      }

      // Next booking should suggest cash as preferred method
      const newBooking = await testEnv.createBooking({
        venueId: venue.id,
        userId: customer.id,
        startTs: new Date('2025-11-05T10:00:00Z'),
        endTs: new Date('2025-11-05T18:00:00Z'),
        totalAmountCents: 10000,
      });

      const optionsResponse = await request(app.getHttpServer())
        .get(`/api/v1/payments/bookings/${newBooking.id}/options`)
        .expect(200);

      expect(optionsResponse.body.recommendedMethod).toBe('cash');

      // Verify preference record
      const preference = await prisma.customerPaymentPreference.findFirst({
        where: { userId: customer.id },
      });
      expect(preference.preferredMethod).toBe('cash');
      expect(preference.totalBookings).toBe(4);
      expect(preference.totalOnlinePayments).toBe(0);
    });
  });

  describe('4. Full Online Payment Flow', () => {
    let tenant: any;
    let venue: any;
    let customer: any;

    beforeEach(async () => {
      const testData = await testEnv.createFullOnlineVenue();
      tenant = testData.tenant;
      venue = testData.venue;
      customer = testData.customer;
    });

    it('should handle full online payment with instant confirmation', async () => {
      expect(venue.paymentProfile).toBe('full_online');
      expect(venue.hasRazorpayAccount).toBe(true);
      expect(venue.platformCommissionPercentage).toEqual(10.0);
      expect(venue.confirmationTrigger).toBe('full_payment');

      const booking = await testEnv.createBooking({
        venueId: venue.id,
        userId: customer.id,
        startTs: new Date('2025-11-01T10:00:00Z'),
        endTs: new Date('2025-11-01T18:00:00Z'),
        totalAmountCents: 25000,
      });

      // Should only offer online payment
      const optionsResponse = await request(app.getHttpServer())
        .get(`/api/v1/payments/bookings/${booking.id}/options`)
        .expect(200);

      expect(optionsResponse.body.availableMethods).toEqual(['online']);
      expect(optionsResponse.body.cashPaymentAvailable).toBe(false);

      // Generate payment link
      const paymentLinkResponse = await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.id}/payment-link`)
        .expect(201);

      expect(paymentLinkResponse.body.amount).toBe(25000);
      expect(paymentLinkResponse.body.instantConfirmation).toBe(true);

      // Simulate successful payment
      const webhook = mockWebhook.createPaymentSuccessWebhook({
        paymentId: 'pay_test_full_online_123',
        amount: 25000,
        bookingId: booking.id,
      });

      await request(app.getHttpServer())
        .post('/api/v1/payments/webhook/razorpay')
        .set('X-Razorpay-Signature', webhook.signature)
        .send(webhook.payload)
        .expect(200);

      // Verify instant confirmation
      const confirmedBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(confirmedBooking.status).toBe('confirmed');
      expect(confirmedBooking.paymentStatus).toBe('paid');
      expect(confirmedBooking.requiresManualConfirmation).toBe(false);

      // Verify 10% commission
      const commissionRecord = await prisma.commissionRecord.findFirst({
        where: { bookingId: booking.id },
      });
      expect(commissionRecord.commissionPercentage).toEqual(10.0);
      expect(commissionRecord.commissionAmountCents).toBe(2500); // 10% of ₹250
    });

    it('should reject cash payment attempts', async () => {
      const booking = await testEnv.createBooking({
        venueId: venue.id,
        userId: customer.id,
        startTs: new Date('2025-11-01T10:00:00Z'),
        endTs: new Date('2025-11-01T18:00:00Z'),
        totalAmountCents: 25000,
      });

      // Attempt cash payment should fail
      await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.id}/cash-payment`)
        .send({
          amountCents: 25000,
          paymentMethod: 'cash',
        })
        .expect(400);
    });
  });

  describe('5. Marketplace Payment Flow', () => {
    let tenant: any;
    let venue: any;
    let customer: any;

    beforeEach(async () => {
      const testData = await testEnv.createMarketplaceVenue();
      tenant = testData.tenant;
      venue = testData.venue;
      customer = testData.customer;
    });

    it('should handle marketplace model with platform-managed payments', async () => {
      expect(venue.paymentProfile).toBe('marketplace');
      expect(venue.platformHandlesPayments).toBe(true);
      expect(venue.platformCommissionPercentage).toEqual(15.0);

      const booking = await testEnv.createBooking({
        venueId: venue.id,
        userId: customer.id,
        startTs: new Date('2025-11-01T10:00:00Z'),
        endTs: new Date('2025-11-01T18:00:00Z'),
        totalAmountCents: 30000,
      });

      // Platform handles all payment processing
      const optionsResponse = await request(app.getHttpServer())
        .get(`/api/v1/payments/bookings/${booking.id}/options`)
        .expect(200);

      expect(optionsResponse.body.platformManaged).toBe(true);
      expect(optionsResponse.body.availableMethods).toEqual(['online']);

      // Generate payment link using platform Razorpay account
      const paymentLinkResponse = await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.id}/payment-link`)
        .expect(201);

      expect(paymentLinkResponse.body.platformAccount).toBe(true);
      expect(paymentLinkResponse.body.amount).toBe(30000);

      // Simulate payment success
      const webhook = mockWebhook.createPaymentSuccessWebhook({
        paymentId: 'pay_test_marketplace_123',
        amount: 30000,
        bookingId: booking.id,
      });

      await request(app.getHttpServer())
        .post('/api/v1/payments/webhook/razorpay')
        .set('X-Razorpay-Signature', webhook.signature)
        .send(webhook.payload)
        .expect(200);

      // Verify 15% commission
      const commissionRecord = await prisma.commissionRecord.findFirst({
        where: { bookingId: booking.id },
      });
      expect(commissionRecord.commissionPercentage).toEqual(15.0);
      expect(commissionRecord.commissionAmountCents).toBe(4500); // 15% of ₹300
      expect(commissionRecord.collectionMethod).toBe('auto_deduct');
    });
  });

  describe('6. Razorpay Webhook Integration', () => {
    it('should validate webhook signatures correctly', async () => {
      const testBooking = await testEnv.createBooking({
        venueId: 'test-venue-id',
        userId: 'test-customer-id',
        totalAmountCents: 10000,
      });

      const validWebhook = mockWebhook.createPaymentSuccessWebhook({
        paymentId: 'pay_test_signature_123',
        amount: 10000,
        bookingId: testBooking.id,
      });

      // Valid signature should succeed
      await request(app.getHttpServer())
        .post('/api/v1/payments/webhook/razorpay')
        .set('X-Razorpay-Signature', validWebhook.signature)
        .send(validWebhook.payload)
        .expect(200);

      // Invalid signature should fail
      await request(app.getHttpServer())
        .post('/api/v1/payments/webhook/razorpay')
        .set('X-Razorpay-Signature', 'invalid_signature')
        .send(validWebhook.payload)
        .expect(400);
    });

    it('should handle duplicate webhooks idempotently', async () => {
      const testBooking = await testEnv.createBooking({
        venueId: 'test-venue-id',
        userId: 'test-customer-id',
        totalAmountCents: 10000,
      });

      const webhook = mockWebhook.createPaymentSuccessWebhook({
        paymentId: 'pay_test_duplicate_123',
        amount: 10000,
        bookingId: testBooking.id,
      });

      // Send webhook twice
      await request(app.getHttpServer())
        .post('/api/v1/payments/webhook/razorpay')
        .set('X-Razorpay-Signature', webhook.signature)
        .send(webhook.payload)
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/v1/payments/webhook/razorpay')
        .set('X-Razorpay-Signature', webhook.signature)
        .send(webhook.payload)
        .expect(200); // Should still succeed but not create duplicate payment

      // Verify only one payment record
      const payments = await prisma.payment.findMany({
        where: { bookingId: testBooking.id },
      });
      expect(payments).toHaveLength(1);
    });

    it('should handle payment failures correctly', async () => {
      const testBooking = await testEnv.createBooking({
        venueId: 'test-venue-id',
        userId: 'test-customer-id',
        totalAmountCents: 10000,
      });

      const failureWebhook = mockWebhook.createPaymentFailureWebhook({
        paymentId: 'pay_test_failure_123',
        amount: 10000,
        bookingId: testBooking.id,
        errorCode: 'BAD_REQUEST_ERROR',
      });

      await request(app.getHttpServer())
        .post('/api/v1/payments/webhook/razorpay')
        .set('X-Razorpay-Signature', failureWebhook.signature)
        .send(failureWebhook.payload)
        .expect(200);

      // Verify payment failure recorded
      const payment = await prisma.payment.findFirst({
        where: { bookingId: testBooking.id },
      });
      expect(payment.status).toBe('failed');

      // Verify booking remains in temp_hold status
      const booking = await prisma.booking.findUnique({
        where: { id: testBooking.id },
      });
      expect(booking.status).toBe('temp_hold');
      expect(booking.paymentStatus).toBe('pending');
    });
  });

  describe('7. Multi-Tenant Payment Isolation', () => {
    let tenantA: any;
    let tenantB: any;
    let venueA: any;
    let venueB: any;

    beforeEach(async () => {
      const testDataA = await testEnv.createTenantWithVenue('tenant-a');
      const testDataB = await testEnv.createTenantWithVenue('tenant-b');

      tenantA = testDataA.tenant;
      venueA = testDataA.venue;
      tenantB = testDataB.tenant;
      venueB = testDataB.venue;
    });

    it('should maintain payment isolation between tenants', async () => {
      // Create bookings for both tenants
      const bookingA = await testEnv.createBooking({
        tenantId: tenantA.id,
        venueId: venueA.id,
        userId: 'customer-a',
        totalAmountCents: 10000,
      });

      const bookingB = await testEnv.createBooking({
        tenantId: tenantB.id,
        venueId: venueB.id,
        userId: 'customer-b',
        totalAmountCents: 20000,
      });

      // Record payments for both
      await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${bookingA.id}/cash-payment`)
        .set('X-Tenant-ID', tenantA.id)
        .send({ amountCents: 10000, paymentMethod: 'cash' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${bookingB.id}/cash-payment`)
        .set('X-Tenant-ID', tenantB.id)
        .send({ amountCents: 20000, paymentMethod: 'cash' })
        .expect(201);

      // Tenant A should not access Tenant B's payments
      await request(app.getHttpServer())
        .get(`/api/v1/payments/bookings/${bookingB.id}/details`)
        .set('X-Tenant-ID', tenantA.id)
        .expect(404); // Not found due to tenant isolation

      // Verify commission records are isolated
      const commissionsA = await prisma.commissionRecord.findMany({
        where: { tenantId: tenantA.id },
      });
      const commissionsB = await prisma.commissionRecord.findMany({
        where: { tenantId: tenantB.id },
      });

      expect(commissionsA).toHaveLength(1);
      expect(commissionsB).toHaveLength(1);
      expect(commissionsA[0].tenantId).toBe(tenantA.id);
      expect(commissionsB[0].tenantId).toBe(tenantB.id);
    });

    it('should route webhooks to correct tenant', async () => {
      const bookingA = await testEnv.createBooking({
        tenantId: tenantA.id,
        venueId: venueA.id,
        userId: 'customer-a',
        totalAmountCents: 10000,
      });

      const webhook = mockWebhook.createPaymentSuccessWebhook({
        paymentId: 'pay_test_tenant_routing_123',
        amount: 10000,
        bookingId: bookingA.id,
        tenantId: tenantA.id,
      });

      await request(app.getHttpServer())
        .post('/api/v1/payments/webhook/razorpay')
        .set('X-Razorpay-Signature', webhook.signature)
        .send(webhook.payload)
        .expect(200);

      // Verify payment recorded for correct tenant
      const payment = await prisma.payment.findFirst({
        where: {
          bookingId: bookingA.id,
          tenantId: tenantA.id,
        },
      });
      expect(payment).toBeTruthy();
      expect(payment.tenantId).toBe(tenantA.id);

      // Verify no cross-tenant payment leakage
      const crossTenantPayment = await prisma.payment.findFirst({
        where: {
          bookingId: bookingA.id,
          tenantId: tenantB.id,
        },
      });
      expect(crossTenantPayment).toBeNull();
    });
  });

  describe('8. Commission Calculation Accuracy', () => {
    const testCases = [
      {
        profile: 'cash_only',
        expectedRate: 5.0,
        amount: 10000,
        expectedCommission: 500,
      },
      {
        profile: 'cash_plus_deposit',
        expectedRate: 7.0,
        amount: 15000,
        expectedCommission: 1050,
      },
      {
        profile: 'hybrid_flexible',
        expectedRate: 8.0,
        amount: 20000,
        expectedCommission: 1600,
      },
      {
        profile: 'full_online',
        expectedRate: 10.0,
        amount: 25000,
        expectedCommission: 2500,
      },
      {
        profile: 'marketplace',
        expectedRate: 15.0,
        amount: 30000,
        expectedCommission: 4500,
      },
    ];

    testCases.forEach(
      ({ profile, expectedRate, amount, expectedCommission }) => {
        it(`should calculate ${expectedRate}% commission for ${profile} profile`, async () => {
          const testData = await testEnv.createVenueWithProfile(profile);

          const booking = await testEnv.createBooking({
            venueId: testData.venue.id,
            userId: testData.customer.id,
            totalAmountCents: amount,
          });

          // Complete payment based on profile
          if (profile.includes('online') || profile === 'marketplace') {
            const webhook = mockWebhook.createPaymentSuccessWebhook({
              paymentId: `pay_test_commission_${profile}`,
              amount,
              bookingId: booking.id,
            });

            await request(app.getHttpServer())
              .post('/api/v1/payments/webhook/razorpay')
              .set('X-Razorpay-Signature', webhook.signature)
              .send(webhook.payload)
              .expect(200);
          } else {
            await request(app.getHttpServer())
              .post(`/api/v1/payments/bookings/${booking.id}/cash-payment`)
              .send({ amountCents: amount, paymentMethod: 'cash' })
              .expect(201);
          }

          // Verify commission calculation
          const commission = await prisma.commissionRecord.findFirst({
            where: { bookingId: booking.id },
          });

          expect(commission).toBeTruthy();
          expect(commission.commissionPercentage).toEqual(expectedRate);
          expect(commission.commissionAmountCents).toBe(expectedCommission);
          expect(commission.bookingAmountCents).toBe(amount);
          expect(commission.commissionStatus).toBe('pending');
        });
      },
    );
  });

  describe('9. Performance Benchmarks', () => {
    it('should process payment operations within target response times', async () => {
      const testData = await testEnv.createHybridVenue();

      const booking = await testEnv.createBooking({
        venueId: testData.venue.id,
        userId: testData.customer.id,
        totalAmountCents: 10000,
      });

      // Test payment options generation (target: <100ms)
      const optionsStart = Date.now();
      await request(app.getHttpServer())
        .get(`/api/v1/payments/bookings/${booking.id}/options`)
        .expect(200);
      const optionsTime = Date.now() - optionsStart;
      expect(optionsTime).toBeLessThan(100);

      // Test cash payment recording (target: <50ms)
      const cashPaymentStart = Date.now();
      await request(app.getHttpServer())
        .post(`/api/v1/payments/bookings/${booking.id}/cash-payment`)
        .send({ amountCents: 10000, paymentMethod: 'cash' })
        .expect(201);
      const cashPaymentTime = Date.now() - cashPaymentStart;
      expect(cashPaymentTime).toBeLessThan(50);

      // Test commission calculation (target: <25ms)
      const commissionStart = Date.now();
      const commission = await prisma.commissionRecord.findFirst({
        where: { bookingId: booking.id },
      });
      const commissionTime = Date.now() - commissionStart;
      expect(commissionTime).toBeLessThan(25);
      expect(commission).toBeTruthy();
    });
  });
});