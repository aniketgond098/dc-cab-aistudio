import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createBookingPaymentToken } from "@/lib/razorpay";
import { clientCities, indiaCities } from "@/content/site";

export type BookingDatabase = SupabaseClient;

const uuid = z.string().uuid();
const packageTiers = [
  "4hr_40km",
  "8hr_80km",
  "12hr_120km",
  "outstation",
  "airport_transfer",
  "point_to_point",
  "custom",
] as const;
const tripTypes = ["local", "outstation", "airport_transfer", "point_to_point", "tour"] as const;

const QuoteRequestSchema = z
  .object({
    tripType: z.enum(tripTypes),
    packageTier: z.enum(packageTiers),
    originLocationId: uuid,
    destinationCityId: uuid.optional(),
    destinationLocationId: uuid.optional(),
    pickupAt: z.string().datetime({ offset: true }),
    vehicleCategoryId: uuid,
    passengerCount: z.number().int().min(1).max(50),
    tripDays: z.number().int().min(1).max(30).default(1),
    estimatedDistanceKm: z.number().finite().min(0).max(10_000).optional(),
    estimatedDurationHours: z.number().finite().min(0).max(720).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const validPackageByTrip: Record<(typeof tripTypes)[number], readonly string[]> = {
      local: ["4hr_40km", "8hr_80km", "12hr_120km", "custom"],
      outstation: ["outstation", "custom"],
      airport_transfer: ["airport_transfer", "custom"],
      point_to_point: ["point_to_point", "custom"],
      tour: ["custom"],
    };
    if (!validPackageByTrip[value.tripType].includes(value.packageTier)) {
      ctx.addIssue({
        code: "custom",
        path: ["packageTier"],
        message: "Package tier does not match trip type",
      });
    }
    const pickupAt = Date.parse(value.pickupAt);
    if (pickupAt <= Date.now() || pickupAt > Date.now() + 366 * 24 * 60 * 60 * 1000) {
      ctx.addIssue({
        code: "custom",
        path: ["pickupAt"],
        message: "Pickup must be within the next 366 days",
      });
    }
  });

const BookingRequestSchema = z
  .object({
    quoteId: uuid,
    customer: z
      .object({
        fullName: z.string().trim().min(1).max(120),
        email: z
          .string()
          .trim()
          .email()
          .max(254)
          .transform((value) => value.toLowerCase()),
        phone: z
          .string()
          .trim()
          .min(7)
          .max(32)
          .regex(/^[+0-9().\-\s]+$/)
          .refine((value) => value.replace(/\D/g, "").length >= 7),
        countryCode: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]{2}$/)
          .optional(),
        companyName: z.string().trim().min(1).max(160).optional(),
      })
      .strict(),
    specialInstructions: z.string().trim().max(1000).optional(),
  })
  .strict();

type ApiErrorCode =
  | "invalid_request"
  | "invalid_location"
  | "vehicle_unavailable"
  | "online_pricing_unavailable"
  | "quote_expired"
  | "quote_already_claimed"
  | "quote_not_found"
  | "idempotency_conflict"
  | "internal_server_error";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function error(code: ApiErrorCode, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}

type SelectedSupabaseKey = "SUPABASE_SECRET_KEY" | "SUPABASE_SERVICE_ROLE_KEY" | "none";
const EXPECTED_SUPABASE_URL = "https://hodcgcqqjdrashquegfb.supabase.co";

function runtimeEnvironment(): Record<string, string | undefined> {
  return typeof process === "undefined" ? {} : process.env;
}

function selectedSupabaseKey(env: Record<string, string | undefined>): SelectedSupabaseKey {
  if (env["SUPABASE_SECRET_KEY"] !== undefined) return "SUPABASE_SECRET_KEY";
  if (env["SUPABASE_SERVICE_ROLE_KEY"] !== undefined) return "SUPABASE_SERVICE_ROLE_KEY";
  return "none";
}

function redactDiagnosticMessage(message: string, env: Record<string, string | undefined>): string {
  let redacted = message;
  for (const sensitiveValue of [
    env["SUPABASE_URL"],
    env["SUPABASE_SECRET_KEY"],
    env["SUPABASE_SERVICE_ROLE_KEY"],
  ]) {
    if (sensitiveValue) redacted = redacted.split(sensitiveValue).join("[REDACTED]");
  }
  return redacted
    .replace(/https?:\/\/[^\s/]+(?:\/[^\s]*)?/gi, "[REDACTED_URL]")
    .replace(/\b(?:sb_secret|sb_publishable)_[A-Za-z0-9_-]+\b/gi, "[REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}(?:\.[A-Za-z0-9_-]+)?\b/g, "[REDACTED]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(/\b(authorization|api[_-]?key|apikey)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .slice(0, 500);
}

type ErrorLike = {
  name?: unknown;
  code?: unknown;
  message?: unknown;
  cause?: unknown;
  errno?: unknown;
  syscall?: unknown;
  hostname?: unknown;
  address?: unknown;
  port?: unknown;
  status?: unknown;
};

function errorLike(value: unknown): ErrorLike | undefined {
  return value !== null && typeof value === "object" ? (value as ErrorLike) : undefined;
}

function safeDiagnosticText(
  value: unknown,
  env: Record<string, string | undefined>,
): string | null {
  if (typeof value !== "string") return null;
  return redactDiagnosticMessage(value, env).slice(0, 500);
}

function safeDiagnosticNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeDiagnosticScalar(
  value: unknown,
  env: Record<string, string | undefined>,
): string | number | null {
  return typeof value === "number" ? safeDiagnosticNumber(value) : safeDiagnosticText(value, env);
}

function supabaseUrlMetadata(
  value: string | undefined,
  env: Record<string, string | undefined>,
): Record<string, unknown> {
  const normalized = value?.trim() ?? "";
  let parsed: URL | null = null;
  try {
    if (normalized) parsed = new URL(normalized);
  } catch {
    // Keep malformed values out of logs; the metadata below will show parse failure.
  }

  return {
    supabase_url_length: value?.length ?? 0,
    supabase_url_has_leading_whitespace: value ? value.length !== value.trimStart().length : false,
    supabase_url_has_trailing_whitespace: value ? value.length !== value.trimEnd().length : false,
    supabase_url_has_trailing_slash: normalized.endsWith("/"),
    supabase_url_protocol: safeDiagnosticText(parsed?.protocol, env),
    supabase_url_hostname: safeDiagnosticText(parsed?.hostname, env),
    supabase_url_pathname: safeDiagnosticText(parsed?.pathname, env),
    supabase_url_trimmed_matches_expected: normalized === EXPECTED_SUPABASE_URL,
  };
}

function classifyFetchFailure(value: unknown): string | null {
  const current = errorLike(value);
  const nested = errorLike(current?.cause);
  const codes = [current?.code, nested?.code]
    .filter((code): code is string => typeof code === "string")
    .map((code) => code.toUpperCase());
  const names = [current?.name, nested?.name]
    .filter((name): name is string => typeof name === "string")
    .map((name) => name.toLowerCase());
  const messages = [current?.message, nested?.message]
    .filter((message): message is string => typeof message === "string")
    .map((message) => message.toLowerCase());

  if (
    codes.some((code) => ["ENOTFOUND", "EAI_AGAIN", "EAI_FAIL", "ENODATA"].includes(code)) ||
    messages.some((message) => message.includes("getaddrinfo"))
  ) {
    return "dns_resolution_failure";
  }
  if (
    names.some((name) => name === "timeouterror" || name === "aborterror") ||
    codes.some((code) =>
      ["ETIMEDOUT", "ABORT_ERR", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT"].includes(
        code,
      ),
    )
  ) {
    return "timeout";
  }
  if (
    codes.some(
      (code) =>
        code.startsWith("ECONN") ||
        ["EHOSTUNREACH", "ENETUNREACH", "EPIPE", "UND_ERR_SOCKET"].includes(code) ||
        code.startsWith("ERR_TLS") ||
        code.startsWith("CERT_") ||
        code.startsWith("UND_ERR_CONNECT"),
    ) ||
    messages.some((message) => /\b(connect|tls|ssl|certificate|handshake)\b/.test(message))
  ) {
    return "tcp_tls_connection_failure";
  }
  return null;
}

async function probeSupabaseHttp(url: string | undefined): Promise<Record<string, unknown>> {
  if (!url) return { result: "skipped", reason: "supabase_url_missing" };

  let probeUrl: URL;
  try {
    const configuredUrl = new URL(url);
    if (configuredUrl.protocol !== "https:" || configuredUrl.username || configuredUrl.password) {
      return { result: "skipped", reason: "configured_url_not_safe_for_probe" };
    }
    probeUrl = new URL("/rest/v1/", configuredUrl.origin);
  } catch {
    return { result: "skipped", reason: "configured_url_invalid" };
  }

  try {
    const response = await fetch(probeUrl, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(2500),
    });
    return { result: "http_response_received", status: response.status };
  } catch (cause) {
    const nested = errorLike(errorLike(cause)?.cause);
    const errorValue = errorLike(cause);
    const classified = classifyFetchFailure(cause);
    const message = safeDiagnosticText(errorValue?.message, runtimeEnvironment());
    return {
      result: classified ?? "network_failure_unclassified",
      error_name: safeDiagnosticText(errorValue?.name, runtimeEnvironment()),
      error_code: safeDiagnosticText(errorValue?.code, runtimeEnvironment()),
      error_message: message,
      cause_name: safeDiagnosticText(nested?.name, runtimeEnvironment()),
      cause_code: safeDiagnosticText(nested?.code, runtimeEnvironment()),
      cause_message: safeDiagnosticText(nested?.message, runtimeEnvironment()),
      cause_errno: safeDiagnosticScalar(nested?.errno, runtimeEnvironment()),
      cause_syscall: safeDiagnosticText(nested?.syscall, runtimeEnvironment()),
      cause_hostname: safeDiagnosticText(nested?.hostname, runtimeEnvironment()),
      cause_address: safeDiagnosticText(nested?.address, runtimeEnvironment()),
      cause_port: safeDiagnosticNumber(nested?.port),
    };
  }
}

async function logDatabaseFailure(cause: unknown, area: string): Promise<void> {
  const runtimeProcess = typeof process === "undefined" ? undefined : process;
  const env = runtimeProcess?.env ?? {};
  const keyName = selectedSupabaseKey(env);
  const key = keyName === "none" ? undefined : env[keyName];
  const errorValue = errorLike(cause);
  const nestedError = errorLike(errorValue?.cause);
  const code =
    typeof errorValue?.code === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(errorValue.code)
      ? errorValue.code
      : null;
  const message =
    typeof errorValue?.message === "string"
      ? errorValue.message
      : cause instanceof Error
        ? cause.message
        : "Unknown database or runtime error";
  const status = safeDiagnosticNumber(errorValue?.status);
  const isFetchFailure = /fetch failed/i.test(message);
  const probe = isFetchFailure ? await probeSupabaseHttp(env["SUPABASE_URL"]) : null;
  const platform =
    env["NETLIFY"] === "true"
      ? "netlify"
      : env["AWS_LAMBDA_FUNCTION_NAME"]
        ? "aws_lambda"
        : "unknown";

  console.error(
    "[booking-api] database failure",
    JSON.stringify({
      area,
      platform,
      runtime: runtimeProcess?.release?.name ?? "unknown",
      node_version: runtimeProcess?.version ?? null,
      supabase_url_configured: Boolean(env["SUPABASE_URL"]),
      supabase_url_matches_expected: env["SUPABASE_URL"] === EXPECTED_SUPABASE_URL,
      ...supabaseUrlMetadata(env["SUPABASE_URL"], env),
      supabase_key_configured: Boolean(key),
      selected_key_type: keyName,
      supabase_error_code: code,
      supabase_error_message: redactDiagnosticMessage(message, env),
      supabase_http_status: status,
      supabase_error_name: safeDiagnosticText(errorValue?.name, env),
      supabase_error_cause_name: safeDiagnosticText(nestedError?.name, env),
      supabase_error_cause_code: safeDiagnosticText(nestedError?.code, env),
      supabase_error_cause_message: safeDiagnosticText(nestedError?.message, env),
      supabase_error_cause_errno: safeDiagnosticScalar(nestedError?.errno, env),
      supabase_error_cause_syscall: safeDiagnosticText(nestedError?.syscall, env),
      supabase_error_cause_hostname: safeDiagnosticText(nestedError?.hostname, env),
      supabase_error_cause_address: safeDiagnosticText(nestedError?.address, env),
      supabase_error_cause_port: safeDiagnosticNumber(nestedError?.port),
      supabase_transport_classification:
        status !== null
          ? "http_response_received"
          : (classifyFetchFailure(cause) ??
            (isFetchFailure ? "network_failure_unclassified" : null)),
      supabase_connectivity_probe: probe,
    }),
  );
}

async function databaseFailure(cause: unknown, area: string): Promise<Response> {
  await logDatabaseFailure(cause, area);
  return error("internal_server_error", "The request could not be completed.", 500);
}

export function rejectCrossOriginRequest(request: Request): Response | null {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  const origin = request.headers.get("origin");
  if (fetchSite === "cross-site") {
    return error("invalid_request", "Cross-origin requests are not allowed.", 403);
  }
  if (origin !== null) {
    try {
      const originUrl = new URL(origin);
      const requestUrl = new URL(request.url);

      // Direct origin match (e.g. standard local execution or unproxied URLs)
      if (originUrl.origin === requestUrl.origin) {
        return null;
      }

      // Check forwarded host or host header against origin hostname (for reverse proxies, Cloud Run, preview URLs)
      const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
      const hostHeader = (forwardedHost || request.headers.get("host"))?.trim();
      const hostName = hostHeader?.split(":")[0]?.trim();

      if (hostName && (originUrl.hostname === hostName || originUrl.host === hostHeader)) {
        return null;
      }

      // If sec-fetch-site is explicitly same-origin, browser verified same-origin context
      if (fetchSite === "same-origin") {
        return null;
      }

      return error("invalid_request", "Cross-origin requests are not allowed.", 403);
    } catch {
      return error("invalid_request", "Cross-origin requests are not allowed.", 403);
    }
  }
  return null;
}

async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new RequestValidationError();
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 12_000) throw new RequestValidationError();
  const text = await request.text();
  if (text.length > 12_000) throw new RequestValidationError();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RequestValidationError();
  }
}

class RequestValidationError extends Error {}

const FALLBACK_COUNTRIES = [
  {
    id: "a0000000-0000-4000-8000-000000000001",
    iso2: "IN",
    iso3: "IND",
    name: "India",
    currency_code: "INR",
    is_active: true,
  },
];

const FALLBACK_REGIONS = [
  {
    id: "a0000000-0000-4000-8000-000000000002",
    country_id: "a0000000-0000-4000-8000-000000000001",
    kind: "state",
    code: "MH",
    name: "Maharashtra",
    is_active: true,
  },
];

export const FALLBACK_CITIES = clientCities.map((city) => ({
  id: city.id,
  country_id: "a0000000-0000-4000-8000-000000000001",
  region_id: "a0000000-0000-4000-8000-000000000002",
  name: city.name,
  slug: city.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  timezone: "Asia/Kolkata",
  is_active: true,
}));

const BASE_LOCATIONS = [
  {
    id: "a0000000-0000-4000-8000-000000000100",
    city_id: "a0000000-0000-4000-8000-000000000003",
    kind: "city_zone",
    name: "Mumbai - Doorstep / City Address",
    address: "Any residential, hotel, or office address in Mumbai",
    latitude: 19.076,
    longitude: 72.8777,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000101",
    city_id: "a0000000-0000-4000-8000-000000000003",
    kind: "airport",
    name: "Mumbai Airport Terminal 1",
    address: "Chhatrapati Shivaji Maharaj International Airport Terminal 1, Santacruz",
    latitude: 19.092617,
    longitude: 72.855744,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000102",
    city_id: "a0000000-0000-4000-8000-000000000003",
    kind: "airport",
    name: "Mumbai Airport Terminal 2",
    address: "Chhatrapati Shivaji Maharaj International Airport Terminal 2, Sahar Road, Andheri East",
    latitude: 19.097777,
    longitude: 72.874347,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000103",
    city_id: "a0000000-0000-4000-8000-000000000003",
    kind: "railway_station",
    name: "Mumbai Central",
    address: "Mumbai Central Railway Station",
    latitude: 18.969586,
    longitude: 72.819315,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000104",
    city_id: "a0000000-0000-4000-8000-000000000003",
    kind: "railway_station",
    name: "Bandra Terminus",
    address: "Bandra Terminus Station, Bandra East",
    latitude: 19.064672,
    longitude: 72.841661,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000105",
    city_id: "a0000000-0000-4000-8000-000000000003",
    kind: "business_district",
    name: "Bandra Kurla Complex (BKC)",
    address: "Bandra Kurla Complex, G Block, Bandra East",
    latitude: 19.067115,
    longitude: 72.865725,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000106",
    city_id: "a0000000-0000-4000-8000-000000000003",
    kind: "landmark",
    name: "Colaba",
    address: "Colaba Causeway / Gateway of India Area",
    latitude: 18.915091,
    longitude: 72.825969,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000109",
    city_id: "a0000000-0000-4000-8000-000000000004",
    kind: "city_zone",
    name: "Pune - Doorstep / City Address",
    address: "Any residential, hotel, or office address in Pune",
    latitude: 18.5204,
    longitude: 73.8567,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000107",
    city_id: "a0000000-0000-4000-8000-000000000004",
    kind: "airport",
    name: "Pune Airport (PNQ)",
    address: "Pune International Airport, Lohegaon, Pune",
    latitude: 18.5822,
    longitude: 73.9197,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000108",
    city_id: "a0000000-0000-4000-8000-000000000004",
    kind: "railway_station",
    name: "Pune Railway Station",
    address: "Station Road, Agarkar Nagar, Pune",
    latitude: 18.5289,
    longitude: 73.8744,
    is_active: true,
  },
];

const ADDITIONAL_LOCATIONS = FALLBACK_CITIES.flatMap((city, cityIdx) => {
  if (city.name === "Mumbai" || city.name === "Pune") return [];
  const rawCity = indiaCities.find((c) => c.name === city.name);
  const lon = rawCity?.at[0] ?? 77.0;
  const lat = rawCity?.at[1] ?? 28.0;

  return [
    {
      id: `a0000000-0000-4000-8000-${String(2000 + cityIdx * 10).padStart(12, "0")}`,
      city_id: city.id,
      kind: "city_zone",
      name: `${city.name} - Doorstep / City Address`,
      address: `Any home, hotel, residential, or office address in ${city.name}`,
      latitude: lat,
      longitude: lon,
      is_active: true,
    },
    {
      id: `a0000000-0000-4000-8000-${String(2000 + cityIdx * 10 + 1).padStart(12, "0")}`,
      city_id: city.id,
      kind: "airport",
      name: `${city.name} Airport`,
      address: `${city.name} Airport Terminal`,
      latitude: Number((lat + 0.05).toFixed(6)),
      longitude: Number((lon + 0.05).toFixed(6)),
      is_active: true,
    },
    {
      id: `a0000000-0000-4000-8000-${String(2000 + cityIdx * 10 + 2).padStart(12, "0")}`,
      city_id: city.id,
      kind: "railway_station",
      name: `${city.name} Railway Station`,
      address: `${city.name} Central Railway Station`,
      latitude: Number((lat - 0.02).toFixed(6)),
      longitude: Number((lon - 0.02).toFixed(6)),
      is_active: true,
    },
    {
      id: `a0000000-0000-4000-8000-${String(2000 + cityIdx * 10 + 3).padStart(12, "0")}`,
      city_id: city.id,
      kind: "business_district",
      name: `${city.name} Commercial District`,
      address: `Central Commercial Hub, ${city.name}`,
      latitude: lat,
      longitude: lon,
      is_active: true,
    },
  ];
});

const FALLBACK_LOCATIONS = [...BASE_LOCATIONS, ...ADDITIONAL_LOCATIONS];

export const MUMBAI_CITY_ID = "a0000000-0000-4000-8000-000000000003";

export const MUMBAI_VEHICLE_CATEGORIES = [
  {
    id: "a0000000-0000-4000-8000-000000000010",
    code: "MUMBAI_SEDAN",
    name: "Sedan",
    passenger_capacity: 4,
    luggage_capacity: 2,
    models: ["Maruti Dzire", "Alma"],
    pricing_type: "fixed" as const,
    display_order: 1,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000011",
    code: "MUMBAI_SUV",
    name: "SUV",
    passenger_capacity: 6,
    luggage_capacity: 4,
    models: [
      "Maruti Ertiga",
      "Toyota Rumion",
      "Kia Carens",
      "Honda City",
      "Maruti Ciaz",
    ],
    pricing_type: "fixed" as const,
    display_order: 2,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000013",
    code: "MUMBAI_PREMIUM_SUV",
    name: "Premium SUV",
    passenger_capacity: 7,
    luggage_capacity: 4,
    models: ["Toyota Innova Crysta"],
    pricing_type: "fixed" as const,
    display_order: 3,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000014",
    code: "MUMBAI_HYCROSS_INVICTO",
    name: "Innova Hycross / Maruti Suzuki Invicto",
    passenger_capacity: 7,
    luggage_capacity: 4,
    models: ["Toyota Innova Hycross", "Maruti Suzuki Invicto"],
    pricing_type: "price_on_request" as const,
    display_order: 4,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000015",
    code: "MUMBAI_EXCLUSIVE_SUV",
    name: "Exclusive SUV",
    passenger_capacity: 7,
    luggage_capacity: 4,
    models: ["Toyota Fortuner", "Kia Carnival"],
    pricing_type: "price_on_request" as const,
    display_order: 5,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000016",
    code: "MUMBAI_PREMIUM_SEDAN",
    name: "Premium Sedan",
    passenger_capacity: 4,
    luggage_capacity: 3,
    models: ["Toyota Camry"],
    pricing_type: "price_on_request" as const,
    display_order: 6,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000012",
    code: "MUMBAI_LUXURY_SEDAN",
    name: "Luxury Sedan",
    passenger_capacity: 4,
    luggage_capacity: 3,
    models: [
      "BMW 5 Series",
      "Audi A6",
      "Mercedes E-Class",
      "Mercedes S-Class",
      "BMW 7 Series",
    ],
    pricing_type: "price_on_request" as const,
    display_order: 7,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000017",
    code: "MUMBAI_LUXURY_VAN",
    name: "Luxury Van",
    passenger_capacity: 7,
    luggage_capacity: 6,
    models: ["Mercedes GLE 350", "Toyota Vellfire", "Mercedes V-Class"],
    pricing_type: "price_on_request" as const,
    display_order: 8,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000018",
    code: "MUMBAI_GROUP_COACH",
    name: "Group / Coach",
    passenger_capacity: 45,
    luggage_capacity: 45,
    models: [
      "Urbania 9 Seater",
      "Urbania 16 Seater",
      "35 Seater BharatBenz",
      "45 Seater BharatBenz",
      "45 Seater Volvo",
    ],
    pricing_type: "price_on_request" as const,
    display_order: 9,
    is_active: true,
  },
];

export const MUMBAI_PRICING_RULES = [
  // Airport Transfers (30 km / 2 hours included, ₹150 night charge)
  {
    id: "a0000000-0000-4000-8000-000000000501",
    vehicle_category_id: "a0000000-0000-4000-8000-000000000010",
    trip_type: "airport_transfer" as const,
    package_tier: "airport_transfer" as const,
    origin_city_id: MUMBAI_CITY_ID,
    destination_city_id: null,
    base_fare: 1199,
    included_hours: 2,
    included_km: 30,
    minimum_daily_km: null,
    extra_km_rate: 15,
    extra_hour_rate: 150,
    driver_allowance_per_day: 0,
    night_surcharge: 150,
    airport_charge: 0,
    tolls_charge: 0,
    tax_rate_percent: 0,
    currency_code: "INR",
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000502",
    vehicle_category_id: "a0000000-0000-4000-8000-000000000011",
    trip_type: "airport_transfer" as const,
    package_tier: "airport_transfer" as const,
    origin_city_id: MUMBAI_CITY_ID,
    destination_city_id: null,
    base_fare: 1899,
    included_hours: 2,
    included_km: 30,
    minimum_daily_km: null,
    extra_km_rate: 17,
    extra_hour_rate: 175,
    driver_allowance_per_day: 0,
    night_surcharge: 150,
    airport_charge: 0,
    tolls_charge: 0,
    tax_rate_percent: 0,
    currency_code: "INR",
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000503",
    vehicle_category_id: "a0000000-0000-4000-8000-000000000013",
    trip_type: "airport_transfer" as const,
    package_tier: "airport_transfer" as const,
    origin_city_id: MUMBAI_CITY_ID,
    destination_city_id: null,
    base_fare: 2499,
    included_hours: 2,
    included_km: 30,
    minimum_daily_km: null,
    extra_km_rate: 21,
    extra_hour_rate: 210,
    driver_allowance_per_day: 0,
    night_surcharge: 150,
    airport_charge: 0,
    tolls_charge: 0,
    tax_rate_percent: 0,
    currency_code: "INR",
    is_active: true,
  },

  // Local Rentals - 4 Hours / 40 KM
  {
    id: "a0000000-0000-4000-8000-000000000504",
    vehicle_category_id: "a0000000-0000-4000-8000-000000000010",
    trip_type: "local" as const,
    package_tier: "4hr_40km" as const,
    origin_city_id: MUMBAI_CITY_ID,
    destination_city_id: null,
    base_fare: 1449,
    included_hours: 4,
    included_km: 40,
    minimum_daily_km: null,
    extra_km_rate: 15,
    extra_hour_rate: 150,
    driver_allowance_per_day: 0,
    night_surcharge: 150,
    airport_charge: 0,
    tolls_charge: 0,
    tax_rate_percent: 0,
    currency_code: "INR",
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000505",
    vehicle_category_id: "a0000000-0000-4000-8000-000000000011",
    trip_type: "local" as const,
    package_tier: "4hr_40km" as const,
    origin_city_id: MUMBAI_CITY_ID,
    destination_city_id: null,
    base_fare: 2199,
    included_hours: 4,
    included_km: 40,
    minimum_daily_km: null,
    extra_km_rate: 17,
    extra_hour_rate: 175,
    driver_allowance_per_day: 0,
    night_surcharge: 150,
    airport_charge: 0,
    tolls_charge: 0,
    tax_rate_percent: 0,
    currency_code: "INR",
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000506",
    vehicle_category_id: "a0000000-0000-4000-8000-000000000013",
    trip_type: "local" as const,
    package_tier: "4hr_40km" as const,
    origin_city_id: MUMBAI_CITY_ID,
    destination_city_id: null,
    base_fare: 2599,
    included_hours: 4,
    included_km: 40,
    minimum_daily_km: null,
    extra_km_rate: 21,
    extra_hour_rate: 210,
    driver_allowance_per_day: 0,
    night_surcharge: 150,
    airport_charge: 0,
    tolls_charge: 0,
    tax_rate_percent: 0,
    currency_code: "INR",
    is_active: true,
  },

  // Local Rentals - 8 Hours / 80 KM
  {
    id: "a0000000-0000-4000-8000-000000000507",
    vehicle_category_id: "a0000000-0000-4000-8000-000000000010",
    trip_type: "local" as const,
    package_tier: "8hr_80km" as const,
    origin_city_id: MUMBAI_CITY_ID,
    destination_city_id: null,
    base_fare: 2499,
    included_hours: 8,
    included_km: 80,
    minimum_daily_km: null,
    extra_km_rate: 15,
    extra_hour_rate: 150,
    driver_allowance_per_day: 0,
    night_surcharge: 150,
    airport_charge: 0,
    tolls_charge: 0,
    tax_rate_percent: 0,
    currency_code: "INR",
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000508",
    vehicle_category_id: "a0000000-0000-4000-8000-000000000011",
    trip_type: "local" as const,
    package_tier: "8hr_80km" as const,
    origin_city_id: MUMBAI_CITY_ID,
    destination_city_id: null,
    base_fare: 3249,
    included_hours: 8,
    included_km: 80,
    minimum_daily_km: null,
    extra_km_rate: 17,
    extra_hour_rate: 175,
    driver_allowance_per_day: 0,
    night_surcharge: 150,
    airport_charge: 0,
    tolls_charge: 0,
    tax_rate_percent: 0,
    currency_code: "INR",
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000509",
    vehicle_category_id: "a0000000-0000-4000-8000-000000000013",
    trip_type: "local" as const,
    package_tier: "8hr_80km" as const,
    origin_city_id: MUMBAI_CITY_ID,
    destination_city_id: null,
    base_fare: 3499,
    included_hours: 8,
    included_km: 80,
    minimum_daily_km: null,
    extra_km_rate: 21,
    extra_hour_rate: 210,
    driver_allowance_per_day: 0,
    night_surcharge: 150,
    airport_charge: 0,
    tolls_charge: 0,
    tax_rate_percent: 0,
    currency_code: "INR",
    is_active: true,
  },

  // Outstation (300 km min billing, ₹150 night charge)
  {
    id: "a0000000-0000-4000-8000-000000000510",
    vehicle_category_id: "a0000000-0000-4000-8000-000000000010",
    trip_type: "outstation" as const,
    package_tier: "outstation" as const,
    origin_city_id: MUMBAI_CITY_ID,
    destination_city_id: null,
    base_fare: 4500,
    included_hours: null,
    included_km: 300,
    minimum_daily_km: 300,
    extra_km_rate: 15,
    extra_hour_rate: 0,
    driver_allowance_per_day: 450,
    night_surcharge: 150,
    airport_charge: 0,
    tolls_charge: 0,
    tax_rate_percent: 0,
    currency_code: "INR",
    is_active: true,
    internal_notes: "Configured calculated rate: 300 km min billing @ ₹15/km + ₹450/day driver allowance.",
  },
  {
    id: "a0000000-0000-4000-8000-000000000511",
    vehicle_category_id: "a0000000-0000-4000-8000-000000000011",
    trip_type: "outstation" as const,
    package_tier: "outstation" as const,
    origin_city_id: MUMBAI_CITY_ID,
    destination_city_id: null,
    base_fare: 5100,
    included_hours: null,
    included_km: 300,
    minimum_daily_km: 300,
    extra_km_rate: 17,
    extra_hour_rate: 0,
    driver_allowance_per_day: 0,
    night_surcharge: 150,
    airport_charge: 0,
    tolls_charge: 0,
    tax_rate_percent: 0,
    currency_code: "INR",
    is_active: true,
    internal_notes: "Configured calculated rate: 300 km min billing @ ₹17/km. Driver allowance unconfigured until confirmed.",
  },
  {
    id: "a0000000-0000-4000-8000-000000000512",
    vehicle_category_id: "a0000000-0000-4000-8000-000000000013",
    trip_type: "outstation" as const,
    package_tier: "outstation" as const,
    origin_city_id: MUMBAI_CITY_ID,
    destination_city_id: null,
    base_fare: 6300,
    included_hours: null,
    included_km: 300,
    minimum_daily_km: 300,
    extra_km_rate: 21,
    extra_hour_rate: 0,
    driver_allowance_per_day: 0,
    night_surcharge: 150,
    airport_charge: 0,
    tolls_charge: 0,
    tax_rate_percent: 0,
    currency_code: "INR",
    is_active: true,
    internal_notes: "Configured calculated rate: 300 km min billing @ ₹21/km. Driver allowance unconfigured until confirmed.",
  },
];

const FALLBACK_VEHICLE_CATEGORIES = [
  {
    id: "a0000000-0000-4000-8000-000000000010",
    code: "SEDAN",
    name: "Executive Sedan",
    passenger_capacity: 4,
    luggage_capacity: 2,
    models: ["Maruti Dzire", "Honda City", "Hyundai Aura"],
    pricing_type: "fixed" as const,
    display_order: 1,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000011",
    code: "SUV",
    name: "SUV / MUV",
    passenger_capacity: 6,
    luggage_capacity: 4,
    models: ["Maruti Ertiga", "Toyota Innova", "Kia Carens"],
    pricing_type: "fixed" as const,
    display_order: 2,
    is_active: true,
  },
  {
    id: "a0000000-0000-4000-8000-000000000012",
    code: "SUV_PREMIUM",
    name: "Premium Luxury",
    passenger_capacity: 6,
    luggage_capacity: 4,
    models: ["Toyota Fortuner", "Mercedes E-Class", "BMW 5 Series"],
    pricing_type: "fixed" as const,
    display_order: 3,
    is_active: true,
  },
];

const FALLBACK_CITY_VEHICLE_CATEGORIES = FALLBACK_CITIES.flatMap((city) => {
  if (city.id === MUMBAI_CITY_ID) {
    return MUMBAI_VEHICLE_CATEGORIES.map((category) => ({
      city_id: city.id,
      vehicle_category_id: category.id,
      is_available: true,
      valid_from: null,
      valid_until: null,
      vehicle_categories: category,
    }));
  }
  return FALLBACK_VEHICLE_CATEGORIES.map((category) => ({
    city_id: city.id,
    vehicle_category_id: category.id,
    is_available: true,
    valid_from: null,
    valid_until: null,
    vehicle_categories: category,
  }));
});

const ALL_FALLBACK_VEHICLE_CATEGORIES = [
  ...FALLBACK_VEHICLE_CATEGORIES,
  ...MUMBAI_VEHICLE_CATEGORIES.filter(
    (mc) => !FALLBACK_VEHICLE_CATEGORIES.some((fc) => fc.id === mc.id),
  ),
];

export function createFallbackBookingDatabase(): BookingDatabase {
  const fallbackQuotes = new Map<string, Record<string, unknown>>();
  const fallbackBookings = new Map<string, Record<string, unknown>>();

  const database = {
    from(tableName: string) {
      let rows: Record<string, unknown>[] = [];
      if (tableName === "countries") rows = [...FALLBACK_COUNTRIES];
      else if (tableName === "regions") rows = [...FALLBACK_REGIONS];
      else if (tableName === "cities") rows = [...FALLBACK_CITIES];
      else if (tableName === "locations") {
        rows = FALLBACK_LOCATIONS.map((loc) => ({
          ...loc,
          cities: { is_active: true, countries: { is_active: true } },
        }));
      } else if (tableName === "vehicle_categories") rows = [...ALL_FALLBACK_VEHICLE_CATEGORIES];
      else if (tableName === "city_vehicle_categories")
        rows = [...FALLBACK_CITY_VEHICLE_CATEGORIES];
      else if (tableName === "pricing_rules") rows = [...MUMBAI_PRICING_RULES];
      else if (tableName === "quotes") rows = Array.from(fallbackQuotes.values());
      else if (tableName === "bookings") rows = Array.from(fallbackBookings.values());

      type FallbackQueryBuilder = {
        select: (cols?: string) => FallbackQueryBuilder;
        eq: (col: string, val: unknown) => FallbackQueryBuilder;
        ilike: (col: string, pattern: string) => FallbackQueryBuilder;
        or: (cond: string) => FallbackQueryBuilder;
        order: (col: string, opts?: unknown) => FallbackQueryBuilder;
        limit: (n: number) => FallbackQueryBuilder;
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: null }>;
        then: <TResult1 = { data: Record<string, unknown>[]; error: null }>(
          resolve: (val: { data: Record<string, unknown>[]; error: null }) => TResult1,
        ) => Promise<TResult1>;
      };

      const builder: FallbackQueryBuilder = {
        select(_cols?: string) {
          return builder;
        },
        eq(col: string, val: unknown) {
          if (
            col === "is_active" ||
            col === "cities.is_active" ||
            col === "cities.countries.is_active"
          ) {
            rows = rows.filter((r) => r["is_active"] === val);
          } else if (col === "vehicle_categories.is_active") {
            rows = rows.filter((r) => {
              const vc = r["vehicle_categories"] as Record<string, unknown> | undefined;
              return vc?.["is_active"] === val;
            });
          } else {
            rows = rows.filter((r) => r[col] === val);
          }
          return builder;
        },
        ilike(col: string, pattern: string) {
          const needle = pattern.replace(/^%|%$/g, "").toLowerCase();
          rows = rows.filter((r) => String(r[col] ?? "").toLowerCase().includes(needle));
          return builder;
        },
        or(_cond: string) {
          return builder;
        },
        order(col: string, _opts?: unknown) {
          rows.sort((a, b) => {
            const valA = a[col];
            const valB = b[col];
            if (typeof valA === "string" && typeof valB === "string")
              return valA.localeCompare(valB);
            if (typeof valA === "number" && typeof valB === "number") return valA - valB;
            return 0;
          });
          return builder;
        },
        limit(n: number) {
          rows = rows.slice(0, n);
          return builder;
        },
        async maybeSingle() {
          return { data: rows[0] ?? null, error: null };
        },
        then(resolve) {
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        },
      };
      return builder;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      if (name === "create_booking_quote") {
        const categoryId = String(args["p_vehicle_category_id"] ?? "");
        const category = MUMBAI_VEHICLE_CATEGORIES.find((c) => c.id === categoryId);
        const passengerCount = Number(args["p_passenger_count"] ?? 1);

        if (!category) {
          return { data: [{ result_status: "VEHICLE_UNAVAILABLE" }], error: null };
        }
        if (passengerCount > category.passenger_capacity) {
          return { data: [{ result_status: "VEHICLE_UNAVAILABLE" }], error: null };
        }
        if (category.pricing_type === "price_on_request") {
          return {
            data: [{ result_status: "ONLINE_PRICING_UNAVAILABLE" }],
            error: null,
          };
        }

        const tripType = String(args["p_trip_type"]);
        const packageTier = String(args["p_package_tier"]);

        // Resolve pricing rule
        const rule = MUMBAI_PRICING_RULES.find(
          (r) =>
            r.vehicle_category_id === categoryId &&
            r.trip_type === tripType &&
            r.package_tier === packageTier &&
            r.is_active,
        );

        if (!rule) {
          return {
            data: [{ result_status: "ONLINE_PRICING_UNAVAILABLE" }],
            error: null,
          };
        }

        const rawDistance = args["p_estimated_distance_km"];
        const rawDuration = args["p_estimated_duration_hours"];

        if (rule.extra_km_rate > 0 && (rawDistance === undefined || rawDistance === null)) {
          return { data: [{ result_status: "DISTANCE_REQUIRED" }], error: null };
        }
        if (rule.extra_hour_rate > 0 && (rawDuration === undefined || rawDuration === null)) {
          return { data: [{ result_status: "DURATION_REQUIRED" }], error: null };
        }

        const distanceKm = Number(rawDistance ?? 0);
        const durationHours = Number(rawDuration ?? 0);
        const tripDays = Number(args["p_trip_days"] ?? 1);

        let extraDistance = 0;
        let extraDuration = 0;
        if (tripType === "outstation") {
          const includedKm = rule.included_km ?? 300;
          extraDistance = Math.round(Math.max(0, distanceKm - includedKm) * rule.extra_km_rate * 100) / 100;
          extraDuration = 0;
        } else {
          extraDistance = Math.round(Math.max(0, distanceKm - (rule.included_km ?? 0)) * rule.extra_km_rate * 100) / 100;
          extraDuration = Math.round(Math.max(0, durationHours - (rule.included_hours ?? 0)) * rule.extra_hour_rate * 100) / 100;
        }

        const driverAllowance = Math.round((rule.driver_allowance_per_day ?? 0) * tripDays * 100) / 100;

        // Night surcharge: 22:00 to 06:00 in Asia/Kolkata
        let nightSurcharge = 0;
        const pickupAtStr = String(args["p_pickup_at"] ?? "");
        if (pickupAtStr) {
          const pickupDate = new Date(pickupAtStr);
          const pickupHour = parseInt(
            new Intl.DateTimeFormat("en-US", {
              hour: "numeric",
              hour12: false,
              timeZone: "Asia/Kolkata",
            }).format(pickupDate),
            10,
          );
          if (pickupHour >= 22 || pickupHour < 6) {
            nightSurcharge = rule.night_surcharge ?? 150;
          }
        }

        const subtotal = Math.round((rule.base_fare + extraDistance + extraDuration + driverAllowance + nightSurcharge) * 100) / 100;
        const tax = Math.round((subtotal * (rule.tax_rate_percent ?? 0) / 100) * 100) / 100;
        const total = subtotal + tax;

        const quoteId = `a0000000-0000-4000-8000-${String(Math.floor(100000000000 + Math.random() * 900000000000))}`;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

        const pricingSnapshot = {
          currency: rule.currency_code ?? "INR",
          pricingRuleId: rule.id,
          components: {
            baseFare: rule.base_fare,
            extraDistance,
            extraDuration,
            driverAllowance,
            nightSurcharge,
            airportCharge: 0,
            tolls: 0,
            subtotal,
            taxRatePercent: rule.tax_rate_percent ?? 0,
            tax,
            total,
          },
          allowances: {
            includedKm: rule.included_km,
            includedHours: rule.included_hours,
            extraKmRate: rule.extra_km_rate,
            extraHourRate: rule.extra_hour_rate,
            driverAllowancePerDay: rule.driver_allowance_per_day,
            nightSurcharge: rule.night_surcharge,
          },
          inputs: {
            distanceKm,
            durationHours,
            tripDays,
          },
        };

        fallbackQuotes.set(quoteId, {
          id: quoteId,
          created_at: now.toISOString(),
          expires_at: expiresAt,
          subtotal,
          tax_amount: tax,
          total_amount: total,
          status: "open",
          pricing_snapshot: pricingSnapshot,
        });

        return {
          data: [
            {
              result_status: "CREATED",
              quote_id: quoteId,
              pricing: pricingSnapshot,
            },
          ],
          error: null,
        };
      }
      if (name === "create_booking_from_quote") {
        const quoteId = String(args["p_quote_id"] ?? "");
        const quote = fallbackQuotes.get(quoteId);
        if (!quote) {
          return { data: [{ result_status: "QUOTE_NOT_FOUND" }], error: null };
        }
        if (new Date(String(quote["expires_at"])).getTime() <= Date.now()) {
          return { data: [{ result_status: "QUOTE_EXPIRED" }], error: null };
        }
        if (quote["status"] !== "open") {
          return { data: [{ result_status: "QUOTE_ALREADY_CLAIMED" }], error: null };
        }
        quote["status"] = "claimed";
        const bookingId = `a0000000-0000-4000-8000-${String(Math.floor(100000000000 + Math.random() * 900000000000))}`;
        const bookingRef = "DC-" + bookingId.replace(/-/g, "").slice(0, 16).toUpperCase();
        const bookingData = {
          id: bookingId,
          booking_reference: bookingRef,
          currency: "INR",
          total: Number(quote["total_amount"]),
          customer: {
            fullName: String(args["p_full_name"] ?? ""),
            email: String(args["p_email"] ?? ""),
            phone: String(args["p_phone"] ?? ""),
          },
        };
        fallbackBookings.set(bookingId, bookingData);
        return {
          data: [
            {
              result_status: "CREATED",
              booking: bookingData,
            },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    },
  };
  return database as unknown as BookingDatabase;
}

export function createBookingDatabase(
  env: Record<string, string | undefined> = runtimeEnvironment(),
): BookingDatabase {
  const url = env["SUPABASE_URL"];
  const key = env["SUPABASE_SECRET_KEY"] ?? env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    return createFallbackBookingDatabase();
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

async function activeParent(
  database: BookingDatabase,
  table: "countries" | "cities",
  id: string,
): Promise<boolean> {
  const columns = table === "cities" ? "id,country_id,region_id" : "id";
  const { data, error: dbError } = await database
    .from(table)
    .select(columns)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (dbError) throw dbError;
  if (!data) return false;
  if (table === "countries") return true;

  const city = data as unknown as { country_id: string; region_id: string | null };
  if (!(await activeParent(database, "countries", city.country_id))) return false;
  if (!city.region_id) return true;
  const { data: region, error: regionError } = await database
    .from("regions")
    .select("id")
    .eq("id", city.region_id)
    .eq("country_id", city.country_id)
    .eq("is_active", true)
    .maybeSingle();
  if (regionError) throw regionError;
  return Boolean(region);
}

function parseUuidParam(value: string | null): string | null {
  return value && uuid.safeParse(value).success ? value : null;
}

export async function handleCatalog(
  request: Request,
  resource: string,
  database: BookingDatabase,
): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    if (resource === "countries") {
      const { data, error: dbError } = await database
        .from("countries")
        .select("id,iso2,iso3,name,currency_code")
        .eq("is_active", true)
        .order("name");
      if (dbError) throw dbError;
      return json({ data: data ?? [] });
    }

    if (resource === "regions") {
      const countryId = parseUuidParam(params.get("country_id"));
      if (!countryId) return error("invalid_request", "A valid country_id is required.", 400);
      if (!(await activeParent(database, "countries", countryId)))
        return error("invalid_location", "The selected country is unavailable.", 404);
      const { data, error: dbError } = await database
        .from("regions")
        .select("id,country_id,kind,code,name")
        .eq("country_id", countryId)
        .eq("is_active", true)
        .order("name");
      if (dbError) throw dbError;
      return json({ data: data ?? [] });
    }

    if (resource === "cities") {
      const countryId = parseUuidParam(params.get("country_id"));
      const regionValue = params.get("region_id");
      if (!countryId || (regionValue && !parseUuidParam(regionValue))) {
        return error("invalid_request", "Valid country_id and region_id values are required.", 400);
      }
      if (!(await activeParent(database, "countries", countryId)))
        return error("invalid_location", "The selected country is unavailable.", 404);
      let query = database
        .from("cities")
        .select("id,country_id,region_id,name,slug,timezone")
        .eq("country_id", countryId)
        .eq("is_active", true);
      if (regionValue) {
        const { data: region, error: regionError } = await database
          .from("regions")
          .select("id")
          .eq("id", regionValue)
          .eq("country_id", countryId)
          .eq("is_active", true)
          .maybeSingle();
        if (regionError) throw regionError;
        if (!region) return error("invalid_location", "The selected region is unavailable.", 404);
        query = query.eq("region_id", regionValue);
      } else {
        const { data: regions, error: regionsError } = await database
          .from("regions")
          .select("id")
          .eq("country_id", countryId)
          .eq("is_active", true);
        if (regionsError) throw regionsError;
        const activeRegionIds = (regions ?? []).map((region) => region.id as string);
        const activeRegionFilter = activeRegionIds.length
          ? `region_id.is.null,region_id.in.(${activeRegionIds.join(",")})`
          : "region_id.is.null";
        query = query.or(activeRegionFilter);
      }
      const { data, error: dbError } = await query.order("name");
      if (dbError) throw dbError;
      return json({ data: data ?? [] });
    }

    if (resource === "locations") {
      const search = params.get("search")?.trim();
      if (search !== undefined && search !== null) {
        if (search.length < 2 || search.length > 100) {
          return error("invalid_request", "Search must contain between 2 and 100 characters.", 400);
        }
        const escapedSearch = search.replace(/[\\%_]/g, "\\$&");
        const { data, error: dbError } = await database
          .from("locations")
          .select(
            "id,city_id,kind,name,address,latitude,longitude,cities!inner(is_active,countries!inner(is_active))",
          )
          .eq("is_active", true)
          .eq("cities.is_active", true)
          .eq("cities.countries.is_active", true)
          .ilike("name", `%${escapedSearch}%`)
          .limit(10);
        if (dbError) throw dbError;
        return json({
          data: (data ?? []).map(({ cities: _cities, ...location }) => location),
        });
      }
      const cityId = parseUuidParam(params.get("city_id"));
      if (!cityId) return error("invalid_request", "A valid city_id is required.", 400);
      if (!(await activeParent(database, "cities", cityId)))
        return error("invalid_location", "The selected city is unavailable.", 404);
      const { data, error: dbError } = await database
        .from("locations")
        .select("id,city_id,kind,name,address,latitude,longitude")
        .eq("city_id", cityId)
        .eq("is_active", true)
        .order("name");
      if (dbError) throw dbError;
      return json({ data: data ?? [] });
    }

    if (resource === "vehicle-categories") {
      const cityId = parseUuidParam(params.get("city_id"));
      if (!cityId) return error("invalid_request", "A valid city_id is required.", 400);
      if (!(await activeParent(database, "cities", cityId)))
        return error("invalid_location", "The selected city is unavailable.", 404);
      const pickupAtParam = params.get("pickup_at");
      const pickupAt = pickupAtParam ? Date.parse(pickupAtParam) : Date.now();
      if (
        !Number.isFinite(pickupAt) ||
        pickupAt < Date.now() ||
        pickupAt > Date.now() + 366 * 24 * 60 * 60 * 1000
      ) {
        return error(
          "invalid_request",
          "pickup_at must be a valid future date within 366 days.",
          400,
        );
      }
      const availabilityAt = new Date(pickupAt).toISOString();
      const { data, error: dbError } = await database
        .from("city_vehicle_categories")
        .select(
          "city_id,vehicle_category_id,is_available,valid_from,valid_until,vehicle_categories!inner(id,code,name,passenger_capacity,luggage_capacity,display_order,models,pricing_type)",
        )
        .eq("city_id", cityId)
        .eq("is_available", true)
        .eq("vehicle_categories.is_active", true)
        .or(`valid_from.is.null,valid_from.lte.${availabilityAt}`)
        .or(`valid_until.is.null,valid_until.gt.${availabilityAt}`)
        .order("display_order", { referencedTable: "vehicle_categories" });
      if (dbError) throw dbError;
      return json({ data: data ?? [] });
    }

    return error("invalid_request", "Unknown catalog resource.", 404);
  } catch (cause) {
    return await databaseFailure(cause, `catalog.${resource}`);
  }
}

function packageTierCompatible(tripType: string, packageTier: string): boolean {
  const mapping: Record<string, readonly string[]> = {
    local: ["4hr_40km", "8hr_80km", "12hr_120km", "custom"],
    outstation: ["outstation", "custom"],
    airport_transfer: ["airport_transfer", "custom"],
    point_to_point: ["point_to_point", "custom"],
    tour: ["custom"],
  };
  return mapping[tripType]?.includes(packageTier) ?? false;
}

export async function handleCreateQuote(
  request: Request,
  database: BookingDatabase,
): Promise<Response> {
  let body: unknown;
  try {
    body = await readJson(request);
  } catch {
    return error("invalid_request", "Request body must be valid JSON under 12 KB.", 400);
  }
  const parsed = QuoteRequestSchema.safeParse(body);
  if (
    !parsed.success ||
    !packageTierCompatible(parsed.data?.tripType ?? "", parsed.data?.packageTier ?? "")
  ) {
    return error(
      "invalid_request",
      "The quote request contains invalid or unsupported fields.",
      400,
    );
  }
  const input = parsed.data;
  try {
    const { data, error: dbError } = await database.rpc("create_booking_quote", {
      p_trip_type: input.tripType,
      p_package_tier: input.packageTier,
      p_origin_location_id: input.originLocationId,
      p_destination_city_id: input.destinationCityId ?? null,
      p_destination_location_id: input.destinationLocationId ?? null,
      p_pickup_at: input.pickupAt,
      p_vehicle_category_id: input.vehicleCategoryId,
      p_passenger_count: input.passengerCount,
      p_trip_days: input.tripDays,
      p_estimated_distance_km: input.estimatedDistanceKm ?? null,
      p_estimated_duration_hours: input.estimatedDurationHours ?? null,
    });
    if (dbError) throw dbError;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) return await databaseFailure(new Error("Quote RPC returned no result"), "quote");
    if (result.result_status !== "CREATED") {
      const responses: Record<string, { code: ApiErrorCode; message: string; status: number }> = {
        INVALID_REQUEST: {
          code: "invalid_request",
          message: "The quote request is invalid.",
          status: 400,
        },
        INVALID_LOCATION: {
          code: "invalid_location",
          message: "A selected location is unavailable.",
          status: 404,
        },
        VEHICLE_UNAVAILABLE: {
          code: "vehicle_unavailable",
          message: "That vehicle category is unavailable for this city and date.",
          status: 409,
        },
        ONLINE_PRICING_UNAVAILABLE: {
          code: "online_pricing_unavailable",
          message: "Online pricing is unavailable for this trip.",
          status: 422,
        },
        DISTANCE_REQUIRED: {
          code: "invalid_request",
          message: "Estimated distance is required for this rate.",
          status: 400,
        },
        DURATION_REQUIRED: {
          code: "invalid_request",
          message: "Estimated duration is required for this rate.",
          status: 400,
        },
      };
      const mapped = responses[result.result_status] ?? {
        code: "internal_server_error",
        message: "The request could not be completed.",
        status: 500,
      };
      return error(mapped.code, mapped.message, mapped.status);
    }
    const { data: quote, error: quoteError } = await database
      .from("quotes")
      .select("created_at,expires_at")
      .eq("id", result.quote_id)
      .maybeSingle();
    if (quoteError || !quote) throw quoteError ?? new Error("Quote could not be retrieved");
    return json(
      {
        quoteId: result.quote_id,
        createdAt: quote.created_at,
        expiresAt: quote.expires_at,
        pricing: result.pricing,
      },
      201,
    );
  } catch (cause) {
    return await databaseFailure(cause, "quote");
  }
}

export async function handleCreateBooking(
  request: Request,
  database: BookingDatabase,
): Promise<Response> {
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 255) {
    return error("invalid_request", "A valid Idempotency-Key header is required.", 400);
  }
  let body: unknown;
  try {
    body = await readJson(request);
  } catch {
    return error("invalid_request", "Request body must be valid JSON under 12 KB.", 400);
  }
  const parsed = BookingRequestSchema.safeParse(body);
  if (!parsed.success)
    return error(
      "invalid_request",
      "Booking details are invalid or contain unsupported fields.",
      400,
    );
  const input = parsed.data;
  const hashBytes = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(input)),
  );
  const requestHash = [...new Uint8Array(hashBytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  try {
    const { data, error: dbError } = await database.rpc("create_booking_from_quote", {
      p_quote_id: input.quoteId,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
      p_full_name: input.customer.fullName,
      p_email: input.customer.email,
      p_phone: input.customer.phone,
      p_country_code: input.customer.countryCode ?? null,
      p_company_name: input.customer.companyName ?? null,
      p_special_instructions: input.specialInstructions ?? null,
    });
    if (dbError) throw dbError;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result)
      return await databaseFailure(new Error("Booking RPC returned no result"), "booking");
    if (result.result_status === "CREATED" || result.result_status === "REPLAYED") {
      const booking = result.booking as Record<string, unknown>;
      const keySecret = runtimeEnvironment()["RAZORPAY_KEY_SECRET"];
      const paymentAccessToken =
        keySecret && typeof booking?.["id"] === "string"
          ? createBookingPaymentToken(booking["id"], keySecret)
          : undefined;
      return json(
        {
          booking: paymentAccessToken ? { ...booking, paymentAccessToken } : booking,
          replayed: result.result_status === "REPLAYED",
        },
        result.result_status === "CREATED" ? 201 : 200,
      );
    }
    const responses: Record<string, { code: ApiErrorCode; message: string; status: number }> = {
      INVALID_REQUEST: {
        code: "invalid_request",
        message: "Booking details are invalid.",
        status: 400,
      },
      QUOTE_EXPIRED: {
        code: "quote_expired",
        message: "This quote has expired. Request a new quote.",
        status: 409,
      },
      QUOTE_ALREADY_CLAIMED: {
        code: "quote_already_claimed",
        message: "This quote can no longer be used.",
        status: 409,
      },
      QUOTE_NOT_FOUND: {
        code: "quote_not_found",
        message: "The selected quote was not found.",
        status: 404,
      },
      IDEMPOTENCY_CONFLICT: {
        code: "idempotency_conflict",
        message: "This Idempotency-Key was already used for a different request.",
        status: 409,
      },
      IN_PROGRESS: {
        code: "internal_server_error",
        message: "The request could not be completed. Retry with the same Idempotency-Key.",
        status: 503,
      },
    };
    const mapped = responses[result.result_status] ?? {
      code: "internal_server_error",
      message: "The request could not be completed.",
      status: 500,
    };
    return error(mapped.code, mapped.message, mapped.status);
  } catch (cause) {
    return await databaseFailure(cause, "booking");
  }
}

export function createServerDatabaseForRequest(): BookingDatabase {
  let database: BookingDatabase | undefined;
  return new Proxy({} as BookingDatabase, {
    get(_target, property) {
      database ??= createBookingDatabase(runtimeEnvironment());
      const value: unknown = Reflect.get(database, property, database);
      return typeof value === "function" ? value.bind(database) : value;
    },
  });
}
