import { describe, expect, it } from "vitest";
import {
  handleCatalog,
  createBookingDatabase,
  MUMBAI_CITY_ID,
  MUMBAI_VEHICLE_CATEGORIES,
} from "@/lib/booking-api";

describe("Mumbai vehicle categories and passenger filtering", () => {
  const database = createBookingDatabase({});
  const futureDate = new Date(Date.now() + 86400000).toISOString();

  it("returns exactly the 9 approved categories for Mumbai with models and pricing types", async () => {
    const response = await handleCatalog(
      new Request(
        `https://site.test/api/v1/catalog/vehicle-categories?city_id=${MUMBAI_CITY_ID}&pickup_at=${futureDate}`,
      ),
      "vehicle-categories",
      database,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: {
        vehicle_categories: {
          id: string;
          name: string;
          passenger_capacity: number;
          models?: string[];
          pricing_type?: string;
        };
      }[];
    };

    const categories = body.data.map((d) => d.vehicle_categories);
    expect(categories).toHaveLength(9);

    // 1. Sedan
    expect(categories[0]).toMatchObject({
      name: "Sedan",
      passenger_capacity: 4,
      pricing_type: "fixed",
    });
    expect(categories[0]?.models).toEqual(["Maruti Dzire", "Alma"]);

    // 2. SUV
    expect(categories[1]).toMatchObject({
      name: "SUV",
      passenger_capacity: 6,
      pricing_type: "fixed",
    });
    expect(categories[1]?.models).toEqual([
      "Maruti Ertiga",
      "Toyota Rumion",
      "Kia Carens",
      "Honda City",
      "Maruti Ciaz",
    ]);

    // 3. Premium SUV
    expect(categories[2]).toMatchObject({
      name: "Premium SUV",
      passenger_capacity: 7,
      pricing_type: "fixed",
    });
    expect(categories[2]?.models).toEqual(["Toyota Innova Crysta"]);

    // 4. Innova Hycross / Maruti Suzuki Invicto
    expect(categories[3]).toMatchObject({
      name: "Innova Hycross / Maruti Suzuki Invicto",
      passenger_capacity: 7,
      pricing_type: "price_on_request",
    });
    expect(categories[3]?.models).toEqual(["Toyota Innova Hycross", "Maruti Suzuki Invicto"]);

    // 5. Exclusive SUV
    expect(categories[4]).toMatchObject({
      name: "Exclusive SUV",
      passenger_capacity: 7,
      pricing_type: "price_on_request",
    });
    expect(categories[4]?.models).toEqual(["Toyota Fortuner", "Kia Carnival"]);

    // 6. Premium Sedan
    expect(categories[5]).toMatchObject({
      name: "Premium Sedan",
      passenger_capacity: 4,
      pricing_type: "price_on_request",
    });
    expect(categories[5]?.models).toEqual(["Toyota Camry"]);

    // 7. Luxury Sedan
    expect(categories[6]).toMatchObject({
      name: "Luxury Sedan",
      passenger_capacity: 4,
      pricing_type: "price_on_request",
    });
    expect(categories[6]?.models).toEqual([
      "BMW 5 Series",
      "Audi A6",
      "Mercedes E-Class",
      "Mercedes S-Class",
      "BMW 7 Series",
    ]);

    // 8. Luxury Van
    expect(categories[7]).toMatchObject({
      name: "Luxury Van",
      passenger_capacity: 7,
      pricing_type: "price_on_request",
    });
    expect(categories[7]?.models).toEqual([
      "Mercedes GLE 350",
      "Toyota Vellfire",
      "Mercedes V-Class",
    ]);

    // 9. Group / Coach
    expect(categories[8]).toMatchObject({
      name: "Group / Coach",
      passenger_capacity: 45,
      pricing_type: "price_on_request",
    });
    expect(categories[8]?.models).toEqual([
      "Urbania 9 Seater",
      "Urbania 16 Seater",
      "35 Seater BharatBenz",
      "45 Seater BharatBenz",
      "45 Seater Volvo",
    ]);
  });

  it("does not modify categories for other cities (e.g. Pune)", async () => {
    const PUNE_CITY_ID = "a0000000-0000-4000-8000-000000000004";
    const response = await handleCatalog(
      new Request(
        `https://site.test/api/v1/catalog/vehicle-categories?city_id=${PUNE_CITY_ID}&pickup_at=${futureDate}`,
      ),
      "vehicle-categories",
      database,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { vehicle_categories: { name: string } }[];
    };
    const names = body.data.map((d) => d.vehicle_categories.name);
    expect(names).toEqual(["Executive Sedan", "SUV / MUV", "Premium Luxury"]);
  });

  it("filters categories for 2 passengers (all 9 categories shown)", () => {
    const passengers = 2;
    const filtered = MUMBAI_VEHICLE_CATEGORIES.filter((c) => c.passenger_capacity >= passengers);
    expect(filtered).toHaveLength(9);
  });

  it("filters categories for 6 passengers (smaller vehicles < 6 disappear)", () => {
    const passengers = 6;
    const filtered = MUMBAI_VEHICLE_CATEGORIES.filter((c) => c.passenger_capacity >= passengers);
    const names = filtered.map((c) => c.name);

    // Sedan (4), Premium Sedan (4), Luxury Sedan (4) must be excluded
    expect(names).not.toContain("Sedan");
    expect(names).not.toContain("Premium Sedan");
    expect(names).not.toContain("Luxury Sedan");

    // Suitable categories must be present
    expect(names).toEqual([
      "SUV",
      "Premium SUV",
      "Innova Hycross / Maruti Suzuki Invicto",
      "Exclusive SUV",
      "Luxury Van",
      "Group / Coach",
    ]);
  });

  it("filters categories for 9 passengers (only categories with capacity >= 9 shown)", () => {
    const passengers = 9;
    const filtered = MUMBAI_VEHICLE_CATEGORIES.filter((c) => c.passenger_capacity >= passengers);
    const names = filtered.map((c) => c.name);
    expect(names).toEqual(["Group / Coach"]);
  });

  it("filters categories for 16 passengers (only categories with capacity >= 16 shown)", () => {
    const passengers = 16;
    const filtered = MUMBAI_VEHICLE_CATEGORIES.filter((c) => c.passenger_capacity >= passengers);
    const names = filtered.map((c) => c.name);
    expect(names).toEqual(["Group / Coach"]);
  });

  it("filters categories for 45 passengers (only 45-seater options shown)", () => {
    const passengers = 45;
    const filtered = MUMBAI_VEHICLE_CATEGORIES.filter((c) => c.passenger_capacity >= passengers);
    const names = filtered.map((c) => c.name);
    expect(names).toEqual(["Group / Coach"]);
  });

  it("verifies categories 1–3 support fixed pricing and categories 4–9 are price_on_request", () => {
    const fixedCategories = MUMBAI_VEHICLE_CATEGORIES.slice(0, 3);
    for (const category of fixedCategories) {
      expect(category.pricing_type).toBe("fixed");
    }

    const priceOnRequestCategories = MUMBAI_VEHICLE_CATEGORIES.slice(3);
    expect(priceOnRequestCategories).toHaveLength(6);
    for (const category of priceOnRequestCategories) {
      expect(category.pricing_type).toBe("price_on_request");
    }
  });
});
