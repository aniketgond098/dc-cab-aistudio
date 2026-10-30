import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BookingRouteMap, type RouteEstimate } from "@/components/booking/BookingRouteMap";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { JourneyLocation, LocationSearch } from "@/components/booking/LocationSearch";
import { PaymentCheckout } from "@/components/booking/PaymentCheckout";
import { VehicleCategoryCard, type Category } from "@/components/booking/VehicleCategoryCard";
import { canContinueJourney } from "@/lib/booking-journey";

type TripType = "local" | "outstation" | "airport_transfer";
type Quote = {
  quoteId: string;
  expiresAt: string;
  pricing: {
    currency?: string;
    components?: Record<string, number | string | null>;
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
    { value: "4hr_40km", label: "4 hours · 40 km" },
    { value: "8hr_80km", label: "8 hours · 80 km" },
    { value: "12hr_120km", label: "12 hours · 120 km" },
  ],
  outstation: [{ value: "outstation", label: "Outstation" }],
  airport_transfer: [{ value: "airport_transfer", label: "Airport transfer" }],
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
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
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
  const [tripType, setTripType] = useState<TripType>("local");
  const [packageTier, setPackageTier] = useState("4hr_40km");
  const [pickup, setPickup] = useState<JourneyLocation | null>(null);
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

  const pickupAt = useMemo(() => {
    if (!pickupDate || !pickupTime) return "";
    const date = new Date(`${pickupDate}T${pickupTime}`);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }, [pickupDate, pickupTime]);
  const selectedCategory = categories.find((category) => category.id === vehicleId) ?? null;
  const quoteExpired = Boolean(quote && secondsLeft <= 0);
  const pickupLabel = pickup?.label ?? "Pickup location";
  const destinationLabel = destination?.label ?? "Destination";
  const enquiryRoute = `${pickupLabel} → ${destinationLabel}`.slice(0, 200);
  const tripTypeLabel =
    tripType === "airport_transfer"
      ? "Airport transfer"
      : tripType === "outstation"
        ? "Outstation"
        : "Local";
  const quoteLines = quote?.pricing.components
    ? Object.entries(quote.pricing.components).filter(([key]) => key !== "taxRatePercent")
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
  }

  function setTrip(value: TripType) {
    setTripType(value);
    setPackageTier(packages[value][0]?.value ?? "custom");
    invalidateQuote();
  }

  async function requestQuote() {
    if (!pickup?.id || !destination?.id || !pickupAt || !vehicleId) return;
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
          ...(routeEstimate
            ? {
                estimatedDistanceKm: Number(routeEstimate.distanceKm.toFixed(2)),
                estimatedDurationHours: Number(routeEstimate.durationHours.toFixed(2)),
              }
            : {}),
        }),
      });
      const result = (await response.json()) as
        Quote | { error?: { code?: string; message?: string } };
      if (!response.ok || !("quoteId" in result)) {
        const apiError = "error" in result ? result.error : undefined;
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
    } catch {
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

  const journeyReady = canContinueJourney({
    pickup,
    destination,
    pickupAt,
    categoriesError,
  });
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
              <div className="grid gap-5 sm:grid-cols-2">
                <LocationSearch
                  label="From"
                  value={pickup}
                  onChange={(value) => {
                    setPickup(value);
                    setRouteEstimate(null);
                    invalidateQuote();
                  }}
                />
                <LocationSearch
                  label="To"
                  value={destination}
                  onChange={(value) => {
                    setDestination(value);
                    setRouteEstimate(null);
                    invalidateQuote();
                  }}
                />
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

              {tripType === "local" ? (
                <div>
                  <p className="eyebrow mb-3">Package</p>
                  <div className="grid gap-3 sm:grid-cols-3">
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
                Mapbox route distance and travel time are optional estimates. When available, they
                are sent to the server quote; the server applies the configured pricing rule and
                returns the fare. No distance or duration is invented when Mapbox is unavailable.
              </p>
            </div>

            <div className="space-y-4">
              <BookingRouteMap
                pickup={pickup}
                destination={destination}
                onRoute={setRouteEstimate}
              />
              {routeEstimate ? (
                <div className="flex items-center justify-between gap-4 border-b border-border py-4">
                  <p className="eyebrow">Driving route estimate</p>
                  <p className="text-sm">
                    {routeEstimate.distanceKm.toFixed(1)} km{" "}
                    <span className="px-2 text-muted-foreground">·</span>{" "}
                    {Math.round(routeEstimate.durationHours * 60)} min
                  </p>
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
            {!categoriesLoading && !categoriesError && categories.length === 0 ? (
              <div className="mt-6 border border-border p-6">
                <p className="eyebrow text-primary">No online vehicles available</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  There are no vehicle categories configured for this pickup at the selected time.
                </p>
                <Link
                  to="/contact"
                  search={{
                    type: "Other",
                    route: enquiryRoute,
                    date: pickupDate,
                    travelers: String(passengers),
                    message: "Please help arrange a vehicle for this journey.",
                  }}
                  className="mt-5 inline-block text-xs font-bold uppercase tracking-widest text-primary underline"
                >
                  Request assistance
                </Link>
              </div>
            ) : null}
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {categories.map((category) => (
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
            {selectedCategory && passengers > selectedCategory.passenger_capacity ? (
              <p role="alert" className="mt-4 text-sm text-destructive">
                This category seats up to {selectedCategory.passenger_capacity} passengers. Adjust
                the passenger count or choose another category.
              </p>
            ) : null}
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
                Continue to fare
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.8fr]">
            <div>
              <p className="eyebrow text-primary">Step 03 · Fare</p>
              <h2 className="font-display mt-3 text-3xl font-bold uppercase">Request your fare</h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Your route, vehicle and travel requirements will be priced using the current DC Cabs
                server-side rate configuration. No fare is estimated in this browser.
              </p>
              <div className="mt-8 border-y border-border">
                <JourneyRow
                  label="Journey"
                  value={`${pickupLabel} → ${destinationLabel}`}
                  onEdit={() => setStep(1)}
                />
                <JourneyRow
                  label="Vehicle"
                  value={selectedCategory?.name ?? "Vehicle category"}
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
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void requestQuote()}
                  className="bg-primary px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground disabled:opacity-40"
                >
                  {busy ? "Requesting server fare…" : "Request server fare"}
                </button>
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
                  {pickupLabel} <span className="text-primary">→</span> {destinationLabel}
                </p>
                {routeEstimate ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {routeEstimate.distanceKm.toFixed(1)} km ·{" "}
                    {Math.round(routeEstimate.durationHours * 60)} min by road
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
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
                  Back to fare
                </button>
                <button
                  type="button"
                  disabled={
                    !name.trim() ||
                    !email.includes("@") ||
                    phone.replace(/\D/g, "").length < 7 ||
                    quoteExpired
                  }
                  onClick={() => setStep(5)}
                  className="bg-primary px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground disabled:opacity-40"
                >
                  Review journey
                </button>
              </div>
            </div>
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
          </div>
        ) : null}

        {step === 5 ? (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.75fr]">
            <div>
              <p className="eyebrow text-primary">Step 05 · Review</p>
              <h2 className="font-display mt-3 text-3xl font-bold uppercase">
                Review your itinerary
              </h2>
              <div className="mt-7 border-t border-border">
                <JourneyRow
                  label="Journey"
                  value={`${pickupLabel} → ${destinationLabel}`}
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
                  value={selectedCategory?.name ?? "—"}
                  onEdit={() => setStep(2)}
                />
                <JourneyRow
                  label="Customer"
                  value={`${name} · ${email} · ${phone}`}
                  onEdit={() => setStep(4)}
                />
              </div>
              {quoteExpired ? (
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
                <button
                  type="button"
                  disabled={busy || quoteExpired}
                  onClick={() => void createBooking()}
                  className="bg-primary px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground disabled:opacity-40"
                >
                  {busy ? "Securing booking…" : "Continue to secure payment"}
                </button>
              </div>
            </div>
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
      <div className="mt-6 space-y-1">
        {lines.map(([key, value]) => (
          <div
            key={key}
            className={`flex justify-between gap-4 border-b border-border/70 py-3 text-sm ${key === "total" ? "font-semibold text-foreground" : "text-muted-foreground"}`}
          >
            <span>{titleForComponent(key)}</span>
            <span>{key === "taxRatePercent" ? `${value}%` : money(value, currency)}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Fare and charges are returned by the DC Cabs pricing service.
      </p>
    </aside>
  );
}
