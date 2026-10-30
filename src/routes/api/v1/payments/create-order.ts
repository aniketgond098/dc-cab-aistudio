import { createFileRoute } from "@tanstack/react-router";

import { createServerDatabaseForRequest, rejectCrossOriginRequest } from "@/lib/booking-api";
import { handleCreateRazorpayOrder } from "@/lib/razorpay";

export const Route = createFileRoute("/api/v1/payments/create-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const originError = rejectCrossOriginRequest(request);
        if (originError) return originError;
        return handleCreateRazorpayOrder(request, createServerDatabaseForRequest());
      },
    },
  },
});
