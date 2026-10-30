import { describe, expect, it } from "vitest";
import { canContinueJourney } from "@/lib/booking-journey";

const activePickup = { id: "pickup-1", bookable: true };
const activeDestination = { id: "destination-1", bookable: true };

describe("booking journey readiness", () => {
  it.each(["Mapbox token unavailable", "Mapbox Directions failed"])(
    "allows a valid catalog journey to continue when %s",
    () => {
      const pickupAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      expect(
        canContinueJourney({
          pickup: activePickup,
          destination: activeDestination,
          pickupAt,
          categoriesError: "",
        }),
      ).toBe(true);
    },
  );

  it("still requires both locations to be bookable catalog entries", () => {
    const pickupAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    expect(
      canContinueJourney({
        pickup: activePickup,
        destination: { id: "outside-catalog", bookable: false },
        pickupAt,
        categoriesError: "",
      }),
    ).toBe(false);
  });
});
