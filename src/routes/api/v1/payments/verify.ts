import { createFileRoute } from "@tanstack/react-router";

import { createServerDatabaseForRequest, rejectCrossOriginRequest } from "@/lib/booking-api";
import { handleVerifyRazorpayPayment } from "@/lib/razorpay";

export const Route = createFileRoute("/api/v1/payments/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const originError = rejectCrossOriginRequest(request);
        if (originError) return originError;
        return handleVerifyRazorpayPayment(request, createServerDatabaseForRequest());
      },
    },
  },
});
