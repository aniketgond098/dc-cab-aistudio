import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createBookingPaymentToken } from "@/lib/razorpay";

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
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return error("invalid_request", "Cross-origin requests are not allowed.", 403);
      }
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

export function createBookingDatabase(
  env: Record<string, string | undefined> = runtimeEnvironment(),
): BookingDatabase {
  const url = env["SUPABASE_URL"];
  const key = env["SUPABASE_SECRET_KEY"] ?? env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("Supabase server credentials are not configured");
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
          "city_id,vehicle_category_id,is_available,valid_from,valid_until,vehicle_categories!inner(id,code,name,passenger_capacity,luggage_capacity,display_order)",
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
