import { createFileRoute } from "@tanstack/react-router";

import {
  createServerDatabaseForRequest,
  handleCreateBooking,
  rejectCrossOriginRequest,
} from "@/lib/booking-api";

export const Route = createFileRoute("/api/v1/bookings")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const originError = rejectCrossOriginRequest(request);
        if (originError) return originError;
        try {
          return await handleCreateBooking(request, createServerDatabaseForRequest());
        } catch {
          return new Response(
            JSON.stringify({
              error: {
                code: "internal_server_error",
                message: "The request could not be completed.",
              },
            }),
            {
              status: 500,
              headers: {
                "content-type": "application/json; charset=utf-8",
                "cache-control": "no-store",
              },
            },
          );
        }
      },
    },
  },
});
