import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  createBookingPaymentToken,
  handleCreateRazorpayOrder,
  handleRazorpayWebhook,
  handleVerifyRazorpayPayment,
} from "@/lib/razorpay";
import type { BookingDatabase } from "@/lib/booking-api";

const bookingId = "10000000-0000-4000-8000-000000000001";
const keyId = "rzp_test_public";
const keySecret = "test-secret-that-is-not-production";
const webhookSecret = "webhook-test-secret";
const env = {
  RAZORPAY_KEY_ID: keyId,
  RAZORPAY_KEY_SECRET: keySecret,
  RAZORPAY_WEBHOOK_SECRET: webhookSecret,
};
const token = createBookingPaymentToken(bookingId, keySecret);

function db(
  options: {
    result?: Record<string, unknown>;
    rpc?: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>;
    tables?: Record<string, unknown>;
  } = {},
) {
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
  const fromCalls: string[] = [];
  const fake = {
    async rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      if (options.rpc) return options.rpc(name, args);
      if (name === "begin_booking_payment_attempt") return { data: [options.result], error: null };
      if (name === "attach_booking_payment_order") return { data: true, error: null };
      if (name === "fail_booking_payment_order") return { data: true, error: null };
      if (name === "finalize_razorpay_payment") return { data: "FINALIZED", error: null };
      return { data: null, error: null };
    },
    from(table: string) {
      fromCalls.push(table);
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq"]) chain[method] = () => chain;
      chain["maybeSingle"] = async () => ({ data: options.tables?.[table] ?? null, error: null });
      return chain;
    },
  };
  return { database: fake as unknown as BookingDatabase, rpcCalls, fromCalls };
}

function orderResult(status = "CREATED") {
  return {
    result_status: status,
    payment_id: "payment-record-1",
    attempt_id: "20000000-0000-4000-8000-000000000001",
    provider_order_id: status === "REUSE" ? "order_existing123" : "dc_pending_fake",
    amount: "1250.00",
    currency_code: "INR",
    booking_reference: "DC-ABC123",
  };
}

function request(body: unknown, path = "/api/v1/payments/create-order") {
  return new Request(`https://site.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Razorpay order creation", () => {
  it("uses the database amount and ignores a browser amount override", async () => {
    const database = db({ result: orderResult() });
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(sent).toMatchObject({
        amount: 125000,
        currency: "INR",
        receipt: "DC-ABC123-20000000",
      });
      expect(sent).not.toHaveProperty("amount", 100);
      return Response.json({ id: "order_created123" }, { status: 200 });
    });
    const response = await handleCreateRazorpayOrder(
      request({ bookingId, paymentAccessToken: token, amount: 1, currency: "USD" }),
      database.database,
      env,
      fetcher,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      keyId,
      orderId: "order_created123",
      amount: 125000,
      currency: "INR",
      bookingReference: "DC-ABC123",
    });
    expect(database.rpcCalls.map((call) => call.name)).toEqual([
      "begin_booking_payment_attempt",
      "attach_booking_payment_order",
    ]);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("rejects an arbitrary booking ID without calling the database", async () => {
    const database = db({ result: orderResult() });
    const response = await handleCreateRazorpayOrder(
      request({ bookingId, paymentAccessToken: "forged" }),
      database.database,
      env,
      fetch,
    );
    expect(response.status).toBe(400);
    expect(database.rpcCalls).toHaveLength(0);
  });

  it.each([
    ["ALREADY_PAID", 409],
    ["EXPIRED", 409],
    ["CANCELLED", 409],
    ["NOT_FOUND", 404],
  ])("blocks booking state %s", async (status, expectedStatus) => {
    const database = db({ result: { ...orderResult(), result_status: status } });
    const response = await handleCreateRazorpayOrder(
      request({ bookingId, paymentAccessToken: token }),
      database.database,
      env,
      fetch,
    );
    expect(response.status).toBe(expectedStatus);
  });

  it("reuses an existing provider order on a repeated request", async () => {
    const database = db({ result: orderResult("REUSE") });
    const fetcher = vi.fn();
    const response = await handleCreateRazorpayOrder(
      request({ bookingId, paymentAccessToken: token }),
      database.database,
      env,
      fetcher as typeof fetch,
    );
    expect(response.status).toBe(200);
    expect(((await response.json()) as { orderId: string }).orderId).toBe("order_existing123");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refuses live key IDs while this integration is test-mode only", async () => {
    const database = db({ result: orderResult() });
    const fetcher = vi.fn();
    const response = await handleCreateRazorpayOrder(
      request({ bookingId, paymentAccessToken: token }),
      database.database,
      { ...env, RAZORPAY_KEY_ID: "rzp_live_private" },
      fetcher as typeof fetch,
    );
    expect(response.status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
    expect(database.rpcCalls).toHaveLength(0);
  });
});

describe("Razorpay Checkout signature verification", () => {
  const paymentId = "pay_captured123";
  const orderId = "order_existing123";
  const signature = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");

  it("rejects an invalid signature before requesting payment details", async () => {
    const database = db({
      tables: {
        payment_attempts: {
          id: "attempt-1",
          payment_id: "payment-record-1",
          provider_order_id: orderId,
          amount: "1250.00",
          currency_code: "INR",
          status: "created",
        },
        payments: { booking_id: bookingId },
      },
    });
    const fetcher = vi.fn();
    const response = await handleVerifyRazorpayPayment(
      request(
        { bookingId, paymentAccessToken: token, orderId, paymentId, signature: "0".repeat(64) },
        "/api/v1/payments/verify",
      ),
      database.database,
      env,
      fetcher as typeof fetch,
    );
    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
    expect(database.rpcCalls).toHaveLength(0);
  });

  it("verifies the provider payment and finalizes the stored attempt", async () => {
    const database = db({
      tables: {
        payment_attempts: {
          id: "attempt-1",
          payment_id: "payment-record-1",
          provider_order_id: orderId,
          amount: "1250.00",
          currency_code: "INR",
          status: "created",
        },
        payments: { booking_id: bookingId },
      },
    });
    const fetcher = vi.fn(async () =>
      Response.json({
        id: paymentId,
        order_id: orderId,
        amount: 125000,
        currency: "INR",
        status: "captured",
      }),
    );
    const response = await handleVerifyRazorpayPayment(
      request(
        { bookingId, paymentAccessToken: token, orderId, paymentId, signature },
        "/api/v1/payments/verify",
      ),
      database.database,
      env,
      fetcher as typeof fetch,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ verified: true, paymentStatus: "paid" });
    expect(database.rpcCalls.at(-1)).toMatchObject({
      name: "finalize_razorpay_payment",
      args: {
        p_order_id: orderId,
        p_payment_id: paymentId,
        p_amount: 1250,
        p_currency_code: "INR",
        p_captured: true,
      },
    });
  });

  it("does not finalize a remote amount, currency, order, or state mismatch", async () => {
    const database = db({
      tables: {
        payment_attempts: {
          id: "attempt-1",
          payment_id: "payment-record-1",
          provider_order_id: orderId,
          amount: "1250.00",
          currency_code: "INR",
          status: "created",
        },
        payments: { booking_id: bookingId },
      },
    });
    const fetcher = vi.fn(async () =>
      Response.json({
        id: paymentId,
        order_id: orderId,
        amount: 100,
        currency: "INR",
        status: "captured",
      }),
    );
    const response = await handleVerifyRazorpayPayment(
      request(
        { bookingId, paymentAccessToken: token, orderId, paymentId, signature },
        "/api/v1/payments/verify",
      ),
      database.database,
      env,
      fetcher as typeof fetch,
    );
    expect(response.status).toBe(409);
    expect(database.rpcCalls).toHaveLength(0);
  });

  it.each([
    { order_id: "order_other123", amount: 125000, currency: "INR", status: "captured" },
    { order_id: "order_existing123", amount: 125000, currency: "USD", status: "captured" },
    { order_id: "order_existing123", amount: 125000, currency: "INR", status: "authorized" },
  ])("does not finalize a mismatched order/currency or uncaptured payment", async (remote) => {
    const database = db({
      tables: {
        payment_attempts: {
          id: "attempt-1",
          payment_id: "payment-record-1",
          provider_order_id: orderId,
          amount: "1250.00",
          currency_code: "INR",
          status: "created",
        },
        payments: { booking_id: bookingId },
      },
    });
    const fetcher = vi.fn(async () => Response.json({ id: paymentId, ...remote }));
    const response = await handleVerifyRazorpayPayment(
      request(
        { bookingId, paymentAccessToken: token, orderId, paymentId, signature },
        "/api/v1/payments/verify",
      ),
      database.database,
      env,
      fetcher as typeof fetch,
    );
    expect(response.status).toBe(409);
    expect(database.rpcCalls).toHaveLength(0);
  });
});

describe("Razorpay webhook", () => {
  const raw = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_captured123",
          order_id: "order_existing123",
          amount: 125000,
          currency: "INR",
        },
      },
    },
  });
  const signature = createHmac("sha256", webhookSecret).update(raw).digest("hex");

  it("verifies the raw body signature and handles idempotent provider finalization", async () => {
    const database = db({ rpc: async () => ({ data: "REPLAYED", error: null }) });
    const response = await handleRazorpayWebhook(
      new Request("https://site.test/api/v1/payments/webhook", {
        method: "POST",
        headers: { "content-type": "application/json", "x-razorpay-signature": signature },
        body: raw,
      }),
      database.database,
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, processed: true });
    expect(database.rpcCalls[0]).toMatchObject({
      name: "finalize_razorpay_payment",
      args: {
        p_order_id: "order_existing123",
        p_payment_id: "pay_captured123",
        p_amount: 1250,
        p_currency_code: "INR",
        p_captured: true,
      },
    });
  });

  it("rejects an invalid webhook signature without calling the database", async () => {
    const database = db();
    const response = await handleRazorpayWebhook(
      new Request("https://site.test/api/v1/payments/webhook", {
        method: "POST",
        headers: { "x-razorpay-signature": "0".repeat(64) },
        body: raw,
      }),
      database.database,
      env,
    );
    expect(response.status).toBe(400);
    expect(database.rpcCalls).toHaveLength(0);
  });

  it("refuses mismatched amount/currency returned by the atomic database function", async () => {
    const mismatched = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_captured123",
            order_id: "order_existing123",
            amount: 100,
            currency: "INR",
          },
        },
      },
    });
    const signed = createHmac("sha256", webhookSecret).update(mismatched).digest("hex");
    const database = db({
      rpc: async () => ({ data: "AMOUNT_OR_CURRENCY_MISMATCH", error: null }),
    });
    const response = await handleRazorpayWebhook(
      new Request("https://site.test/api/v1/payments/webhook", {
        method: "POST",
        headers: { "x-razorpay-signature": signed },
        body: mismatched,
      }),
      database.database,
      env,
    );
    expect(response.status).toBe(400);
    expect(database.rpcCalls).toHaveLength(1);
  });

  it("records a signed payment failure without marking it captured", async () => {
    const failedPayload = JSON.stringify({
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            id: "pay_failed123",
            order_id: "order_existing123",
            amount: 125000,
            currency: "INR",
          },
        },
      },
    });
    const signed = createHmac("sha256", webhookSecret).update(failedPayload).digest("hex");
    const database = db({ rpc: async () => ({ data: "PAYMENT_FAILED", error: null }) });
    const response = await handleRazorpayWebhook(
      new Request("https://site.test/api/v1/payments/webhook", {
        method: "POST",
        headers: { "x-razorpay-signature": signed },
        body: failedPayload,
      }),
      database.database,
      env,
    );
    expect(response.status).toBe(200);
    expect(database.rpcCalls[0]?.args["p_captured"]).toBe(false);
  });
});
