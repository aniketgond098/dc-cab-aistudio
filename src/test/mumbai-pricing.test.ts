import { describe, expect, it } from "vitest";
import {
  createFallbackBookingDatabase,
  handleCreateBooking,
  handleCreateQuote,
  MUMBAI_CITY_ID,
  MUMBAI_PRICING_RULES,
  MUMBAI_VEHICLE_CATEGORIES,
} from "@/lib/booking-api";
import { OsrmRoutingProvider } from "@/lib/map/routing";

const DZIRE_ID = "a0000000-0000-4000-8000-000000000010";
const ERTIGA_ID = "a0000000-0000-4000-8000-000000000011";
const CRYSTA_ID = "a0000000-0000-4000-8000-000000000013";
const HYCROSS_ID = "a0000000-0000-4000-8000-000000000014";
const COACH_ID = "a0000000-0000-4000-8000-000000000018";

const MUMBAI_AIRPORT_T2_ID = "a0000000-0000-4000-8000-000000000102";
const MUMBAI_BKC_ID = "a0000000-0000-4000-8000-000000000105";
const MUMBAI_COLABA_ID = "a0000000-0000-4000-8000-000000000106";
const PUNE_CITY_ID = "a0000000-0000-4000-8000-000000000004";
const PUNE_AIRPORT_ID = "a0000000-0000-4000-8000-000000000107";

// Daylight pickup (11:00 AM IST = 05:30 UTC)
const DAY_PICKUP = "2026-12-01T05:30:00.000Z";
// Night pickup (10:30 PM IST = 17:00 UTC)
const NIGHT_PICKUP = "2026-12-01T17:00:00.000Z";

describe("Mumbai Vehicle Pricing and Fare Calculation System", () => {
  const db = createFallbackBookingDatabase();

  it("Scenario 1: Airport booking with Dzire under 30 km (base fare ₹1,199)", async () => {
    const response = await handleCreateQuote(
      new Request("https://site.test/api/v1/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tripType: "airport_transfer",
          packageTier: "airport_transfer",
          originLocationId: MUMBAI_AIRPORT_T2_ID,
          destinationCityId: MUMBAI_CITY_ID,
          destinationLocationId: MUMBAI_BKC_ID,
          pickupAt: DAY_PICKUP,
          vehicleCategoryId: DZIRE_ID,
          passengerCount: 2,
          estimatedDistanceKm: 15.0,
          estimatedDurationHours: 0.75,
        }),
      }),
      db,
    );

    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.pricing.components.baseFare).toBe(1199);
    expect(result.pricing.components.extraDistance).toBe(0);
    expect(result.pricing.components.extraDuration).toBe(0);
    expect(result.pricing.components.nightSurcharge).toBe(0);
    expect(result.pricing.components.total).toBe(1199);
  });

  it("Scenario 2: Airport booking exceeding 30 km (e.g. 35 km -> ₹1,199 + 5*₹15 = ₹1,274)", async () => {
    const response = await handleCreateQuote(
      new Request("https://site.test/api/v1/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tripType: "airport_transfer",
          packageTier: "airport_transfer",
          originLocationId: MUMBAI_AIRPORT_T2_ID,
          destinationCityId: MUMBAI_CITY_ID,
          destinationLocationId: MUMBAI_COLABA_ID,
          pickupAt: DAY_PICKUP,
          vehicleCategoryId: DZIRE_ID,
          passengerCount: 2,
          estimatedDistanceKm: 35.0,
          estimatedDurationHours: 1.5,
        }),
      }),
      db,
    );

    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.pricing.components.baseFare).toBe(1199);
    expect(result.pricing.components.extraDistance).toBe(75); // (35 - 30) * 15
    expect(result.pricing.components.extraDuration).toBe(0);
    expect(result.pricing.components.total).toBe(1274);
  });

  it("Scenario 3: Airport booking exceeding 2 hours (e.g. 3 hrs -> ₹1,199 + 1*₹150 = ₹1,349)", async () => {
    const response = await handleCreateQuote(
      new Request("https://site.test/api/v1/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tripType: "airport_transfer",
          packageTier: "airport_transfer",
          originLocationId: MUMBAI_AIRPORT_T2_ID,
          destinationCityId: MUMBAI_CITY_ID,
          destinationLocationId: MUMBAI_BKC_ID,
          pickupAt: DAY_PICKUP,
          vehicleCategoryId: DZIRE_ID,
          passengerCount: 2,
          estimatedDistanceKm: 25.0,
          estimatedDurationHours: 3.0,
        }),
      }),
      db,
    );

    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.pricing.components.baseFare).toBe(1199);
    expect(result.pricing.components.extraDistance).toBe(0);
    expect(result.pricing.components.extraDuration).toBe(150); // (3 - 2) * 150
    expect(result.pricing.components.total).toBe(1349);
  });

  it("Scenario 4: Local 4-hour Dzire under 40 km (base fare ₹1,449)", async () => {
    const response = await handleCreateQuote(
      new Request("https://site.test/api/v1/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tripType: "local",
          packageTier: "4hr_40km",
          originLocationId: MUMBAI_BKC_ID,
          destinationCityId: MUMBAI_CITY_ID,
          destinationLocationId: MUMBAI_COLABA_ID,
          pickupAt: DAY_PICKUP,
          vehicleCategoryId: DZIRE_ID,
          passengerCount: 2,
          estimatedDistanceKm: 28.0,
          estimatedDurationHours: 2.5,
        }),
      }),
      db,
    );

    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.pricing.components.baseFare).toBe(1449);
    expect(result.pricing.components.extraDistance).toBe(0);
    expect(result.pricing.components.extraDuration).toBe(0);
    expect(result.pricing.components.total).toBe(1449);
  });

  it("Scenario 5: Local 4-hour booking exceeding 40 km (e.g. 50 km -> ₹1,449 + 10*₹15 = ₹1,599)", async () => {
    const response = await handleCreateQuote(
      new Request("https://site.test/api/v1/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tripType: "local",
          packageTier: "4hr_40km",
          originLocationId: MUMBAI_BKC_ID,
          destinationCityId: MUMBAI_CITY_ID,
          destinationLocationId: MUMBAI_COLABA_ID,
          pickupAt: DAY_PICKUP,
          vehicleCategoryId: DZIRE_ID,
          passengerCount: 2,
          estimatedDistanceKm: 50.0,
          estimatedDurationHours: 3.5,
        }),
      }),
      db,
    );

    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.pricing.components.baseFare).toBe(1449);
    expect(result.pricing.components.extraDistance).toBe(150); // (50 - 40) * 15
    expect(result.pricing.components.extraDuration).toBe(0);
    expect(result.pricing.components.total).toBe(1599);
  });

  it("Scenario 6: Local 8-hour booking under 80 km (base fare ₹2,499)", async () => {
    const response = await handleCreateQuote(
      new Request("https://site.test/api/v1/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tripType: "local",
          packageTier: "8hr_80km",
          originLocationId: MUMBAI_BKC_ID,
          destinationCityId: MUMBAI_CITY_ID,
          destinationLocationId: MUMBAI_COLABA_ID,
          pickupAt: DAY_PICKUP,
          vehicleCategoryId: DZIRE_ID,
          passengerCount: 2,
          estimatedDistanceKm: 70.0,
          estimatedDurationHours: 7.0,
        }),
      }),
      db,
    );

    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.pricing.components.baseFare).toBe(2499);
    expect(result.pricing.components.extraDistance).toBe(0);
    expect(result.pricing.components.extraDuration).toBe(0);
    expect(result.pricing.components.total).toBe(2499);
  });

  it("Scenario 7: Local 8-hour booking exceeding 80 km (e.g. 90 km -> ₹2,499 + 10*₹15 = ₹2,649)", async () => {
    const response = await handleCreateQuote(
      new Request("https://site.test/api/v1/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tripType: "local",
          packageTier: "8hr_80km",
          originLocationId: MUMBAI_BKC_ID,
          destinationCityId: MUMBAI_CITY_ID,
          destinationLocationId: MUMBAI_COLABA_ID,
          pickupAt: DAY_PICKUP,
          vehicleCategoryId: DZIRE_ID,
          passengerCount: 2,
          estimatedDistanceKm: 90.0,
          estimatedDurationHours: 7.5,
        }),
      }),
      db,
    );

    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.pricing.components.baseFare).toBe(2499);
    expect(result.pricing.components.extraDistance).toBe(150); // (90 - 80) * 15
    expect(result.pricing.components.extraDuration).toBe(0);
    expect(result.pricing.components.total).toBe(2649);
  });

  it("Scenario 8: Multi-stop local booking correctly handles multi-waypoint coordinates", async () => {
    const provider = new OsrmRoutingProvider();
    // Verify multi-stop URL builder without hitting network failure
    const pickup: [number, number] = [72.8557, 19.0926]; // Airport
    const stop1: [number, number] = [72.8657, 19.0671]; // BKC
    const stop2: [number, number] = [72.8193, 18.9695]; // Mumbai Central
    const destination: [number, number] = [72.8259, 18.915]; // Colaba

    // Mock fetch to simulate OSRM multi-waypoint response
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = String(url);
      expect(urlStr).toContain("72.8557,19.0926;72.8657,19.0671;72.8193,18.9695;72.8259,18.915");
      return new Response(
        JSON.stringify({
          code: "Ok",
          routes: [
            {
              distance: 42500, // 42.5 km
              duration: 5400, // 1.5 hr
              geometry: {
                coordinates: [pickup, stop1, stop2, destination],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    try {
      const route = await provider.getRoute(pickup, destination, [stop1, stop2]);
      expect(route.distanceKm).toBeCloseTo(42.5, 1);
      expect(route.durationHours).toBeCloseTo(1.5, 1);
      expect(route.geometry.coordinates).toHaveLength(4);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("Scenario 9: Night booking (22:30 IST) applies ₹150 night charge once", async () => {
    const response = await handleCreateQuote(
      new Request("https://site.test/api/v1/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tripType: "airport_transfer",
          packageTier: "airport_transfer",
          originLocationId: MUMBAI_AIRPORT_T2_ID,
          destinationCityId: MUMBAI_CITY_ID,
          destinationLocationId: MUMBAI_BKC_ID,
          pickupAt: NIGHT_PICKUP, // 22:30 IST
          vehicleCategoryId: DZIRE_ID,
          passengerCount: 2,
          estimatedDistanceKm: 20.0,
          estimatedDurationHours: 1.0,
        }),
      }),
      db,
    );

    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.pricing.components.baseFare).toBe(1199);
    expect(result.pricing.components.nightSurcharge).toBe(150);
    expect(result.pricing.components.total).toBe(1349); // 1199 + 150
  });

  it("Scenario 10: Outstation booking below 300 km (Dzire 200 km -> 300 km min billing = ₹4,500 + ₹450 allowance = ₹4,950)", async () => {
    const response = await handleCreateQuote(
      new Request("https://site.test/api/v1/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tripType: "outstation",
          packageTier: "outstation",
          originLocationId: MUMBAI_BKC_ID,
          destinationCityId: PUNE_CITY_ID,
          destinationLocationId: PUNE_AIRPORT_ID,
          pickupAt: DAY_PICKUP,
          vehicleCategoryId: DZIRE_ID,
          passengerCount: 2,
          tripDays: 1,
          estimatedDistanceKm: 200.0,
          estimatedDurationHours: 4.5,
        }),
      }),
      db,
    );

    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.pricing.components.baseFare).toBe(4500); // 300 km minimum
    expect(result.pricing.components.extraDistance).toBe(0);
    expect(result.pricing.components.driverAllowance).toBe(450);
    expect(result.pricing.components.total).toBe(4950);
  });

  it("Scenario 11: Outstation booking above 300 km (Dzire 350 km -> 350*₹15 = ₹5,250 + ₹450 = ₹5,700)", async () => {
    const response = await handleCreateQuote(
      new Request("https://site.test/api/v1/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tripType: "outstation",
          packageTier: "outstation",
          originLocationId: MUMBAI_BKC_ID,
          destinationCityId: PUNE_CITY_ID,
          destinationLocationId: PUNE_AIRPORT_ID,
          pickupAt: DAY_PICKUP,
          vehicleCategoryId: DZIRE_ID,
          passengerCount: 2,
          tripDays: 1,
          estimatedDistanceKm: 350.0,
          estimatedDurationHours: 7.0,
        }),
      }),
      db,
    );

    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.pricing.components.baseFare).toBe(4500);
    expect(result.pricing.components.extraDistance).toBe(750); // (350 - 300) * 15
    expect(result.pricing.components.driverAllowance).toBe(450);
    expect(result.pricing.components.total).toBe(5700); // 4500 + 750 + 450
  });

  it("Scenario 12: Price-on-request category selection returns ONLINE_PRICING_UNAVAILABLE without fake price", async () => {
    const response = await handleCreateQuote(
      new Request("https://site.test/api/v1/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tripType: "local",
          packageTier: "4hr_40km",
          originLocationId: MUMBAI_BKC_ID,
          destinationCityId: MUMBAI_CITY_ID,
          destinationLocationId: MUMBAI_COLABA_ID,
          pickupAt: DAY_PICKUP,
          vehicleCategoryId: HYCROSS_ID,
          passengerCount: 4,
          estimatedDistanceKm: 25.0,
          estimatedDurationHours: 2.0,
        }),
      }),
      db,
    );

    expect(response.status).toBe(422);
    const result = await response.json();
    expect(result.error.code).toBe("online_pricing_unavailable");
  });

  it("Scenario 13: Passenger-based vehicle filtering hides sedans for 6 passengers, shows only coach for 45", () => {
    // 2 passengers: all categories suitable
    const for2 = MUMBAI_VEHICLE_CATEGORIES.filter((c) => c.passenger_capacity >= 2);
    expect(for2.some((c) => c.name === "Sedan")).toBe(true);

    // 6 passengers: Sedan (cap 4) must be hidden, SUV / Coach visible
    const for6 = MUMBAI_VEHICLE_CATEGORIES.filter((c) => c.passenger_capacity >= 6);
    expect(for6.some((c) => c.name === "Sedan")).toBe(false);
    expect(for6.some((c) => c.name === "SUV")).toBe(true);
    expect(for6.some((c) => c.name === "Premium SUV")).toBe(true);

    // 9 passengers: Sedan and SUV must be hidden
    const for9 = MUMBAI_VEHICLE_CATEGORIES.filter((c) => c.passenger_capacity >= 9);
    expect(for9.every((c) => c.passenger_capacity >= 9)).toBe(true);
    expect(for9.some((c) => c.name === "Group / Coach")).toBe(true);

    // 45 passengers: only Group / Coach (capacity 45) visible
    const for45 = MUMBAI_VEHICLE_CATEGORIES.filter((c) => c.passenger_capacity >= 45);
    expect(for45).toHaveLength(1);
    expect(for45[0]?.name).toBe("Group / Coach");
    expect(for45[0]?.passenger_capacity).toBe(45);
  });

  it("Scenario 14: Route calculation failure raises explicit error without straight-line fallback", async () => {
    const provider = new OsrmRoutingProvider();
    const originalFetch = globalThis.fetch;
    // Simulate routing network failure or invalid endpoint
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ code: "NoRoute" }), { status: 400 });
    }) as unknown as typeof fetch;

    try {
      await expect(
        provider.getRoute([72.8557, 19.0926], [72.8259, 18.915]),
      ).rejects.toThrow(/Routing request failed/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("Scenario 15: Server rejects browser price manipulation and enforces authoritative quote total", async () => {
    // 1. Create a legitimate quote
    const quoteResponse = await handleCreateQuote(
      new Request("https://site.test/api/v1/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tripType: "airport_transfer",
          packageTier: "airport_transfer",
          originLocationId: MUMBAI_AIRPORT_T2_ID,
          destinationCityId: MUMBAI_CITY_ID,
          destinationLocationId: MUMBAI_BKC_ID,
          pickupAt: DAY_PICKUP,
          vehicleCategoryId: DZIRE_ID,
          passengerCount: 2,
          estimatedDistanceKm: 20.0,
          estimatedDurationHours: 1.0,
        }),
      }),
      db,
    );
    const quote = await quoteResponse.json();
    const serverTotal = quote.pricing.components.total; // 1199

    // 2. Client attempts to submit booking with manipulated price fields (rejected by server schema)
    const tamperingResponse = await handleCreateBooking(
      new Request("https://site.test/api/v1/bookings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "test-tamper-key-scenario-15",
        },
        body: JSON.stringify({
          quoteId: quote.quoteId,
          total: 10, // Manipulated price
          fare: 10,
          customer: {
            fullName: "Legit Customer",
            email: "customer@example.com",
            phone: "+91 99871 17974",
          },
        }),
      }),
      db,
    );
    expect(tamperingResponse.status).toBe(400);

    // 3. Legitimate booking creation verifies server quote total is authoritative
    const bookingResponse = await handleCreateBooking(
      new Request("https://site.test/api/v1/bookings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "test-legit-key-scenario-15",
        },
        body: JSON.stringify({
          quoteId: quote.quoteId,
          customer: {
            fullName: "Legit Customer",
            email: "customer@example.com",
            phone: "+91 99871 17974",
          },
        }),
      }),
      db,
    );

    expect(bookingResponse.status).toBe(201);
    const bookingResult = await bookingResponse.json();
    expect(bookingResult.booking.total).toBe(serverTotal);
    expect(bookingResult.booking.total).toBe(1199);
  });
});
