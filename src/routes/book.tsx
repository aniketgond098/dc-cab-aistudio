import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookingRouteMap, type RouteEstimate } from "@/components/booking/BookingRouteMap";
import { calculateTrafficAwareDuration } from "@/lib/map/routing";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { JourneyLocation, LocationSearch } from "@/components/booking/LocationSearch";
import type { CatalogLocation } from "@/components/booking/catalog-location-match";
import { PaymentCheckout } from "@/components/booking/PaymentCheckout";
import { VehicleCategoryCard, type Category } from "@/components/booking/VehicleCategoryCard";
import { canContinueJourney } from "@/lib/booking-journey";
import { clientCities } from "@/content/site";

type TripType = "local" | "outstation" | "airport_transfer";
type Quote = {
  quoteId: string;
  expiresAt: string;
  pricing: {
    currency?: string;
    components?: Record<string, number | string | null>;
    allowances?: Record<string, number | null>;
    inputs?: Record<string, number | null>;
  };
};
type Booking = {
  id: string;
  bookingReference: string;
  currency: string;
  total: number;
  paymentAccessToken?: string;
  customer: { fullName: string; email: string; phone: string };
};

const packages: Record<TripType, { value: string; label: string }[]> = {
  local: [
    { value: "4hr_40km", label: "Local Rental – 4 Hours / 40 KM" },
    { value: "8hr_80km", label: "Local Rental – 8 Hours / 80 KM" },
  ],
  outstation: [{ value: "outstation", label: "Outstation" }],
  airport_transfer: [{ value: "airport_transfer", label: "Airport Transfer" }],
};

function todayDate() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function money(value: unknown, currency: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

function titleForComponent(value: string) {
  switch (value) {
    case "baseFare":
      return "Base Fare";
    case "extraDistance":
      return "Extra Kilometres";
    case "extraDuration":
      return "Extra Hours";
    case "driverAllowance":
      return "Driver Allowance";
    case "nightSurcharge":
      return "Night Charge (10 PM – 6 AM)";
    case "airportCharge":
      return "Airport Entry / Parking";
    case "tolls":
      return "Tolls";
    case "subtotal":
      return "Subtotal";
    case "tax":
      return "GST / Tax";
    case "total":
      return "Total Authoritative Fare";
    default:
      return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
  }
}

function JourneyRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-4">
      <div>
        <p className="eyebrow">{label}</p>
        <p className="mt-2 text-sm">{value}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="text-xs uppercase tracking-widest text-primary hover:text-primary-tint"
      >
        Edit
      </button>
    </div>
  );
}

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Plan Your Journey | DC Cabs" },
      {
        name: "description",
        content:
          "Choose your journey, chauffeur category and travel details to receive a server-generated DC Cabs fare.",
      },
    ],
  }),
  component: BookingPage,
});

function BookingPage() {
  const [step, setStep] = useState(1);
  const [cityId, setCityId] = useState("a0000000-0000-4000-8000-000000000003");
  const [cities, setCities] = useState<{ id: string; name: string }[]>(clientCities);
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const cityDropdownRef = useRef<HTMLDivElement | null>(null);
  const [cityLocations, setCityLocations] = useState<CatalogLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [tripType, setTripType] = useState<TripType>("local");
  const [packageTier, setPackageTier] = useState("4hr_40km");
  const [pickup, setPickup] = useState<JourneyLocation | null>(null);
  const [stops, setStops] = useState<JourneyLocation[]>([]);
  const [destination, setDestination] = useState<JourneyLocation | null>(null);
  const [routeEstimate, setRouteEstimate] = useState<RouteEstimate | null>(null);
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [passengers, setPassengers] = useState(2);
  const [tripDays, setTripDays] = useState(1);
  const [vehicleId, setVehicleId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryRetry, setCategoryRetry] = useState(0);
  const [categoriesError, setCategoriesError] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pricingUnavailable, setPricingUnavailable] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [quoteRequestSubmitted, setQuoteRequestSubmitted] = useState(false);

  useEffect(() => {
    fetch("/api/v1/catalog/cities?country_id=a0000000-0000-4000-8000-000000000001")
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (result?.data && Array.isArray(result.data) && result.data.length > 0) {
          setCities(result.data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!cityId) return;
    setLocationsLoading(true);
    fetch(`/api/v1/catalog/locations?city_id=${cityId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (result?.data && Array.isArray(result.data)) {
          setCityLocations(result.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        setLocationsLoading(false);
      });
  }, [cityId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target as Node)) {
        setCityDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelectCity(newCityId: string) {
    if (cityId !== newCityId) {
      setCityId(newCityId);
      setPickup(null);
      setStops([]);
      setDestination(null);
      setRouteEstimate(null);
      invalidateQuote();
    }
  }

  const QUICK_HUBS = [
    "Mumbai",
    "Delhi",
    "Bengaluru",
    "Hyderabad",
    "Chennai",
    "Kolkata",
    "Pune",
    "Ahmedabad",
    "Jaipur",
    "Goa",
    "Chandigarh",
    "Kochi",
    "Lucknow",
  ];

  const filteredCities = useMemo(() => {
    if (!citySearchQuery.trim()) return cities;
    const q = citySearchQuery.toLowerCase();
    return cities.filter((c) => c.name.toLowerCase().includes(q));
  }, [cities, citySearchQuery]);

  const selectedCity = cities.find((c) => c.id === cityId) ?? { id: cityId, name: "City" };

  const pickupAt = useMemo(() => {
    if (!pickupDate || !pickupTime) return "";
    const date = new Date(`${pickupDate}T${pickupTime}`);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }, [pickupDate, pickupTime]);

  const trafficEstimate = useMemo(() => {
    if (!routeEstimate) return null;
    return calculateTrafficAwareDuration(
      routeEstimate.distanceKm,
      routeEstimate.durationHours,
      pickupAt || undefined,
    );
  }, [routeEstimate, pickupAt]);

  const availableCategories = useMemo(() => {
    return categories.filter((category) => category.passenger_capacity >= passengers);
  }, [categories, passengers]);

  const selectedCategory = categories.find((category) => category.id === vehicleId) ?? null;

  // Auto-clear invalid vehicle selection if passenger count changes beyond category capacity
  useEffect(() => {
    if (selectedCategory && selectedCategory.passenger_capacity < passengers) {
      setVehicleId("");
      invalidateQuote();
      setMessage(
        `The previously selected category (${selectedCategory.name}) accommodates up to ${selectedCategory.passenger_capacity} passengers. Please select an available vehicle category for ${passengers} passengers.`,
      );
    }
  }, [passengers, selectedCategory]);

  const quoteExpired = Boolean(quote && secondsLeft <= 0);
  const pickupLabel = pickup?.label ?? "Pickup location";
  const destinationLabel = destination?.label ?? "Destination";
  const intermediateStopsText = stops
    .map((s) => s.label.trim())
    .filter(Boolean)
    .join(" → ");
  const enquiryRoute = intermediateStopsText
    ? `${pickupLabel} → ${intermediateStopsText} → ${destinationLabel}`.slice(0, 250)
    : `${pickupLabel} → ${destinationLabel}`.slice(0, 200);
  const tripTypeLabel =
    tripType === "airport_transfer"
      ? "Airport transfer"
      : tripType === "outstation"
        ? "Outstation"
        : "Local";
  const quoteLines = quote?.pricing.components
    ? Object.entries(quote.pricing.components).filter(
        ([key, val]) =>
          key !== "taxRatePercent" &&
          (key === "baseFare" ||
            key === "total" ||
            (typeof val === "number" && val > 0)),
      )
    : [];

  useEffect(() => {
    if (!quote) return;
    const update = () =>
      setSecondsLeft(Math.max(0, Math.ceil((Date.parse(quote.expiresAt) - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [quote]);

  useEffect(() => {
    if (!pickup?.bookable || !pickup.id || !pickupAt) {
      setCategories([]);
      setVehicleId("");
      return;
    }
    const controller = new AbortController();
    setCategoriesLoading(true);
    setCategoriesError("");
    const params = new URLSearchParams({ city_id: pickup.cityId ?? "", pickup_at: pickupAt });
    void fetch(`/api/v1/catalog/vehicle-categories?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as {
          data?: { vehicle_categories?: Category }[];
          error?: { message?: string };
        };
        if (!response.ok || !Array.isArray(result.data))
          throw new Error(result.error?.message ?? "Vehicle categories could not be loaded.");
        setCategories(
          result.data
            .map((entry) => entry.vehicle_categories)
            .filter((entry): entry is Category => Boolean(entry)),
        );
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setCategoriesError(
            cause instanceof Error ? cause.message : "Vehicle categories could not be loaded.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setCategoriesLoading(false);
      });
    return () => controller.abort();
  }, [pickup?.id, pickup?.cityId, pickup?.bookable, pickupAt, categoryRetry]);

  function invalidateQuote() {
    setQuote(null);
    setBooking(null);
    setIdempotencyKey("");
    setPricingUnavailable(false);
    setMessage("");
    setQuoteRequestSubmitted(false);
  }

  function setTrip(value: TripType) {
    setTripType(value);
    setPackageTier(packages[value][0]?.value ?? "custom");
    if (value !== "local") {
      setStops([]);
    }
    setRouteEstimate(null);
    invalidateQuote();
  }

  function addStop() {
    if (stops.length >= 5) return;
    setStops((prev) => [...prev, { label: "", context: "", coordinates: null, bookable: false }]);
    setRouteEstimate(null);
    invalidateQuote();
  }

  function updateStop(index: number, location: JourneyLocation | null) {
    setStops((prev) => {
      const copy = [...prev];
      if (location) copy[index] = location;
      else copy.splice(index, 1);
      return copy;
    });
    setRouteEstimate(null);
    invalidateQuote();
  }

  function removeStop(index: number) {
    setStops((prev) => prev.filter((_, i) => i !== index));
    setRouteEstimate(null);
    invalidateQuote();
  }

  function moveStop(index: number, direction: "up" | "down") {
    setStops((prev) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index]!;
      copy[index] = copy[targetIndex]!;
      copy[targetIndex] = temp;
      return copy;
    });
    setRouteEstimate(null);
    invalidateQuote();
  }

  async function requestQuote() {
    if (!pickup?.id || !destination?.id || !pickupAt || !vehicleId) return;
    if (!routeEstimate) {
      setMessage(
        "Driving route distance could not be determined. Please ensure your locations are selected and the route preview has loaded, or click Retry.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    setPricingUnavailable(false);
    try {
      const response = await fetch("/api/v1/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tripType,
          packageTier,
          originLocationId: pickup.id,
          destinationCityId: destination.cityId,
          destinationLocationId: destination.id,
          pickupAt,
          vehicleCategoryId: vehicleId,
          passengerCount: passengers,
          tripDays,
          estimatedDistanceKm: Number(routeEstimate.distanceKm.toFixed(2)),
          estimatedDurationHours: Number(
            (trafficEstimate?.trafficDurationHours ?? routeEstimate.durationHours).toFixed(2),
          ),
        }),
      });
      let result: (Quote | { error?: { code?: string; message?: string } }) | null = null;
      try {
        result = (await response.json()) as Quote | { error?: { code?: string; message?: string } };
      } catch {
        result = null;
      }

      if (!response.ok || !result || !("quoteId" in result)) {
        const apiError = result && "error" in result ? result.error : undefined;
        if (apiError?.code === "online_pricing_unavailable") {
          setPricingUnavailable(true);
          setMessage(
            "Online fares aren't available for this journey yet. Request a quote from our team.",
          );
        } else {
          setMessage(
            apiError?.message ??
              "A fare could not be created. Please review your journey and try again.",
          );
        }
        return;
      }
      setQuote(result);
      setStep(4);
    } catch (err) {
      console.error("[book] quote request failed:", err);
      setMessage("We could not reach the fare service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function createBooking() {
    if (!quote || quoteExpired || busy) return;
    const key = idempotencyKey || crypto.randomUUID();
    setIdempotencyKey(key);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/v1/bookings", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({
          quoteId: quote.quoteId,
          customer: {
            fullName: name,
            email,
            phone,
            ...(company.trim() ? { companyName: company.trim() } : {}),
          },
          ...(instructions.trim() ? { specialInstructions: instructions.trim() } : {}),
        }),
      });
      const result = (await response.json()) as { booking?: Booking; error?: { message?: string } };
      if (!response.ok || !result.booking)
        throw new Error(result.error?.message ?? "Your booking could not be created.");
      setBooking({ ...result.booking, customer: { fullName: name, email, phone } });
      setStep(6);
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Your booking could not be created. Try again safely.",
      );
    } finally {
      setBusy(false);
    }
  }

  const stopsValid = tripType !== "local" || stops.every((s) => s.bookable && Boolean(s.id));
  const journeyReady =
    canContinueJourney({
      pickup,
      destination,
      pickupAt,
      categoriesError,
    }) && stopsValid;
  const canContinueVehicle = Boolean(
    selectedCategory && passengers <= selectedCategory.passenger_capacity,
  );

  return (
    <section className="container-x min-h-[75vh] py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <p className="eyebrow flex items-center gap-3 text-primary">
          <span className="h-px w-8 bg-primary" /> DC Cabs · Online booking
        </p>
        <div className="mt-6 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <h1 className="font-display text-[clamp(3rem,7vw,6rem)] font-extrabold uppercase">
              Plan your journey
            </h1>
            <p className="mt-5 max-w-2xl leading-relaxed text-muted-foreground">
              Choose your journey, vehicle and travel details. We’ll return a fare from the DC Cabs
              booking service.
            </p>
          </div>
          <p className="eyebrow text-foreground/60">Premium mobility, thoughtfully arranged</p>
        </div>

        <div className="mt-12 border-y border-border py-6">
          <BookingProgress step={step - 1} onStep={(nextStep) => setStep(nextStep + 1)} />
        </div>

        {message ? (
          <div
            role="status"
            className={`mt-6 border p-4 text-sm ${pricingUnavailable ? "border-primary/50 bg-charcoal" : "border-border bg-charcoal"}`}
          >
            {pricingUnavailable ? (
              <p className="eyebrow text-primary">Online fare unavailable</p>
            ) : null}
            <p className="mt-1">{message}</p>
            {pricingUnavailable ? (
              <Link
                to="/contact"
                search={{
                  type: "Other",
                  route: enquiryRoute,
                  date: pickupDate,
                  travelers: String(passengers),
                  message: `Online fare unavailable for ${tripTypeLabel.toLowerCase()}. Pickup time: ${pickupTime}. Vehicle: ${selectedCategory?.name ?? "Not selected"}.`,
                }}
                className="mt-4 inline-block text-xs font-bold uppercase tracking-[0.18em] text-primary underline underline-offset-4"
              >
                Request a quote from our team
              </Link>
            ) : null}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.95fr]">
            <div className="space-y-8">
              <div>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="eyebrow">Choose city</p>
                  <p className="text-xs text-muted-foreground">
                    Available in <span className="font-semibold text-primary">50+ cities across India</span> · Active:{" "}
                    <span className="font-semibold text-foreground">{selectedCity.name}</span>
                  </p>
                </div>

                {/* Primary Hubs: 1-click quick selection */}
                <div className="mb-3 flex flex-wrap gap-2">
                  {QUICK_HUBS.map((hubName) => {
                    const city = cities.find(
                      (c) =>
                        c.name.toLowerCase() === hubName.toLowerCase() ||
                        c.name.toLowerCase().startsWith(hubName.toLowerCase()),
                    );
                    if (!city) return null;
                    const isSelected = cityId === city.id;
                    return (
                      <button
                        type="button"
                        key={city.id}
                        aria-pressed={isSelected}
                        onClick={() => handleSelectCity(city.id)}
                        className={`border px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-charcoal text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                        }`}
                      >
                        {hubName}
                      </button>
                    );
                  })}
                </div>

                {/* Searchable dropdown for all 50+ cities in India */}
                <div ref={cityDropdownRef} className="relative max-w-lg">
                  <div className="relative">
                    <input
                      type="text"
                      value={citySearchQuery}
                      placeholder={`Search or select from all 50+ cities (e.g. Surat, Indore, Varanasi, Nagpur…) · Currently: ${selectedCity.name}`}
                      onFocus={() => setCityDropdownOpen(true)}
                      onClick={() => setCityDropdownOpen(true)}
                      onChange={(e) => {
                        setCitySearchQuery(e.target.value);
                        setCityDropdownOpen(true);
                      }}
                      className="w-full border border-border bg-background px-4 py-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                    {citySearchQuery ? (
                      <button
                        type="button"
                        onClick={() => setCitySearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>

                  {cityDropdownOpen ? (
                    <div className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto border border-border bg-charcoal shadow-2xl">
                      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <span>All Indian Cities ({filteredCities.length})</span>
                        <button
                          type="button"
                          onClick={() => setCityDropdownOpen(false)}
                          className="hover:text-foreground"
                        >
                          Close ✕
                        </button>
                      </div>
                      {filteredCities.map((c) => {
                        const isSelected = cityId === c.id;
                        return (
                          <button
                            type="button"
                            key={c.id}
                            onClick={() => {
                              handleSelectCity(c.id);
                              setCitySearchQuery("");
                              setCityDropdownOpen(false);
                            }}
                            className={`flex w-full items-center justify-between border-b border-border/50 px-4 py-2.5 text-left text-xs transition hover:bg-surface ${
                              isSelected ? "bg-surface font-semibold text-primary" : "text-foreground"
                            }`}
                          >
                            <span>{c.name}</span>
                            {isSelected ? <span className="text-[10px] text-primary">✓ Selected</span> : null}
                          </button>
                        );
                      })}
                      {filteredCities.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-muted-foreground">
                          No city found matching &ldquo;{citySearchQuery}&rdquo;
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div>
                <p className="eyebrow mb-3">Trip type</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(["local", "outstation", "airport_transfer"] as TripType[]).map((type) => (
                    <button
                      type="button"
                      key={type}
                      aria-pressed={tripType === type}
                      onClick={() => setTrip(type)}
                      className={`border px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.13em] transition ${tripType === type ? "border-primary bg-surface text-foreground" : "border-border bg-charcoal text-muted-foreground hover:text-foreground"}`}
                    >
                      {type === "airport_transfer" ? "Airport transfer" : type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <LocationSearch
                  label="From (Pickup)"
                  value={pickup}
                  cityLocations={cityLocations}
                  cityName={selectedCity.name}
                  onChange={(value) => {
                    setPickup(value);
                    setRouteEstimate(null);
                    invalidateQuote();
                  }}
                />

                {tripType === "local" && stops.length > 0 ? (
                  <div className="space-y-3 rounded-sm border border-border/80 bg-background/60 p-4">
                    <div className="flex items-center justify-between">
                      <p className="eyebrow text-primary">Intermediate stops ({stops.length}/5)</p>
                      <span className="text-[11px] text-muted-foreground">
                        Route navigates through each stop in sequence
                      </span>
                    </div>
                    {stops.map((stop, index) => (
                      <div
                        key={index}
                        className="space-y-2 border-b border-border/50 pb-3 last:border-b-0 last:pb-0"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-primary">Stop {index + 1}</span>
                          <div className="flex items-center gap-2">
                            {index > 0 ? (
                              <button
                                type="button"
                                onClick={() => moveStop(index, "up")}
                                className="px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                                title="Move up"
                              >
                                ↑ Up
                              </button>
                            ) : null}
                            {index < stops.length - 1 ? (
                              <button
                                type="button"
                                onClick={() => moveStop(index, "down")}
                                className="px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                                title="Move down"
                              >
                                ↓ Down
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => removeStop(index)}
                              className="px-1.5 py-0.5 text-xs font-semibold text-destructive hover:underline"
                            >
                              Remove ✕
                            </button>
                          </div>
                        </div>
                        <LocationSearch
                          label={`Stop ${index + 1} in ${selectedCity.name}`}
                          value={stop.label ? stop : null}
                          cityLocations={cityLocations}
                          cityName={selectedCity.name}
                          onChange={(value) => {
                            updateStop(index, value);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}

                {tripType === "local" && stops.length < 5 ? (
                  <div>
                    <button
                      type="button"
                      onClick={addStop}
                      className="inline-flex items-center gap-2 border border-dashed border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition hover:border-primary hover:text-foreground"
                    >
                      <span>+</span> Add intermediate stop ({stops.length}/5)
                    </button>
                  </div>
                ) : null}

                <LocationSearch
                  label="To (Dropoff)"
                  value={destination}
                  placeholder="Search any dropoff address, airport, hotel, city or landmark in India…"
                  onChange={(value) => {
                    setDestination(value);
                    setRouteEstimate(null);
                    invalidateQuote();
                  }}
                />
              </div>

              {tripType === "local" ? (
                <div>
                  <p className="eyebrow mb-3">Package</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {packages.local.map((option) => (
                      <button
                        type="button"
                        key={option.value}
                        aria-pressed={packageTier === option.value}
                        onClick={() => {
                          setPackageTier(option.value);
                          invalidateQuote();
                        }}
                        className={`border px-4 py-4 text-xs font-semibold uppercase tracking-wider transition ${packageTier === option.value ? "border-primary bg-surface" : "border-border bg-charcoal text-muted-foreground hover:text-foreground"}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="eyebrow">Pickup date</span>
                  <input
                    className="mt-2 w-full border border-border bg-background px-4 py-4 text-base [color-scheme:dark] focus:border-primary focus:outline-none"
                    type="date"
                    min={todayDate()}
                    required
                    value={pickupDate}
                    onChange={(event) => {
                      setPickupDate(event.target.value);
                      invalidateQuote();
                    }}
                  />
                </label>
                <label className="block text-sm">
                  <span className="eyebrow">Pickup time</span>
                  <input
                    className="mt-2 w-full border border-border bg-background px-4 py-4 text-base [color-scheme:dark] focus:border-primary focus:outline-none"
                    type="time"
                    required
                    value={pickupTime}
                    onChange={(event) => {
                      setPickupTime(event.target.value);
                      invalidateQuote();
                    }}
                  />
                </label>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="eyebrow">Passengers</p>
                  <div className="mt-2 flex w-full items-center justify-between border border-border bg-background px-3 py-2">
                    <button
                      type="button"
                      aria-label="Remove one passenger"
                      disabled={passengers <= 1}
                      onClick={() => {
                        setPassengers((count) => Math.max(1, count - 1));
                        invalidateQuote();
                      }}
                      className="size-11 text-xl text-foreground disabled:opacity-40"
                    >
                      −
                    </button>
                    <span aria-live="polite" className="text-sm">
                      {passengers}
                    </span>
                    <button
                      type="button"
                      aria-label="Add one passenger"
                      disabled={passengers >= 50}
                      onClick={() => {
                        setPassengers((count) => Math.min(50, count + 1));
                        invalidateQuote();
                      }}
                      className="size-11 text-xl text-foreground disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
                {tripType === "outstation" ? (
                  <label className="block text-sm">
                    <span className="eyebrow">Trip days</span>
                    <input
                      className="mt-2 w-full border border-border bg-background px-4 py-4 text-base focus:border-primary focus:outline-none"
                      type="number"
                      min={1}
                      max={30}
                      required
                      value={tripDays}
                      onChange={(event) => {
                        setTripDays(Math.max(1, Number(event.target.value) || 1));
                        invalidateQuote();
                      }}
                    />
                  </label>
                ) : null}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Route distance and travel duration are calculated using driving road networks.
                The server applies the official DC Cabs rate card for your itinerary.
              </p>
            </div>

            <div className="space-y-4">
              <BookingRouteMap
                pickup={pickup}
                stops={tripType === "local" && stops.length > 0 ? stops : undefined}
                destination={destination}
                onRoute={setRouteEstimate}
              />
              {routeEstimate ? (
                <div className="flex flex-col gap-2 border-b border-border py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="eyebrow">Driving route & travel time</p>
                    {trafficEstimate ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Includes traffic conditions (
                        <span
                          className={
                            trafficEstimate.trafficCondition === "heavy"
                              ? "font-semibold text-amber-500"
                              : trafficEstimate.trafficCondition === "moderate"
                                ? "font-semibold text-primary"
                                : "font-semibold text-emerald-500"
                          }
                        >
                          {trafficEstimate.trafficCondition} traffic
                        </span>
                        {trafficEstimate.trafficDelayMinutes > 0
                          ? ` · ~${trafficEstimate.trafficDelayMinutes} min delay`
                          : ""}
                        )
                      </p>
                    ) : null}
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-semibold">
                      {routeEstimate.distanceKm.toFixed(1)} km{" "}
                      <span className="px-2 font-normal text-muted-foreground">·</span>{" "}
                      {(() => {
                        const effectiveHours =
                          trafficEstimate?.trafficDurationHours ?? routeEstimate.durationHours;
                        const totalMins = Math.round(effectiveHours * 60);
                        if (totalMins >= 60) {
                          const hrs = Math.floor(totalMins / 60);
                          const mins = totalMins % 60;
                          return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
                        }
                        return `${totalMins} min`;
                      })()}
                    </p>
                  </div>
                </div>
              ) : null}
              {categoriesError ? (
                <p role="alert" className="text-sm text-muted-foreground">
                  Vehicle availability could not be checked: {categoriesError}
                </p>
              ) : null}
              {(pickup && !pickup.bookable) || (destination && !destination.bookable) ? (
                <p role="status" className="border border-border p-4 text-sm text-muted-foreground">
                  This route includes a place that is not yet in the online booking catalog. Contact
                  DC Cabs to arrange it.
                </p>
              ) : null}
              <button
                type="button"
                disabled={!journeyReady}
                onClick={() => {
                  setMessage("");
                  setStep(2);
                }}
                className="w-full bg-primary px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground transition hover:bg-primary-tint disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue to vehicle
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-8">
            <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
              <div>
                <p className="eyebrow text-primary">Step 02 · Vehicle</p>
                <h2 className="font-display mt-3 text-3xl font-bold uppercase">
                  Choose your category
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Available for {pickup?.label} at your selected pickup time.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-left text-xs uppercase tracking-widest text-primary"
              >
                Edit journey
              </button>
            </div>
            {categoriesLoading ? (
              <p role="status" className="py-12 text-sm text-muted-foreground">
                Loading available categories…
              </p>
            ) : null}
            {!categoriesLoading && categoriesError ? (
              <div role="alert" className="mt-6 border border-border p-5 text-sm">
                {categoriesError}
                <button
                  type="button"
                  onClick={() => setCategoryRetry((attempt) => attempt + 1)}
                  className="ml-4 underline"
                >
                  Retry
                </button>
              </div>
            ) : null}
            {!categoriesLoading && !categoriesError && availableCategories.length === 0 ? (
              <div className="mt-6 border border-border p-6">
                <p className="eyebrow text-primary">No vehicles available</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {categories.length > 0
                    ? `No vehicle categories in our catalog can accommodate ${passengers} passengers in ${selectedCity.name}. Please adjust the passenger count or contact DC Cabs for specialized transport.`
                    : "There are no vehicle categories configured for this pickup at the selected time."}
                </p>
                <Link
                  to="/contact"
                  search={{
                    type: "Other",
                    route: enquiryRoute,
                    date: pickupDate,
                    travelers: String(passengers),
                    message: `Please help arrange transportation for ${passengers} passengers in ${selectedCity.name}.`,
                  }}
                  className="mt-5 inline-block text-xs font-bold uppercase tracking-widest text-primary underline"
                >
                  Request assistance
                </Link>
              </div>
            ) : null}
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {availableCategories.map((category) => (
                <VehicleCategoryCard
                  key={category.id}
                  category={category}
                  selected={vehicleId === category.id}
                  onSelect={() => {
                    setVehicleId(category.id);
                    invalidateQuote();
                  }}
                />
              ))}
            </div>
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="border border-border px-6 py-4 text-xs font-bold uppercase tracking-[0.18em]"
              >
                Back to journey
              </button>
              <button
                type="button"
                disabled={!canContinueVehicle}
                onClick={() => {
                  setMessage("");
                  setStep(3);
                }}
                className="bg-primary px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground disabled:opacity-40"
              >
                {selectedCategory?.pricing_type === "price_on_request"
                  ? "Continue to quote request"
                  : "Continue to fare"}
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 && !quoteRequestSubmitted ? (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.8fr]">
            <div>
              <p className="eyebrow text-primary">
                {selectedCategory?.pricing_type === "price_on_request"
                  ? "Step 03 · Price on Request"
                  : "Step 03 · Fare"}
              </p>
              <h2 className="font-display mt-3 text-3xl font-bold uppercase">
                {selectedCategory?.pricing_type === "price_on_request"
                  ? "Price on Request"
                  : "Request your fare"}
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {selectedCategory?.pricing_type === "price_on_request"
                  ? `The selected category (${selectedCategory.name}) is priced on request based on group itinerary and vehicle specifications. No estimated or fake fares are calculated. Submit a quote request and our operations team will provide your quotation.`
                  : "Your route, vehicle and travel requirements will be priced using the current DC Cabs server-side rate configuration. No fare is estimated in this browser."}
              </p>
              <div className="mt-8 border-y border-border">
                <JourneyRow
                  label="Journey"
                  value={enquiryRoute}
                  onEdit={() => setStep(1)}
                />
                <JourneyRow
                  label="Vehicle"
                  value={
                    selectedCategory
                      ? `${selectedCategory.name}${selectedCategory.models && selectedCategory.models.length > 0 ? ` (${selectedCategory.models.join(" / ")})` : ""}`
                      : "Vehicle category"
                  }
                  onEdit={() => setStep(2)}
                />
                <JourneyRow
                  label="Capacity"
                  value={`Up to ${selectedCategory?.passenger_capacity ?? passengers} passengers (${passengers} travelling)`}
                  onEdit={() => setStep(1)}
                />
                <JourneyRow
                  label="Pricing"
                  value={
                    selectedCategory?.pricing_type === "price_on_request"
                      ? "Price on Request"
                      : "Server rate card"
                  }
                  onEdit={() => setStep(2)}
                />
                <JourneyRow
                  label="Route estimate"
                  value={
                    routeEstimate
                      ? `${routeEstimate.distanceKm.toFixed(1)} km · ${Math.round(routeEstimate.durationHours * 60)} min`
                      : "Unavailable"
                  }
                  onEdit={() => setStep(1)}
                />
              </div>

              {selectedCategory?.pricing_type === "price_on_request" ? (
                <div className="mt-6 border border-primary/50 bg-primary/5 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="eyebrow text-primary">Custom Quotation</p>
                      <p className="mt-1 font-display text-2xl font-bold uppercase">
                        Price on Request
                      </p>
                    </div>
                    <span className="border border-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                      On Request
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    Tailored quotation prepared directly by DC Cabs operations for your group size, timing, and vehicle requirements.
                  </p>
                </div>
              ) : null}

              {message ? (
                <p role="status" className="mt-5 text-sm text-muted-foreground">
                  {message}
                </p>
              ) : null}
              {pricingUnavailable ? (
                <Link
                  to="/contact"
                  search={{
                    type: "Other",
                    route: enquiryRoute,
                    date: pickupDate,
                    travelers: String(passengers),
                    message: `Fare unavailable for ${tripTypeLabel.toLowerCase()} with ${selectedCategory?.name ?? "a vehicle"}.`,
                  }}
                  className="mt-5 inline-block text-xs font-bold uppercase tracking-widest text-primary underline"
                >
                  Request a quote
                </Link>
              ) : null}
              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="border border-border px-6 py-4 text-xs font-bold uppercase tracking-[0.18em]"
                >
                  Back
                </button>
                {selectedCategory?.pricing_type === "price_on_request" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMessage("");
                      setStep(4);
                    }}
                    className="bg-primary px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground hover:bg-primary-tint"
                  >
                    Request Quote
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void requestQuote()}
                    className="bg-primary px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground disabled:opacity-40"
                  >
                    {busy ? "Requesting fare…" : "Request fare"}
                  </button>
                )}
              </div>
            </div>
            <div className="self-start border border-border bg-charcoal p-6">
              <p className="eyebrow">Journey at a glance</p>
              <p className="mt-5 text-sm">
                {pickupDate
                  ? new Date(`${pickupDate}T00:00`).toLocaleDateString(undefined, {
                      dateStyle: "long",
                    })
                  : "Select a date"}{" "}
                · {pickupTime || "Select a time"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {passengers} passenger{passengers === 1 ? "" : "s"} · {tripTypeLabel} ·{" "}
                {packageTier.replaceAll("_", " ")}
              </p>
              <div className="mt-5 border border-border px-4 py-5">
                <p className="eyebrow">Route preview</p>
                <p className="mt-3 text-sm">
                  {enquiryRoute}
                </p>
                {routeEstimate ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {routeEstimate.distanceKm.toFixed(1)} km ·{" "}
                    {Math.round(routeEstimate.durationHours * 60)} min by road
                  </p>
                ) : null}
              </div>
              <div className="mt-5 border-t border-border pt-4">
                <p className="eyebrow">Vehicle Category</p>
                <p className="mt-2 text-sm font-semibold">{selectedCategory?.name ?? "—"}</p>
                {selectedCategory?.models && selectedCategory.models.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedCategory.models.join(" · ")}
                  </p>
                ) : null}
                <p className="mt-2 text-xs font-bold uppercase text-primary">
                  {selectedCategory?.pricing_type === "price_on_request"
                    ? "Price on Request"
                    : "Server Rate Card"}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {step === 4 && !quoteRequestSubmitted ? (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.75fr]">
            <div>
              <p className="eyebrow text-primary">Step 04 · Details</p>
              <h2 className="font-display mt-3 text-3xl font-bold uppercase">Who’s travelling?</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                We’ll use these details to coordinate your journey.
              </p>
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="eyebrow">Full name</span>
                  <input
                    autoComplete="name"
                    maxLength={120}
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-2 w-full border border-border bg-background px-4 py-4 focus:border-primary focus:outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="eyebrow">Email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 w-full border border-border bg-background px-4 py-4 focus:border-primary focus:outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="eyebrow">Phone</span>
                  <input
                    type="tel"
                    autoComplete="tel"
                    maxLength={32}
                    required
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="mt-2 w-full border border-border bg-background px-4 py-4 focus:border-primary focus:outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="eyebrow">
                    Company <span className="text-muted-foreground">Optional</span>
                  </span>
                  <input
                    autoComplete="organization"
                    maxLength={160}
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                    className="mt-2 w-full border border-border bg-background px-4 py-4 focus:border-primary focus:outline-none"
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="eyebrow">
                    Special instructions <span className="text-muted-foreground">Optional</span>
                  </span>
                  <textarea
                    maxLength={1000}
                    rows={3}
                    value={instructions}
                    onChange={(event) => setInstructions(event.target.value)}
                    className="mt-2 w-full resize-y border border-border bg-background px-4 py-4 focus:border-primary focus:outline-none"
                  />
                </label>
              </div>
              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="border border-border px-6 py-4 text-xs font-bold uppercase tracking-[0.18em]"
                >
                  {selectedCategory?.pricing_type === "price_on_request"
                    ? "Back to quote"
                    : "Back to fare"}
                </button>
                <button
                  type="button"
                  disabled={
                    !name.trim() ||
                    !email.includes("@") ||
                    phone.replace(/\D/g, "").length < 7 ||
                    (selectedCategory?.pricing_type !== "price_on_request" && quoteExpired)
                  }
                  onClick={() => setStep(5)}
                  className="bg-primary px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground disabled:opacity-40"
                >
                  Review journey
                </button>
              </div>
            </div>
            {selectedCategory?.pricing_type === "price_on_request" ? (
              <div className="self-start border border-border bg-charcoal p-6">
                <p className="eyebrow text-primary">Price on Request</p>
                <h3 className="font-display mt-3 text-2xl font-bold uppercase">
                  {selectedCategory.name}
                </h3>
                {selectedCategory.models && selectedCategory.models.length > 0 ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {selectedCategory.models.join(" · ")}
                  </p>
                ) : null}
                <div className="mt-5 space-y-3 border-t border-border pt-4 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Capacity</span>
                    <span>Up to {selectedCategory.passenger_capacity} passengers</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Passengers</span>
                    <span>{passengers} travelling</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Route</span>
                    <span className="text-right">{pickupLabel} → {destinationLabel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pricing</span>
                    <span className="font-bold text-primary">Price on Request</span>
                  </div>
                </div>
                <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                  No automated charge is applied. Our team will review your requirements and provide a direct quotation.
                </p>
              </div>
            ) : (
              <QuotePanel
                quote={quote}
                lines={quoteLines}
                secondsLeft={secondsLeft}
                expired={quoteExpired}
                onRefresh={() => {
                  setQuote(null);
                  setStep(3);
                }}
              />
            )}
          </div>
        ) : null}

        {step === 5 && !quoteRequestSubmitted ? (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.75fr]">
            <div>
              <p className="eyebrow text-primary">
                {selectedCategory?.pricing_type === "price_on_request"
                  ? "Step 05 · Review Quote Request"
                  : "Step 05 · Review"}
              </p>
              <h2 className="font-display mt-3 text-3xl font-bold uppercase">
                Review your itinerary
              </h2>
              <div className="mt-7 border-t border-border">
                <JourneyRow
                  label="Journey"
                  value={enquiryRoute}
                  onEdit={() => setStep(1)}
                />
                <JourneyRow
                  label="Date & time"
                  value={`${pickupDate} · ${pickupTime}`}
                  onEdit={() => setStep(1)}
                />
                <JourneyRow
                  label="Passengers & trip"
                  value={`${passengers} passenger${passengers === 1 ? "" : "s"} · ${tripTypeLabel} · ${tripDays} day${tripDays === 1 ? "" : "s"}`}
                  onEdit={() => setStep(1)}
                />
                <JourneyRow
                  label="Vehicle"
                  value={
                    selectedCategory
                      ? `${selectedCategory.name}${selectedCategory.models && selectedCategory.models.length > 0 ? ` (${selectedCategory.models.join(" / ")})` : ""}`
                      : "—"
                  }
                  onEdit={() => setStep(2)}
                />
                <JourneyRow
                  label="Pricing"
                  value={
                    selectedCategory?.pricing_type === "price_on_request"
                      ? "Price on Request (Quotation provided directly by DC Cabs)"
                      : "Server rate card quote"
                  }
                  onEdit={() => setStep(3)}
                />
                <JourneyRow
                  label="Customer"
                  value={`${name} · ${email} · ${phone}`}
                  onEdit={() => setStep(4)}
                />
              </div>
              {selectedCategory?.pricing_type !== "price_on_request" && quoteExpired ? (
                <p role="alert" className="mt-5 border border-primary/50 p-4 text-sm">
                  <span className="eyebrow text-primary">Quote expired</span>
                  <br />
                  Request a new fare before continuing.
                </p>
              ) : null}
              {message ? (
                <p role="alert" className="mt-4 text-sm text-muted-foreground">
                  {message}
                </p>
              ) : null}
              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="border border-border px-6 py-4 text-xs font-bold uppercase tracking-[0.18em]"
                >
                  Back to details
                </button>
                {selectedCategory?.pricing_type === "price_on_request" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      setTimeout(() => {
                        setBusy(false);
                        setQuoteRequestSubmitted(true);
                      }, 250);
                    }}
                    className="bg-primary px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground hover:bg-primary-tint disabled:opacity-40"
                  >
                    {busy ? "Submitting request…" : "Submit Quote Request"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy || quoteExpired}
                    onClick={() => void createBooking()}
                    className="bg-primary px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground disabled:opacity-40"
                  >
                    {busy ? "Securing booking…" : "Continue to secure payment"}
                  </button>
                )}
              </div>
            </div>
            {selectedCategory?.pricing_type === "price_on_request" ? (
              <div className="self-start border border-border bg-charcoal p-6">
                <p className="eyebrow text-primary">Price on Request</p>
                <h3 className="font-display mt-3 text-2xl font-bold uppercase">
                  {selectedCategory.name}
                </h3>
                {selectedCategory.models && selectedCategory.models.length > 0 ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {selectedCategory.models.join(" · ")}
                  </p>
                ) : null}
                <div className="mt-5 space-y-3 border-t border-border pt-4 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Capacity</span>
                    <span>Up to {selectedCategory.passenger_capacity} passengers</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Passengers</span>
                    <span>{passengers} travelling</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pricing</span>
                    <span className="font-bold text-primary">Price on Request</span>
                  </div>
                </div>
                <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                  Our operations team will review your itinerary and send an official DC Cabs quotation.
                </p>
              </div>
            ) : (
              <QuotePanel
                quote={quote}
                lines={quoteLines}
                secondsLeft={secondsLeft}
                expired={quoteExpired}
                onRefresh={() => {
                  setQuote(null);
                  setStep(3);
                }}
              />
            )}
          </div>
        ) : null}

        {quoteRequestSubmitted ? (
          <div className="mt-8 border border-primary/40 bg-charcoal p-8 md:p-12">
            <p className="eyebrow text-primary">Quote Request Received</p>
            <h2 className="font-display mt-3 text-3xl font-bold uppercase md:text-4xl">
              Thank you, {name}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Your quotation request for{" "}
              <span className="font-semibold text-foreground">{selectedCategory?.name}</span>{" "}
              ({passengers} passengers) from{" "}
              <span className="font-semibold text-foreground">{pickupLabel}</span> to{" "}
              <span className="font-semibold text-foreground">{destinationLabel}</span> has been
              received. The DC Cabs operations team will prepare and send your quotation.
            </p>
            <div className="mt-6 grid gap-4 text-xs sm:grid-cols-2">
              <div className="border border-border bg-background p-4">
                <span className="text-muted-foreground">Pickup schedule:</span>
                <p className="mt-1 font-semibold text-foreground">
                  {pickupDate} at {pickupTime}
                </p>
              </div>
              <div className="border border-border bg-background p-4">
                <span className="text-muted-foreground">Contact details:</span>
                <p className="mt-1 font-semibold text-foreground">
                  {phone} · {email}
                </p>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href={`https://wa.me/919987117974?text=${encodeURIComponent(
                  `Hello DC Cabs, I have submitted a quotation request for ${selectedCategory?.name} (${passengers} passengers) from ${pickupLabel} to ${destinationLabel} on ${pickupDate} at ${pickupTime}. Customer: ${name} (${phone}).`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground hover:bg-primary-tint"
              >
                Connect on WhatsApp to expedite quotation
              </a>
              <button
                type="button"
                onClick={() => {
                  setQuoteRequestSubmitted(false);
                  setStep(1);
                  invalidateQuote();
                }}
                className="border border-border px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] hover:bg-surface"
              >
                Plan another journey
              </button>
            </div>
          </div>
        ) : null}

        {step === 6 ? (
          <div className="mt-8 max-w-2xl">
            <p className="eyebrow text-primary">Step 06 · Payment</p>
            <h2 className="font-display mt-3 text-3xl font-bold uppercase">
              Complete your booking
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Your booking is secured in the DC Cabs system. Continue through Razorpay’s secure
              checkout to complete payment.
            </p>
            {booking?.paymentAccessToken ? (
              <div className="mt-8">
                <PaymentCheckout
                  booking={{ ...booking, paymentAccessToken: booking.paymentAccessToken }}
                />
              </div>
            ) : (
              <div className="mt-8 border border-border bg-charcoal p-6">
                <p className="eyebrow text-primary">Secure checkout unavailable</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Online payment is not configured for this deployment. Contact DC Cabs with booking{" "}
                  {booking?.bookingReference} to complete the arrangement.
                </p>
                <Link
                  to="/contact"
                  search={{
                    type: "Other",
                    route: enquiryRoute,
                    date: pickupDate,
                    travelers: String(passengers),
                    message: `Booking ${booking?.bookingReference}: please help complete payment.`,
                  }}
                  className="mt-5 inline-block text-xs font-bold uppercase tracking-widest text-primary underline"
                >
                  Contact DC Cabs
                </Link>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function QuotePanel({
  quote,
  lines,
  secondsLeft,
  expired,
  onRefresh,
}: {
  quote: Quote | null;
  lines: [string, number | string | null][];
  secondsLeft: number;
  expired: boolean;
  onRefresh: () => void;
}) {
  if (!quote)
    return (
      <div className="self-start border border-border bg-charcoal p-6">
        <p className="eyebrow">Server fare</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Request a fare to see the current server-generated amount and included charges.
        </p>
      </div>
    );
  const currency = quote.pricing.currency ?? "INR";
  const allowances = quote.pricing.allowances;
  const inputs = quote.pricing.inputs;

  return (
    <aside
      className="self-start border border-border bg-charcoal p-6"
      aria-label="Server-generated fare"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-primary">DC Cabs fare</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {expired
              ? "Quote expired"
              : `Reserved for ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`}
          </p>
        </div>
        {expired ? (
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs font-semibold uppercase tracking-wider text-primary"
          >
            Request new fare
          </button>
        ) : null}
      </div>

      {allowances?.includedKm != null || inputs?.distanceKm != null ? (
        <div className="mt-4 space-y-1.5 border-y border-border/60 py-3 text-xs text-muted-foreground">
          {allowances?.includedKm != null ? (
            <div className="flex justify-between">
              <span>Included distance:</span>
              <span className="font-medium text-foreground">{allowances.includedKm} km</span>
            </div>
          ) : null}
          {allowances?.includedHours != null ? (
            <div className="flex justify-between">
              <span>Included duration:</span>
              <span className="font-medium text-foreground">{allowances.includedHours} hours</span>
            </div>
          ) : null}
          {inputs?.distanceKm != null ? (
            <div className="flex justify-between">
              <span>Calculated route:</span>
              <span className="font-medium text-foreground">{inputs.distanceKm} km</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 space-y-1">
        {lines.map(([key, value]) => (
          <div
            key={key}
            className={`flex justify-between gap-4 border-b border-border/70 py-3 text-sm ${key === "total" ? "text-base font-bold text-primary" : "text-muted-foreground"}`}
          >
            <span>{titleForComponent(key)}</span>
            <span>{key === "taxRatePercent" ? `${value}%` : money(value, currency)}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Authoritative fare calculated server-side according to DC Cabs Mumbai rate card.
      </p>
    </aside>
  );
}
