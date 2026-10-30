import { afterEach, describe, expect, it, vi } from "vitest";
import { findCatalogMatch } from "@/components/booking/catalog-location-match";

const location = {
  id: "location-1",
  city_id: "city-1",
  name: "Mumbai Airport",
  address: "Terminal 2, Mumbai",
  latitude: 19.0896,
  longitude: 72.8656,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Mapbox catalog validation", () => {
  it("returns a catalog match for a successful lookup with a nearby location", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: [location] })));

    await expect(findCatalogMatch("Mumbai Airport", [72.8656, 19.0896])).resolves.toEqual(location);
  });

  it("returns no match only after a successful lookup with no nearby location", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: [] })));

    await expect(findCatalogMatch("Unknown Place", [72.8656, 19.0896])).resolves.toBeNull();
  });

  it("reports a temporary catalog error when the lookup returns a non-success response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(findCatalogMatch("Mumbai Airport", [72.8656, 19.0896])).rejects.toThrow(
      "DC Cabs locations are temporarily unavailable. Please try again.",
    );
  });

  it("reports a temporary catalog error when the lookup network request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(findCatalogMatch("Mumbai Airport", [72.8656, 19.0896])).rejects.toThrow(
      "DC Cabs locations are temporarily unavailable. Please try again.",
    );
  });
});
