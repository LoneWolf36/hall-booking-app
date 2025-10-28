import * as crypto from 'crypto';

export interface WebhookPayload {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment: {
      entity: {
        id: string;
        entity: string;
        amount: number;
        currency: string;
        status: string;
        order_id?: string;
        invoice_id?: string;
        international: boolean;
        method: string;
        amount_refunded: number;
        refund_status?: string;
        captured: boolean;
        description?: string;
        card_id?: string;
        bank?: string;
        wallet?: string;
        vpa?: string;
        email: string;
        contact: string;
        notes: Record<string, any>;
        fee?: number;
        tax?: number;
        error_code?: string;
        error_description?: string;
        error_source?: string;
        error_step?: string;
        error_reason?: string;
        acquirer_data?: Record<string, any>;
        created_at: number;
      };
    };
  };
  created_at: number;
}

export class MockRazorpayWebhook {
  private readonly webhookSecret: string;

  constructor(webhookSecret: string = 'test_webhook_secret_key') {
    this.webhookSecret = webhookSecret;
  }

  /**
   * Creates a payment success webhook with valid signature
   */
  createPaymentSuccessWebhook(params: {
    paymentId: string;
    amount: number;
    bookingId: string;
    tenantId?: string;
    customerEmail?: string;
    customerPhone?: string;
    orderId?: string;
  }) {
    const payload: WebhookPayload = {
      entity: 'event',
      account_id: 'acc_test_account_id',
      event: 'payment.captured',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: params.paymentId,
            entity: 'payment',
            amount: params.amount,
            currency: 'INR',
            status: 'captured',
            order_id: params.orderId || `order_${Date.now()}`,
            international: false,
            method: 'upi',
            amount_refunded: 0,
            captured: true,
            description: `Payment for booking ${params.bookingId}`,
            email: params.customerEmail || 'customer@test.com',
            contact: params.customerPhone || '+919876543210',
            notes: {
              booking_id: params.bookingId,
              tenant_id: params.tenantId || 'test-tenant-id',
              payment_type: 'booking_payment',
            },
            fee: Math.round(params.amount * 0.02), // 2% gateway fee
            tax: Math.round(params.amount * 0.0036), // 18% GST on fee
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    const payloadString = JSON.stringify(payload);
    const signature = this.generateSignature(payloadString);

    return {
      payload,
      signature,
      payloadString,
    };
  }

  /**
   * Creates a payment failure webhook
   */
  createPaymentFailureWebhook(params: {
    paymentId: string;
    amount: number;
    bookingId: string;
    errorCode: string;
    errorDescription?: string;
    tenantId?: string;
  }) {
    const payload: WebhookPayload = {
      entity: 'event',
      account_id: 'acc_test_account_id',
      event: 'payment.failed',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: params.paymentId,
            entity: 'payment',
            amount: params.amount,
            currency: 'INR',
            status: 'failed',
            order_id: `order_${Date.now()}`,
            international: false,
            method: 'upi',
            amount_refunded: 0,
            captured: false,
            description: `Failed payment for booking ${params.bookingId}`,
            email: 'customer@test.com',
            contact: '+919876543210',
            notes: {
              booking_id: params.bookingId,
              tenant_id: params.tenantId || 'test-tenant-id',
              payment_type: 'booking_payment',
            },
            error_code: params.errorCode,
            error_description:
              params.errorDescription ||
              'Payment failed due to insufficient funds',
            error_source: 'customer',
            error_step: 'payment_authentication',
            error_reason: 'payment_failed',
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    const payloadString = JSON.stringify(payload);
    const signature = this.generateSignature(payloadString);

    return {
      payload,
      signature,
      payloadString,
    };
  }

  /**
   * Creates a payment authorized webhook (for deposits)
   */
  createPaymentAuthorizedWebhook(params: {
    paymentId: string;
    amount: number;
    bookingId: string;
    tenantId?: string;
  }) {
    const payload: WebhookPayload = {
      entity: 'event',
      account_id: 'acc_test_account_id',
      event: 'payment.authorized',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: params.paymentId,
            entity: 'payment',
            amount: params.amount,
            currency: 'INR',
            status: 'authorized',
            order_id: `order_${Date.now()}`,
            international: false,
            method: 'card',
            amount_refunded: 0,
            captured: false, // Authorized but not captured
            description: `Deposit authorization for booking ${params.bookingId}`,
            email: 'customer@test.com',
            contact: '+919876543210',
            notes: {
              booking_id: params.bookingId,
              tenant_id: params.tenantId || 'test-tenant-id',
              payment_type: 'deposit_authorization',
            },
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    const payloadString = JSON.stringify(payload);
    const signature = this.generateSignature(payloadString);

    return {
      payload,
      signature,
      payloadString,
    };
  }

  /**
   * Creates a refund webhook
   */
  createRefundWebhook(params: {
    paymentId: string;
    refundId: string;
    amount: number;
    bookingId: string;
    tenantId?: string;
  }) {
    const payload = {
      entity: 'event',
      account_id: 'acc_test_account_id',
      event: 'refund.processed',
      contains: ['refund'],
      payload: {
        refund: {
          entity: {
            id: params.refundId,
            entity: 'refund',
            amount: params.amount,
            currency: 'INR',
            payment_id: params.paymentId,
            notes: {
              booking_id: params.bookingId,
              tenant_id: params.tenantId || 'test-tenant-id',
              refund_reason: 'booking_cancelled',
            },
            receipt: `refund_${Date.now()}`,
            acquirer_data: {},
            status: 'processed',
            speed_processed: 'normal',
            speed_requested: 'normal',
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    const payloadString = JSON.stringify(payload);
    const signature = this.generateSignature(payloadString);

    return {
      payload,
      signature,
      payloadString,
    };
  }

  /**
   * Creates a webhook with invalid signature for testing signature validation
   */
  createWebhookWithInvalidSignature(params: {
    paymentId: string;
    amount: number;
    bookingId: string;
  }) {
    const validWebhook = this.createPaymentSuccessWebhook(params);

    return {
      ...validWebhook,
      signature: 'invalid_signature_for_testing',
    };
  }

  /**
   * Generates HMAC-SHA256 signature for webhook payload
   */
  private generateSignature(payload: string): string {
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    return expectedSignature;
  }

  /**
   * Validates webhook signature (for testing the validation logic)
   */
  validateSignature(payload: string, signature: string): boolean {
    const expectedSignature = this.generateSignature(payload);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  }

  /**
   * Creates a batch of webhooks for load testing
   */
  createBatchWebhooks(
    count: number,
    baseParams: {
      amount: number;
      bookingIdPrefix: string;
      tenantId?: string;
    },
  ) {
    const webhooks = [];

    for (let i = 0; i < count; i++) {
      const webhook = this.createPaymentSuccessWebhook({
        paymentId: `pay_test_batch_${i}_${Date.now()}`,
        amount: baseParams.amount,
        bookingId: `${baseParams.bookingIdPrefix}_${i}`,
        tenantId: baseParams.tenantId,
      });

      webhooks.push(webhook);
    }

    return webhooks;
  }

  /**
   * Creates webhooks for different payment methods
   */
  createPaymentMethodWebhooks(params: {
    paymentId: string;
    amount: number;
    bookingId: string;
    method: 'card' | 'upi' | 'netbanking' | 'wallet';
  }) {
    const baseWebhook = this.createPaymentSuccessWebhook(params);

    // Modify payment method in the payload
    baseWebhook.payload.payload.payment.entity.method = params.method;

    // Add method-specific data
    switch (params.method) {
      case 'card':
        baseWebhook.payload.payload.payment.entity.card_id = 'card_test_123';
        break;
      case 'upi':
        baseWebhook.payload.payload.payment.entity.vpa = 'customer@paytm';
        break;
      case 'netbanking':
        baseWebhook.payload.payload.payment.entity.bank = 'HDFC';
        break;
      case 'wallet':
        baseWebhook.payload.payload.payment.entity.wallet = 'paytm';
        break;
    }

    // Regenerate signature with modified payload
    const payloadString = JSON.stringify(baseWebhook.payload);
    const signature = this.generateSignature(payloadString);

    return {
      payload: baseWebhook.payload,
      signature,
      payloadString,
    };
  }

  /**
   * Creates a webhook with custom notes for testing metadata handling
   */
  createWebhookWithCustomNotes(params: {
    paymentId: string;
    amount: number;
    bookingId: string;
    notes: Record<string, any>;
  }) {
    const webhook = this.createPaymentSuccessWebhook(params);

    // Merge custom notes with default notes
    webhook.payload.payload.payment.entity.notes = {
      ...webhook.payload.payload.payment.entity.notes,
      ...params.notes,
    };

    // Regenerate signature
    const payloadString = JSON.stringify(webhook.payload);
    const signature = this.generateSignature(payloadString);

    return {
      payload: webhook.payload,
      signature,
      payloadString,
    };
  }

  /**
   * Creates a malformed webhook payload for error handling tests
   */
  createMalformedWebhook() {
    const malformedPayload = {
      entity: 'event',
      // Missing required fields
      event: 'payment.captured',
      payload: {
        // Malformed payment structure
        payment: {
          id: 'pay_malformed_test',
          // Missing entity structure
          amount: 'invalid_amount', // Should be number
          status: 'captured',
        },
      },
    };

    const payloadString = JSON.stringify(malformedPayload);
    const signature = this.generateSignature(payloadString);

    return {
      payload: malformedPayload,
      signature,
      payloadString,
    };
  }
}

// Export utility functions for use in tests
export const createMockWebhookSignature = (
  payload: string,
  secret: string,
): string => {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
};

export const validateMockWebhookSignature = (
  payload: string,
  signature: string,
  secret: string,
): boolean => {
  const expectedSignature = createMockWebhookSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex'),
  );
};
