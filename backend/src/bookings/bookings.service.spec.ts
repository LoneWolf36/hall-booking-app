diff --git a/backend/src/bookings/bookings.service.spec.ts b/backend/src/bookings/bookings.service.spec.ts
index 13a3ce1..13a3ce1 100644
--- a/backend/src/bookings/bookings.service.spec.ts
+++ b/backend/src/bookings/bookings.service.spec.ts
@@
   it('should set hold expiry for temp bookings', async () => {
@@
-      const result = await service.createBooking(
-        mockTenantId,
-        createBookingDto,
-      );
+      const result = await service.createBooking(mockTenantId, {
+        venueId: mockVenueId,
+        customer: {
+          name: 'Rahul Sharma',
+          phone: '+91 9876 543 210',
+          email: 'rahul@example.com',
+        },
+        startTs: '2025-12-25T04:30:00.000Z',
+        endTs: '2025-12-25T20:30:00.000Z',
+        eventType: 'wedding',
+        guestCount: 300,
+        specialRequests: 'Decoration setup needed',
+      });
@@
   });
