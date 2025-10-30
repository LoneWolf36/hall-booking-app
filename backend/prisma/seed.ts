/**
 * Prisma Database Seed
 * 
 * Creates dummy test data for development and testing
 * Run with: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // Clear existing data (for idempotency)
  await prisma.booking.deleteMany();
  await prisma.blackout.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // Create test tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Faisal Event Halls',
      slug: 'faisal-halls',
      settings: { country: 'IN', timezone: 'Asia/Kolkata' },
    },
  });
  console.log(`✅ Created tenant: ${tenant.name}`);

  // Create test venues with different configurations
  const venue1 = await prisma.venue.create({
    data: {
      tenantId: tenant.id,
      name: 'Faisal Function Hall',
      address: '123 Main Street, Aurangabad',
      capacity: 500,
      basePriceCents: 50000, // ₹500 per day
      currency: 'INR',
      timeZone: 'Asia/Kolkata',
      isActive: true,
      paymentProfile: 'cash_only',
      allowCashPayments: true,
      cashDiscountPercentage: null, // No discount
      confirmationTrigger: 'manual_approval',
      platformCommissionPercentage: 10,
      paymentDueDaysBeforeEvent: 7,
      settings: {
        description: 'Premium event venue with modern facilities',
        amenities: ['AC', 'Sound System', 'Parking', 'Catering'],
        images: [],
      },
    },
  });
  console.log(`✅ Created venue 1: ${venue1.name} (₹${venue1.basePriceCents / 100}/day)`);

  const venue2 = await prisma.venue.create({
    data: {
      tenantId: tenant.id,
      name: 'Grand Banquet Hall',
      address: '456 Park Avenue, Aurangabad',
      capacity: 300,
      basePriceCents: 75000, // ₹750 per day
      currency: 'INR',
      timeZone: 'Asia/Kolkata',
      isActive: true,
      paymentProfile: 'hybrid',
      allowCashPayments: true,
      cashDiscountPercentage: null,
      requiresOnlineDeposit: false,
      confirmationTrigger: 'manual_approval',
      hasRazorpayAccount: true,
      platformCommissionPercentage: 12,
      paymentDueDaysBeforeEvent: 5,
      settings: {
        description: 'Elegant venue with modern infrastructure',
        amenities: ['AC', 'DJ Setup', 'Stage', 'Garden'],
        images: [],
      },
    },
  });
  console.log(`✅ Created venue 2: ${venue2.name} (₹${venue2.basePriceCents / 100}/day)`);

  const venue3 = await prisma.venue.create({
    data: {
      tenantId: tenant.id,
      name: 'Royal Wedding Palace',
      address: '789 Royal Road, Aurangabad',
      capacity: 1000,
      basePriceCents: 100000, // ₹1000 per day
      currency: 'INR',
      timeZone: 'Asia/Kolkata',
      isActive: true,
      paymentProfile: 'full_online',
      allowCashPayments: false,
      requiresOnlineDeposit: true,
      depositType: 'percentage',
      depositAmount: 50, // 50% deposit
      confirmationTrigger: 'full_payment',
      hasRazorpayAccount: true,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'test_key',
      platformCommissionPercentage: 15,
      paymentDueDaysBeforeEvent: 3,
      settings: {
        description: 'Ultra-premium venue for grand celebrations',
        amenities: ['Luxury AC', 'Premium Sound', 'Valet Parking', 'Restaurant'],
        images: [],
      },
    },
  });
  console.log(`✅ Created venue 3: ${venue3.name} (₹${venue3.basePriceCents / 100}/day)`);

  // Create test users (customers and admin)
  const customer1 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Rajesh Kumar',
      phone: '+919876543210',
      email: 'rajesh@example.com',
      role: 'customer',
    },
  });
  console.log(`✅ Created user: ${customer1.name}`);

  const customer2 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Priya Singh',
      phone: '+919876543211',
      email: 'priya@example.com',
      role: 'customer',
    },
  });
  console.log(`✅ Created user: ${customer2.name}`);

  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Admin User',
      phone: '+919876543212',
      email: 'admin@example.com',
      role: 'admin',
    },
  });
  console.log(`✅ Created admin: ${admin.name}`);

  // Create sample bookings
  const now = new Date();
  const futureDate1 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  const futureDate2 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days from now
  const futureDate3 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

  const booking1 = await prisma.booking.create({
    data: {
      tenantId: tenant.id,
      venueId: venue1.id,
      userId: customer1.id,
      bookingNumber: `BK${Date.now()}001`,
      startTs: futureDate1,
      endTs: new Date(futureDate1.getTime() + 24 * 60 * 60 * 1000),
      status: 'pending',
      eventType: 'wedding',
      guestCount: 250,
      totalAmountCents: venue1.basePriceCents,
      currency: 'INR',
      paymentStatus: 'pending',
      paymentMethod: 'cash_full',
      specialRequests: 'Please arrange vegetarian menu',
      idempotencyKey: `idem-${Date.now()}-001`,
    },
  });
  console.log(`✅ Created booking 1: ${booking1.bookingNumber}`);

  const booking2 = await prisma.booking.create({
    data: {
      tenantId: tenant.id,
      venueId: venue2.id,
      userId: customer2.id,
      bookingNumber: `BK${Date.now()}002`,
      startTs: futureDate2,
      endTs: new Date(futureDate2.getTime() + 2 * 24 * 60 * 60 * 1000), // 2-day booking
      status: 'confirmed',
      eventType: 'corporate',
      guestCount: 150,
      totalAmountCents: venue2.basePriceCents * 2,
      currency: 'INR',
      paymentStatus: 'paid',
      paymentMethod: 'full_online',
      confirmedBy: admin.id,
      confirmedAt: now,
      idempotencyKey: `idem-${Date.now()}-002`,
    },
  });
  console.log(`✅ Created booking 2: ${booking2.bookingNumber}`);

  const booking3 = await prisma.booking.create({
    data: {
      tenantId: tenant.id,
      venueId: venue3.id,
      userId: customer1.id,
      bookingNumber: `BK${Date.now()}003`,
      startTs: futureDate3,
      endTs: new Date(futureDate3.getTime() + 24 * 60 * 60 * 1000),
      status: 'confirmed',
      eventType: 'wedding',
      guestCount: 500,
      totalAmountCents: venue3.basePriceCents,
      currency: 'INR',
      paymentStatus: 'paid',
      paymentMethod: 'full_online',
      confirmedBy: admin.id,
      confirmedAt: now,
      idempotencyKey: `idem-${Date.now()}-003`,
    },
  });
  console.log(`✅ Created booking 3: ${booking3.bookingNumber}`);

  // Create some blackout periods
  const blackoutStart = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
  const blackoutEnd = new Date(blackoutStart.getTime() + 3 * 24 * 60 * 60 * 1000);

  const blackout = await prisma.blackout.create({
    data: {
      tenantId: tenant.id,
      venueId: venue1.id,
      startTs: blackoutStart,
      endTs: blackoutEnd,
      reason: 'Maintenance and cleaning',
      isMaintenance: true,
    },
  });
  console.log(`✅ Created blackout period for ${venue1.name}`);

  // Create payment records for booking 2 (which is paid)
  const payment = await prisma.payment.create({
    data: {
      tenantId: tenant.id,
      bookingId: booking2.id,
      provider: 'razorpay',
      providerPaymentId: 'pay_1234567890',
      amountCents: venue2.basePriceCents * 2,
      currency: 'INR',
      status: 'success',
      processedAt: now,
      gatewayResponse: { order_id: 'order_123', receipt_id: 'receipt_123' },
    },
  });
  console.log(`✅ Created payment record for booking 2`);

  console.log('\n✨ Database seeded successfully!\n');

  // Print summary
  console.log('📊 Seeding Summary:');
  console.log(`   Tenants: 1`);
  console.log(`   Venues: 3`);
  console.log(`   Users: 3 (2 customers, 1 admin)`);
  console.log(`   Bookings: 3`);
  console.log(`   Payments: 1`);
  console.log(`   Blackouts: 1`);

  console.log('\n🔑 Test Credentials:');
  console.log(`   Customer 1: +919876543210 (Rajesh Kumar)`);
  console.log(`   Customer 2: +919876543211 (Priya Singh)`);
  console.log(`   Admin: +919876543212 (Admin User)`);
  console.log(`   OTP (dev): 000000\n`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
