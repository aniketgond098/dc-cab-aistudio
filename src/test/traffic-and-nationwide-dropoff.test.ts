import { describe, expect, it } from "vitest";
import {
  calculateTrafficAwareDuration,
  OsrmRoutingProvider,
} from "@/lib/map/routing";
import { findCatalogMatch, findNearestCatalogLocation } from "@/components/booking/catalog-location-match";

describe("Traffic-aware routing calculations", () => {
  it("computes realistic urban travel time during daytime instead of theoretical free-flow", () => {
    // 25 km trip across Mumbai. Raw free-flow duration might be 0.4 hr (24 min).
    // In daytime Indian urban traffic, effective speed is ~22 km/h, taking ~1.1 to 1.3 hr.
    const daytime = "2026-11-04T07:00:00.000Z"; // 12:30 PM IST
    const result = calculateTrafficAwareDuration(25, 0.4, daytime);

    expect(result.trafficDurationHours).toBeGreaterThan(1.0);
    expect(result.trafficCondition).toBe("moderate");
    expect(result.trafficDelayMinutes).toBeGreaterThanOrEqual(30);
  });

  it("applies heavy traffic multiplier during morning/evening peak rush hours", () => {
    // 9:30 AM IST = 04:00 UTC
    const peakMorning = "2026-11-04T04:00:00.000Z";
    const result = calculateTrafficAwareDuration(20, 0.35, peakMorning);

    expect(result.trafficCondition).toBe("heavy");
    expect(result.trafficDurationHours).toBeGreaterThanOrEqual(1.1); // ~18 km/h max peak speed
  });

  it("applies light traffic conditions during late night", () => {
    // 1:30 AM IST = 20:00 UTC (previous day)
    const lateNight = "2026-11-04T20:00:00.000Z";
    const result = calculateTrafficAwareDuration(30, 0.6, lateNight);

    expect(result.trafficCondition).toBe("light");
    expect(result.trafficDurationHours).toBeLessThan(1.0);
  });

  it("computes outstation routes with city-egress and highway buffers", () => {
    // 150 km trip (e.g. Mumbai to Pune). Raw free-flow duration might be 1.8 hr.
    // Realistic travel time is ~3 to 3.5 hr.
    const daytime = "2026-11-04T07:00:00.000Z";
    const result = calculateTrafficAwareDuration(150, 1.8, daytime);

    expect(result.trafficDurationHours).toBeGreaterThanOrEqual(3.0);
  });

  it("integrates traffic duration seamlessly into OsrmRoutingProvider", async () => {
    const provider = new OsrmRoutingProvider();
    const pickup: [number, number] = [72.8557, 19.0926]; // Airport
    const destination: [number, number] = [72.8259, 18.915]; // Colaba

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          code: "Ok",
          routes: [
            {
              distance: 28000, // 28 km
              duration: 1800, // 30 min (free flow)
              geometry: {
                type: "LineString",
                coordinates: [pickup, destination],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    try {
      const estimate = await provider.getRoute(pickup, destination);
      expect(estimate.distanceKm).toBe(28);
      expect(estimate.durationHours).toBe(0.5); // base duration
      const traffic = calculateTrafficAwareDuration(
        estimate.distanceKm,
        estimate.durationHours,
        "2026-11-04T04:30:00.000Z", // 10:00 AM IST (peak hour)
      );
      expect(traffic.trafficDurationHours).toBeGreaterThan(1.0); // realistic urban traffic
      expect(traffic.trafficCondition).toBe("heavy");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("Nationwide dropoff destination catalog resolution", () => {
  it("resolves catalog location match for named locations", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          data: [
            {
              id: "a0000000-0000-4000-8000-000000000105",
              city_id: "a0000000-0000-4000-8000-000000000003",
              name: "Bandra Kurla Complex (BKC)",
              address: "G Block, BKC, Mumbai",
              latitude: 19.067115,
              longitude: 72.865725,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    try {
      const match = await findCatalogMatch("BKC", [72.8657, 19.0671]);
      expect(match).not.toBeNull();
      expect(match?.name).toContain("BKC");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("resolves nearest catalog location for arbitrary places in India", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          data: [
            {
              id: "a0000000-0000-4000-8000-000000000109",
              city_id: "a0000000-0000-4000-8000-000000000004",
              name: "Pune - Doorstep / City Address",
              address: "Pune",
              latitude: 18.5204,
              longitude: 73.8567,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    try {
      // Coordinates near Pune / Lonavala
      const nearest = await findNearestCatalogLocation([73.85, 18.52]);
      expect(nearest).not.toBeNull();
      expect(nearest?.id).toBe("a0000000-0000-4000-8000-000000000109");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
