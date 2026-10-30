import { createFileRoute } from "@tanstack/react-router";

import { createServerDatabaseForRequest } from "@/lib/booking-api";
import { handleRazorpayWebhook } from "@/lib/razorpay";

export const Route = createFileRoute("/api/v1/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => handleRazorpayWebhook(request, createServerDatabaseForRequest()),
    },
  },
});
