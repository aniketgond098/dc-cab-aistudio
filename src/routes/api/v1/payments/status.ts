import { createFileRoute } from "@tanstack/react-router";

import { createServerDatabaseForRequest, rejectCrossOriginRequest } from "@/lib/booking-api";
import { handleGetBookingPaymentStatus } from "@/lib/razorpay";

export const Route = createFileRoute("/api/v1/payments/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const originError = rejectCrossOriginRequest(request);
        if (originError) return originError;
        return handleGetBookingPaymentStatus(request, createServerDatabaseForRequest());
      },
    },
  },
});
