import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

type BookingConfirmation = {
  booking_reference: string;
  status: string;
  payment_status: string;
  currency_code: string;
  total_amount: number | string;
  pickup_at: string;
  trip_type: string;
  package_tier: string;
  passenger_count: number;
  customer?: { full_name?: string } | null;
  origin_city?: { name?: string } | null;
  destination_city?: { name?: string } | null;
  vehicle_category?: { name?: string } | null;
};

export const Route = createFileRoute("/booking-confirmation")({
  component: BookingConfirmationPage,
});

function BookingConfirmationPage() {
  const bookingId = new URLSearchParams(
    typeof window === "undefined" ? "" : window.location.search,
  ).get("booking_id");
  const [booking, setBooking] = useState<BookingConfirmation | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!bookingId) {
      setError("The booking reference is missing.");
      return;
    }
    const token = sessionStorage.getItem(`dc-payment:${bookingId}`);
    if (!token) {
      setError("This booking status cannot be accessed from this browser session.");
      return;
    }
    const controller = new AbortController();
    let timeout: number | undefined;
    const loadStatus = async (attempt = 0) => {
      try {
        const response = await fetch(
          `/api/v1/payments/status?booking_id=${encodeURIComponent(bookingId)}`,
          {
            headers: { "x-booking-payment-token": token },
            signal: controller.signal,
          },
        );
        const body = (await response.json()) as {
          booking?: BookingConfirmation;
          error?: { message?: string };
        };
        if (!response.ok || !body.booking)
          throw new Error(body.error?.message ?? "Booking status could not be loaded.");
        setBooking(body.booking);
        if (
          body.booking.payment_status === "pending" &&
          attempt < 15 &&
          !controller.signal.aborted
        ) {
          timeout = window.setTimeout(() => void loadStatus(attempt + 1), 2_000);
        }
      } catch (cause: unknown) {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "Booking status could not be loaded.");
      }
    };
    void loadStatus();
    return () => {
      controller.abort();
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [bookingId]);

  return (
    <section className="container-x min-h-[70vh] py-28">
      <p className="eyebrow text-primary">DC Cabs · Booking update</p>
      {booking ? (
        <div className="mt-8 max-w-3xl">
          <h1 className="font-display text-5xl font-bold uppercase">
            {booking.payment_status === "paid" ? "Journey confirmed" : "Payment status"}
          </h1>
          <p className="mt-4 text-muted-foreground">
            Booking {booking.booking_reference} · {booking.status.replaceAll("_", " ")}
          </p>
          <div className="mt-10 grid gap-4 border-t border-border py-8 sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Payment</span>
              <br />
              {booking.payment_status.replaceAll("_", " ")}
            </p>
            <p>
              <span className="text-muted-foreground">Total</span>
              <br />
              {booking.currency_code} {Number(booking.total_amount).toFixed(2)}
            </p>
            <p>
              <span className="text-muted-foreground">Pickup</span>
              <br />
              {new Date(booking.pickup_at).toLocaleString()}
            </p>
            <p>
              <span className="text-muted-foreground">Route</span>
              <br />
              {booking.origin_city?.name ?? "Origin"} →{" "}
              {booking.destination_city?.name ?? "Destination"}
            </p>
            <p>
              <span className="text-muted-foreground">Vehicle</span>
              <br />
              {booking.vehicle_category?.name ?? booking.package_tier.replaceAll("_", " ")}
            </p>
            <p>
              <span className="text-muted-foreground">Guest</span>
              <br />
              {booking.customer?.full_name ?? "Guest"} · {booking.passenger_count} passengers
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            If your payment is still pending, wait briefly and refresh this page. For assistance,
            contact DC Cabs through our support page.
          </p>
          <Link
            to="/contact"
            className="mt-6 inline-block border border-border px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em]"
          >
            Contact support
          </Link>
        </div>
      ) : (
        <p role="status" className="mt-8 text-muted-foreground">
          {error || "Loading the latest booking status…"}
        </p>
      )}
    </section>
  );
}
