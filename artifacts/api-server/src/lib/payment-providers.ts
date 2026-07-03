/**
 * Pluggable payment gateway abstraction.
 *
 * The active provider is chosen with the PAYMENT_PROVIDER env var:
 *   - "mock"        (default) — local simulation page, for dev and until a real
 *                    gateway contract is in place.
 *   - "visa_online" — structure ready; activates once the processor delivers
 *                    API credentials (see VisaOnlineProvider below).
 *
 * To add a real provider: implement PaymentProvider, register it in PROVIDERS,
 * add its callback/webhook route in routes/payments.ts, and set the env vars.
 */

export interface CheckoutSession {
  /** URL the client should redirect the payer to. */
  url: string;
  /** Provider's own reference for this checkout, if any. */
  providerReference?: string;
}

export interface CallbackResult {
  paymentId: number;
  success: boolean;
  /** Provider transaction id — stored on the payment record for reconciliation. */
  transactionId?: string;
}

export interface PaymentProvider {
  id: string;
  /** True when all required credentials/env vars are present. */
  isConfigured(): boolean;
  /**
   * Create a hosted checkout for a pending payment.
   * @param payment - the pending payments row (id, amount, currency, reference)
   */
  createCheckout(payment: { id: number; amount: string; currency: string; reference?: string | null }): Promise<CheckoutSession>;
  /**
   * Interpret the gateway's return/webhook parameters.
   * Each provider's callback route calls this before completing the payment.
   */
  parseCallback(query: Record<string, unknown>): CallbackResult;
}

// ── Mock provider (current behavior) ─────────────────────────────────────────

const mockProvider: PaymentProvider = {
  id: "mock",
  isConfigured: () => true,
  async createCheckout(payment) {
    return { url: `/api/payments/mock-gateway?paymentId=${payment.id}` };
  },
  parseCallback(query) {
    return {
      paymentId: parseInt(String(query.paymentId)),
      success: query.status === "success",
    };
  },
};

// ── Visa online provider (STRUCTURE ONLY — awaiting processor credentials) ───
//
// When the payment company delivers the API contract, fill in:
//   1. Env vars: VISA_GATEWAY_URL, VISA_MERCHANT_ID, VISA_API_KEY, VISA_API_SECRET
//   2. createCheckout: POST to the gateway's session endpoint with
//      { merchantId, amount, currency, orderRef: payment.reference,
//        returnUrl: `${PUBLIC_URL}/api/payments/visa/callback` }
//      and return the hosted-checkout URL from the response.
//   3. parseCallback: validate the gateway's signature (HMAC over the query
//      params using VISA_API_SECRET) before trusting `success`.
//   4. Optionally a POST webhook route for asynchronous confirmations.

const visaOnlineProvider: PaymentProvider = {
  id: "visa_online",
  isConfigured: () =>
    Boolean(
      process.env.VISA_GATEWAY_URL &&
      process.env.VISA_MERCHANT_ID &&
      process.env.VISA_API_KEY &&
      process.env.VISA_API_SECRET,
    ),
  async createCheckout(_payment) {
    if (!this.isConfigured()) {
      throw new Error(
        "Visa online gateway is not configured yet. Set VISA_GATEWAY_URL, VISA_MERCHANT_ID, VISA_API_KEY and VISA_API_SECRET once the processor delivers credentials.",
      );
    }
    // TODO(visa): create a hosted checkout session via the processor API.
    throw new Error("Visa online gateway integration pending processor API documentation.");
  },
  parseCallback(_query) {
    // TODO(visa): verify HMAC signature, extract order reference + status.
    throw new Error("Visa online gateway integration pending processor API documentation.");
  },
};

// ── Registry ─────────────────────────────────────────────────────────────────

const PROVIDERS: Record<string, PaymentProvider> = {
  mock: mockProvider,
  visa_online: visaOnlineProvider,
};

export function getActiveProvider(): PaymentProvider {
  const requested = process.env.PAYMENT_PROVIDER || "mock";
  const provider = PROVIDERS[requested];
  if (!provider) {
    console.warn(`Unknown PAYMENT_PROVIDER "${requested}" — falling back to mock.`);
    return mockProvider;
  }
  if (!provider.isConfigured()) {
    console.warn(`Payment provider "${requested}" is not fully configured — falling back to mock.`);
    return mockProvider;
  }
  return provider;
}
