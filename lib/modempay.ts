import crypto from "crypto";

/**
 * Minimal ModemPay REST client (https://docs.modempay.com).
 * Uses Payment Intents for hosted checkout and HMAC-SHA512 webhook
 * verification via the x-modem-signature header.
 */

const API_BASE = "https://api.modempay.com/v1";

function apiKey(): string {
  const key = process.env.MODEM_PAY_API_KEY;
  if (!key) throw new Error("MODEM_PAY_API_KEY is not set in .env.local");
  return key;
}

async function modemFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`ModemPay ${path} failed (${res.status}): ${text.slice(0, 1000)}`);
  }
  return JSON.parse(text) as T;
}

export interface CheckoutParams {
  amount: number;
  currency?: string;
  title: string;
  description?: string;
  customerEmail?: string;
  customerName?: string;
  metadata: Record<string, string>;
  returnUrl: string;
  cancelUrl: string;
  callbackUrl?: string;
}

export interface PaymentIntentResponse {
  status: boolean;
  message: string;
  data: {
    intent_secret: string;
    payment_link: string;
    amount: number;
    currency: string;
    expires_at: string;
    status: string;
  };
}

/** Creates a Payment Intent and returns the hosted checkout link. */
export async function createCheckout(params: CheckoutParams): Promise<PaymentIntentResponse> {
  return modemFetch<PaymentIntentResponse>("/payment-intents", {
    amount: params.amount,
    currency: params.currency || process.env.PAYMENT_CURRENCY || "USD",
    title: params.title,
    description: params.description,
    customer_email: params.customerEmail,
    customer_name: params.customerName,
    metadata: params.metadata,
    return_url: params.returnUrl,
    cancel_url: params.cancelUrl,
    ...(params.callbackUrl ? { callback_url: params.callbackUrl } : {}),
  });
}

export interface ModemWebhookEvent {
  event: string;
  payload: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    metadata?: Record<string, string>;
    customer_email?: string;
    transaction_reference?: string;
    [key: string]: unknown;
  };
}

/**
 * Verifies the x-modem-signature header (HMAC-SHA512 hex of the raw JSON
 * body) and returns the parsed event. Throws on any mismatch.
 */
export function verifyWebhook(rawBody: string, signature: string | null): ModemWebhookEvent {
  const secret = process.env.MODEM_WEBHOOK_SECRET;
  if (!secret) throw new Error("MODEM_WEBHOOK_SECRET is not set — register the webhook in the ModemPay dashboard and copy the signing secret into .env.local");
  if (!signature) throw new Error("Missing x-modem-signature header");

  const computed = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  if (
    computed.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature))
  ) {
    throw new Error("Invalid webhook signature");
  }
  return JSON.parse(rawBody) as ModemWebhookEvent;
}
