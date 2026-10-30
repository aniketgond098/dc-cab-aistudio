import { createHmac, timingSafeEqual } from "node:crypto";
import type { BookingDatabase } from "@/lib/booking-api";

type Env = Record<string, string | undefined>;
type PaymentAttemptRow = {
  id: string;
  payment_id: string;
  provider_order_id: string;
  amount: number | string;
  currency_code: string;
  status: string;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function fail(code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}

function env(): Env {
  return typeof process === "undefined" ? {} : process.env;
}

async function readSmallJson(
  request: Request,
  limit = 8_000,
): Promise<Record<string, unknown> | null> {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json"))
    return null;
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > limit) return null;
  const text = await request.text();
  if (text.length > limit) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function makePaymentToken(bookingId: string, keySecret: string): string {
  return createHmac("sha256", keySecret)
    .update(`dc-cabs:booking-payment:v1:${bookingId}`)
    .digest("hex");
}

export function createBookingPaymentToken(bookingId: string, keySecret: string): string {
  return makePaymentToken(bookingId, keySecret);
}

function validPaymentToken(bookingId: string, token: unknown, keySecret: string): boolean {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) return false;
  const expected = Buffer.from(makePaymentToken(bookingId, keySecret), "hex");
  const supplied = Buffer.from(token, "hex");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function validIdentifier(value: unknown, pattern: RegExp): value is string {
  return typeof value === "string" && pattern.test(value);
}

function signatureMatches(message: string, signature: unknown, secret: string): boolean {
  if (typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(message).digest();
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function minorUnits(amount: number | string, currency: string): number | null {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0 || !/^[A-Z]{3}$/.test(currency)) return null;
  let digits: number;
  try {
    digits =
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
  } catch {
    return null;
  }
  const minor = Math.round(value * 10 ** digits);
  return Number.isSafeInteger(minor) && Math.abs(minor / 10 ** digits - value) < 1e-8
    ? minor
    : null;
}

function majorUnits(amount: unknown, currency: string): number | null {
  if (!Number.isSafeInteger(amount) || typeof amount !== "number" || amount < 0) return null;
  let digits: number;
  try {
    digits =
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
  } catch {
    return null;
  }
  return amount / 10 ** digits;
}

function basicAuth(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

function safeRazorpayErrorCode(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const error = (value as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(code) ? code : null;
}

function logGatewayFailure(area: string, status: number | null, code: string | null): void {
  console.error("[razorpay] gateway request failed", JSON.stringify({ area, status, code }));
}

async function gatewayRequest(
  url: string,
  keyId: string,
  keySecret: string,
  init: RequestInit,
  area: string,
  fetcher: typeof fetch,
): Promise<{ response: Response; body: Record<string, unknown> | null }> {
  const response = await fetcher(url, {
    ...init,
    headers: {
      authorization: basicAuth(keyId, keySecret),
      "content-type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(12_000),
  });
  let body: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = await response.json();
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed))
      body = parsed as Record<string, unknown>;
  } catch {
    body = null;
  }
  if (!response.ok) logGatewayFailure(area, response.status, safeRazorpayErrorCode(body));
  return { response, body };
}

async function getAttempt(
  database: BookingDatabase,
  orderId: string,
): Promise<PaymentAttemptRow | null> {
  const { data, error } = await database
    .from("payment_attempts")
    .select("id,payment_id,provider_order_id,amount,currency_code,status")
    .eq("provider", "razorpay")
    .eq("provider_order_id", orderId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as PaymentAttemptRow | null;
}

export async function handleCreateRazorpayOrder(
  request: Request,
  database: BookingDatabase,
  configuration: Env = env(),
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const keyId = configuration["RAZORPAY_KEY_ID"];
  const keySecret = configuration["RAZORPAY_KEY_SECRET"];
  if (!keyId?.startsWith("rzp_test_") || !keySecret)
    return fail("payment_unavailable", "Online payment is not available right now.", 503);
  const body = await readSmallJson(request);
  if (
    !body ||
    !validIdentifier(body["bookingId"], /^[0-9a-f-]{36}$/i) ||
    !validPaymentToken(body["bookingId"], body["paymentAccessToken"], keySecret)
  ) {
    return fail("invalid_request", "The booking payment request is invalid.", 400);
  }

  try {
    const { data, error } = await database.rpc("begin_booking_payment_attempt", {
      p_booking_id: body["bookingId"],
    });
    if (error) throw error;
    const result = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
    if (!result) return fail("payment_unavailable", "The request could not be completed.", 500);
    const status = result["result_status"];
    if (status === "NOT_FOUND") return fail("booking_not_found", "The booking was not found.", 404);
    if (status === "CANCELLED" || status === "EXPIRED")
      return fail("booking_not_payable", "This booking is no longer eligible for payment.", 409);
    if (status === "ALREADY_PAID")
      return fail("already_paid", "This booking has already been paid.", 409);
    if (status === "NOT_PAYABLE")
      return fail("booking_not_payable", "This booking is no longer eligible for payment.", 409);
    if (status === "IN_PROGRESS")
      return fail(
        "payment_in_progress",
        "Payment setup is already in progress. Please retry shortly.",
        409,
      );
    if (status === "INVALID_AMOUNT" || status === "PAYMENT_RECORD_MISMATCH")
      return fail("payment_unavailable", "The booking cannot be paid online.", 409);
    if (status !== "CREATED" && status !== "REUSE")
      return fail("payment_unavailable", "The request could not be completed.", 500);

    const amount = minorUnits(result["amount"] as number | string, String(result["currency_code"]));
    const currency = String(result["currency_code"]).trim().toUpperCase();
    if (amount === null || !validIdentifier(result["attempt_id"], /^[0-9a-f-]{36}$/i)) {
      return fail("payment_unavailable", "The booking amount cannot be processed.", 409);
    }
    let orderId = String(result["provider_order_id"] ?? "");
    if (status === "CREATED") {
      const orderResponse = await gatewayRequest(
        "https://api.razorpay.com/v1/orders",
        keyId,
        keySecret,
        {
          method: "POST",
          body: JSON.stringify({
            amount,
            currency,
            receipt:
              `${String(result["booking_reference"])}-${String(result["attempt_id"]).slice(0, 8)}`.slice(
                0,
                40,
              ),
            notes: { booking_id: body["bookingId"] },
          }),
        },
        "create_order",
        fetcher,
      );
      orderId = String(orderResponse.body?.["id"] ?? "");
      if (!orderResponse.response.ok || !validIdentifier(orderId, /^order_[A-Za-z0-9]+$/)) {
        await database.rpc("fail_booking_payment_order", {
          p_attempt_id: result["attempt_id"],
          p_placeholder: result["provider_order_id"],
        });
        return fail("payment_unavailable", "The request could not be completed.", 502);
      }
      const { data: attached, error: attachError } = await database.rpc(
        "attach_booking_payment_order",
        {
          p_attempt_id: result["attempt_id"],
          p_placeholder: result["provider_order_id"],
          p_order_id: orderId,
        },
      );
      if (attachError || attached !== true)
        return fail("payment_unavailable", "The request could not be completed.", 502);
    }
    return json({
      keyId,
      orderId,
      amount,
      currency,
      bookingReference: result["booking_reference"],
    });
  } catch {
    console.error(
      "[razorpay] payment order setup failed",
      JSON.stringify({ area: "create_order" }),
    );
    return fail("payment_unavailable", "The request could not be completed.", 500);
  }
}

export async function handleVerifyRazorpayPayment(
  request: Request,
  database: BookingDatabase,
  configuration: Env = env(),
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const keyId = configuration["RAZORPAY_KEY_ID"];
  const keySecret = configuration["RAZORPAY_KEY_SECRET"];
  if (!keyId?.startsWith("rzp_test_") || !keySecret)
    return fail("payment_unavailable", "Online payment is not available right now.", 503);
  const body = await readSmallJson(request);
  if (
    !body ||
    !validIdentifier(body["bookingId"], /^[0-9a-f-]{36}$/i) ||
    !validPaymentToken(body["bookingId"], body["paymentAccessToken"], keySecret) ||
    !validIdentifier(body["orderId"], /^order_[A-Za-z0-9]+$/) ||
    !validIdentifier(body["paymentId"], /^pay_[A-Za-z0-9]+$/)
  ) {
    return fail("invalid_request", "The payment verification request is invalid.", 400);
  }
  try {
    const attempt = await getAttempt(database, body["orderId"]);
    if (!attempt || attempt.status === "abandoned" || attempt.status === "failed")
      return fail("payment_not_found", "The payment attempt was not found.", 404);
    const { data: payment, error: paymentError } = await database
      .from("payments")
      .select("booking_id")
      .eq("id", attempt.payment_id)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment || (payment as { booking_id: string }).booking_id !== body["bookingId"])
      return fail("payment_not_found", "The payment attempt was not found.", 404);
    const generatedOrderSignature = String(body["orderId"]);
    if (
      !signatureMatches(
        `${generatedOrderSignature}|${String(body["paymentId"])}`,
        body["signature"],
        keySecret,
      )
    ) {
      return fail("invalid_signature", "The payment signature is invalid.", 400);
    }
    const paymentResponse = await gatewayRequest(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(String(body["paymentId"]))}`,
      keyId,
      keySecret,
      { method: "GET" },
      "fetch_payment",
      fetcher,
    );
    const remote = paymentResponse.body;
    if (
      !paymentResponse.response.ok ||
      !remote ||
      remote["order_id"] !== body["orderId"] ||
      remote["amount"] !== minorUnits(attempt.amount, attempt.currency_code.trim()) ||
      remote["currency"] !== attempt.currency_code.trim() ||
      remote["status"] !== "captured"
    ) {
      return fail("payment_not_confirmed", "Payment has not been confirmed yet.", 409);
    }
    const amount = majorUnits(remote["amount"], attempt.currency_code.trim());
    if (amount === null)
      return fail("payment_not_confirmed", "Payment has not been confirmed yet.", 409);
    const { data: finalized, error: finalizeError } = await database.rpc(
      "finalize_razorpay_payment",
      {
        p_order_id: body["orderId"],
        p_payment_id: body["paymentId"],
        p_amount: amount,
        p_currency_code: attempt.currency_code.trim(),
        p_captured: true,
      },
    );
    if (finalizeError) throw finalizeError;
    const state =
      typeof finalized === "string" ? finalized : Array.isArray(finalized) ? finalized[0] : null;
    if (state !== "FINALIZED" && state !== "REPLAYED" && state !== "CAPTURED_CANCELLED")
      return fail("payment_not_confirmed", "Payment could not be confirmed.", 409);
    return json({ verified: true, paymentStatus: "paid" });
  } catch {
    console.error(
      "[razorpay] payment verification failed",
      JSON.stringify({ area: "verify_payment" }),
    );
    return fail("payment_unavailable", "The request could not be completed.", 500);
  }
}

export async function handleRazorpayWebhook(
  request: Request,
  database: BookingDatabase,
  configuration: Env = env(),
): Promise<Response> {
  const keyId = configuration["RAZORPAY_KEY_ID"];
  const keySecret = configuration["RAZORPAY_KEY_SECRET"];
  const webhookSecret = configuration["RAZORPAY_WEBHOOK_SECRET"];
  if (!keyId?.startsWith("rzp_test_") || !keySecret || !webhookSecret)
    return fail("webhook_unavailable", "Webhook verification is not configured.", 503);
  if (Number(request.headers.get("content-length") ?? 0) > 64_000)
    return fail("invalid_request", "Webhook payload is too large.", 413);
  const rawBody = await request.text();
  if (rawBody.length > 64_000) return fail("invalid_request", "Webhook payload is too large.", 413);
  if (!signatureMatches(rawBody, request.headers.get("x-razorpay-signature"), webhookSecret)) {
    return fail("invalid_signature", "Webhook signature is invalid.", 400);
  }
  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("bad payload");
    payload = parsed as Record<string, unknown>;
  } catch {
    return fail("invalid_request", "Webhook payload is invalid.", 400);
  }
  const event = payload["event"];
  if (event !== "payment.captured" && event !== "payment.failed")
    return json({ received: true, ignored: true });
  const paymentNode = payload["payload"] as
    { payment?: { entity?: Record<string, unknown> } } | undefined;
  const entity = paymentNode?.payment?.entity;
  if (
    !entity ||
    !validIdentifier(entity["order_id"], /^order_[A-Za-z0-9]+$/) ||
    !validIdentifier(entity["id"], /^pay_[A-Za-z0-9]+$/) ||
    !Number.isSafeInteger(entity["amount"]) ||
    typeof entity["currency"] !== "string" ||
    !/^[A-Z]{3}$/.test(entity["currency"])
  ) {
    return fail("invalid_request", "Webhook payment details are invalid.", 400);
  }
  const amount = majorUnits(entity["amount"], entity["currency"]);
  if (amount === null) return fail("invalid_request", "Webhook payment details are invalid.", 400);
  try {
    const { data, error } = await database.rpc("finalize_razorpay_payment", {
      p_order_id: entity["order_id"],
      p_payment_id: entity["id"],
      p_amount: amount,
      p_currency_code: entity["currency"],
      p_captured: event === "payment.captured",
    });
    if (error) throw error;
    const result = typeof data === "string" ? data : Array.isArray(data) ? data[0] : null;
    if (result === "AMOUNT_OR_CURRENCY_MISMATCH") {
      console.error("[razorpay] webhook amount mismatch", JSON.stringify({ event }));
      return fail("payment_mismatch", "Payment details did not match the booking.", 400);
    }
    if (result === "ORDER_NOT_FOUND")
      return fail("payment_not_found", "The payment order was not found.", 404);
    if (result === "BOOKING_INELIGIBLE")
      return fail("booking_not_payable", "The booking is no longer eligible for payment.", 409);
    if (
      !new Set([
        "FINALIZED",
        "REPLAYED",
        "PAYMENT_FAILED",
        "ALREADY_FINALIZED",
        "CAPTURED_CANCELLED",
      ]).has(String(result))
    ) {
      return fail("payment_unavailable", "The webhook could not be processed.", 500);
    }
    return json({ received: true, processed: true });
  } catch {
    console.error(
      "[razorpay] webhook processing failed",
      JSON.stringify({ area: "webhook", event }),
    );
    return fail("payment_unavailable", "The webhook could not be processed.", 500);
  }
}

export async function handleGetBookingPaymentStatus(
  request: Request,
  database: BookingDatabase,
  configuration: Env = env(),
): Promise<Response> {
  const keySecret = configuration["RAZORPAY_KEY_SECRET"];
  const bookingId = new URL(request.url).searchParams.get("booking_id");
  const token = request.headers.get("x-booking-payment-token");
  if (
    !keySecret ||
    !validIdentifier(bookingId, /^[0-9a-f-]{36}$/i) ||
    !validPaymentToken(bookingId, token, keySecret)
  ) {
    return fail("invalid_request", "The booking status request is invalid.", 400);
  }
  try {
    const { data, error } = await database
      .from("bookings")
      .select(
        "booking_reference,status,payment_status,currency_code,total_amount,pickup_at,trip_type,package_tier,passenger_count,customer:customers(full_name),origin_city:cities!bookings_origin_city_id_fkey(name),destination_city:cities!bookings_destination_city_id_fkey(name),vehicle_category:vehicle_categories(name)",
      )
      .eq("id", bookingId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return fail("booking_not_found", "The booking was not found.", 404);
    return json({ booking: data });
  } catch {
    console.error(
      "[razorpay] booking status lookup failed",
      JSON.stringify({ area: "booking_status" }),
    );
    return fail("payment_unavailable", "The request could not be completed.", 500);
  }
}
