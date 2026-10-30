# Temporary Phase 5A test data

`phase5a_asian_paints_temporary_test_pricing.sql` seeds an internal test catalog and rate card for validating the booking and quote flow. The Asian Paints rates are **test-only** and are not approved DC Cabs public prices.

The seed covers India, Maharashtra, Mumbai, and Pune; six named Mumbai locations; three vehicle categories assigned to Mumbai; and nine pricing rules. It creates category availability only, with no individual vehicle inventory. The schema requires passenger capacities, so the seed uses Sedan 4, SUV 6, and SUV Premium 6 as test values. It does not invent luggage capacity or charges.

Local packages resolve city-wide in Mumbai. The existing resolver requires a destination city for outstation trips, so temporary outstation rules are scoped to Mumbai–Pune. This makes the stated generic outstation rate card testable through the current quote API without changing the resolver. Pune is only a destination city record; no Pune locations or vehicle inventory are seeded.

The active window is 2026-10-25 through 2026-12-31, inclusive. `effective_until` and category `valid_until` are stored as 2027-01-01 00:00 UTC, the exclusive upper bound. All tax, night, airport, toll, and driver charges are zero except the explicitly supplied ₹500/day outstation driver allowance. Local extra-km and extra-hour rates and outstation extra-km rates match the supplied card. Outstation is represented with a 300 km included/minimum distance in the current schema.

Apply the SQL with the Supabase SQL editor or the project's data-seeding workflow. It uses stable IDs and `ON CONFLICT` updates, so applying it repeatedly is safe. It is data-only and does not change migrations, schema, RLS, quote logic, payment behavior, or the application.

To remove this test catalog after testing, first remove any quotes/bookings that reference it according to the project's retention requirements, then delete pricing rules with IDs ending `0201`–`0209`, category availability for the seeded Mumbai/category IDs, the six locations ending `0101`–`0106`, the three categories ending `0010`–`0012`, and then the Mumbai and Pune city rows, Maharashtra region, and India country using the IDs in the seed. Foreign keys intentionally prevent deleting referenced test data.
