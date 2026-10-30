import { useState } from "react";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, callback: (response: unknown) => void) => void;
    };
  }
}

type BookingPayment = {
  id: string;
  bookingReference: string;
  currency: string;
  total: number;
  paymentAccessToken: string;
  customer?: { fullName?: string; email?: string; phone?: string };
};

type GatewayOrder = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  bookingReference: string;
};
type CheckoutResponse = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

async function ensureCheckoutScript(): Promise<void> {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );
    const script = existing ?? document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Checkout could not be loaded."));
    if (!existing) document.head.append(script);
  });
}

export function PaymentCheckout({ booking }: { booking: BookingPayment }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function startCheckout() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      sessionStorage.setItem(`dc-payment:${booking.id}`, booking.paymentAccessToken);
      const response = await fetch("/api/v1/payments/create-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          paymentAccessToken: booking.paymentAccessToken,
        }),
      });
      const result = (await response.json()) as GatewayOrder | { error?: { message?: string } };
      if (!response.ok || !("orderId" in result)) {
        const errorMessage = "error" in result ? result.error?.message : undefined;
        throw new Error(errorMessage ?? "Payment could not be started.");
      }
      await ensureCheckoutScript();
      if (!window.Razorpay) throw new Error("Checkout could not be loaded.");
      const gateway = new window.Razorpay({
        key: result.keyId,
        order_id: result.orderId,
        amount: result.amount,
        currency: result.currency,
        name: "DC Cabs",
        description: `Booking ${result.bookingReference}`,
        prefill: {
          name: booking.customer?.fullName,
          email: booking.customer?.email,
          contact: booking.customer?.phone,
        },
        theme: { color: "#c8102e" },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (checkout: CheckoutResponse) => {
          const verified = await fetch("/api/v1/payments/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              bookingId: booking.id,
              paymentAccessToken: booking.paymentAccessToken,
              orderId: checkout.razorpay_order_id,
              paymentId: checkout.razorpay_payment_id,
              signature: checkout.razorpay_signature,
            }),
          });
          if (verified.ok)
            window.location.assign(
              `/booking-confirmation?booking_id=${encodeURIComponent(booking.id)}`,
            );
          else
            setMessage(
              "We are checking your payment. Refresh this page shortly to see the latest status.",
            );
          setBusy(false);
        },
      });
      gateway.on("payment.failed", () => {
        setMessage("Payment did not complete. You can try again while this booking remains valid.");
        setBusy(false);
      });
      gateway.open();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment could not be started.");
      setBusy(false);
    }
  }

  return (
    <div className="border border-border bg-charcoal p-6">
      <p className="eyebrow text-primary">Secure payment</p>
      <p className="mt-4 font-display text-3xl font-bold">
        {booking.currency} {booking.total.toFixed(2)}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">Booking {booking.bookingReference}</p>
      <button
        type="button"
        onClick={() => void startCheckout()}
        disabled={busy}
        className="mt-6 w-full bg-primary px-5 py-4 text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Opening secure checkout…" : "Pay securely"}
      </button>
      {message ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}
