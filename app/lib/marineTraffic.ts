export type MaritimeProvider = "MarineTraffic" | "Datalastic" | "VesselFinder";

export type MarineTrafficVessel = {
  mmsi: string;
  imo?: string | null;
  shipId?: string | null;
  shipName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  speedKnots?: number | null;
  heading?: number | null;
  course?: number | null;
  status?: string | null;
  timestamp?: string | null;
  destination?: string | null;
  eta?: string | null;
  etaCalculated?: string | null;
  currentPort?: string | null;
  lastPort?: string | null;
  nextPort?: string | null;
  flag?: string | null;
  typeName?: string | null;
  provider?: MaritimeProvider;
  raw: Record<string, unknown>;
};

export type MarineTrafficVoyage = {
  title: string;
  departurePort: string;
  arrivalPort: string;
  eta: string;
  etaCalculated: string;
  status: string;
  source: MaritimeProvider;
};

export function normalizeMmsi(value: unknown) {
  const clean = String(value || "").replace(/\D/g, "");
  return /^\d{9}$/.test(clean) ? clean : "";
}

export async function fetchMarineTrafficVessel(mmsi: string) {
  return fetchMaritimeVessel(mmsi);
}

export async function fetchMaritimeVessel(mmsi: string) {
  const cleanMmsi = normalizeMmsi(mmsi);

  if (!cleanMmsi) {
    return {
      ok: false as const,
      status: 400,
      error: "A valid 9-digit MMSI is required.",
      configured: true,
    };
  }

  const providers = configuredProviders();

  if (!providers.length) {
    return {
      ok: false as const,
      status: 503,
      error:
        "No maritime AIS provider API key is configured. Set DATALASTIC_API_KEY, VESSELFINDER_API_KEY or MARINETRAFFIC_API_KEY.",
      configured: false,
    };
  }

  const errors: string[] = [];

  for (const provider of providers) {
    const result = await fetchProviderVessel(provider, cleanMmsi);
    if (result.ok) return result;
    errors.push(`${provider.name}: ${result.error}`);
  }

  return {
    ok: false as const,
    status: 502,
    error: errors.join(" | ") || "Maritime AIS provider request failed.",
    configured: true,
  };
}

export function maritimeVoyageFromVessel(vessel: MarineTrafficVessel): MarineTrafficVoyage {
  return marineTrafficVoyageFromVessel(vessel);
}

async function fetchProviderVessel(provider: ProviderConfig, cleanMmsi: string) {
  const requestUrl = buildProviderUrl(provider, cleanMmsi);
  const response = await fetch(requestUrl, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      "user-agent": "BlueDeck YachtOS/1.0",
    },
  });

  const responseText = await response.text();

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      error: responseText || `${provider.name} returned HTTP ${response.status}.`,
      configured: true,
    };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(responseText);
  } catch {
    return {
      ok: false as const,
      status: 502,
      error: `${provider.name} returned a non-JSON response.`,
      configured: true,
    };
  }

  const row = firstPayloadRow(payload, provider.name);
  if (!row) {
    return {
      ok: false as const,
      status: 404,
      error: `${provider.name} returned no AIS record for this MMSI.`,
      configured: true,
    };
  }

  return {
    ok: true as const,
    configured: true,
    provider: provider.name,
    vessel: mapMaritimeVessel(row, cleanMmsi, provider.name),
  };
}

export function marineTrafficVoyageFromVessel(vessel: MarineTrafficVessel): MarineTrafficVoyage {
  const departurePort = vessel.lastPort || vessel.currentPort || "Current AIS position";
  const arrivalPort = vessel.destination || vessel.nextPort || "Destination not broadcast";
  const eta = vessel.eta || vessel.etaCalculated || "ETA not broadcast";

  return {
    title: `${departurePort} → ${arrivalPort}`,
    departurePort,
    arrivalPort,
    eta,
    etaCalculated: vessel.etaCalculated || "",
    status: vessel.speedKnots && vessel.speedKnots > 0.5 ? "Active AIS voyage" : "AIS standby",
    source: vessel.provider || "MarineTraffic",
  };
}

type ProviderConfig = {
  name: MaritimeProvider;
  apiKey: string;
};

function configuredProviders(): ProviderConfig[] {
  const requested = (process.env.MARITIME_PROVIDER || "auto").trim().toLowerCase();
  const all = [
    providerConfig("Datalastic", process.env.DATALASTIC_API_KEY),
    providerConfig("VesselFinder", process.env.VESSELFINDER_API_KEY),
    providerConfig("MarineTraffic", process.env.MARINETRAFFIC_API_KEY),
  ].filter((provider): provider is ProviderConfig => Boolean(provider));

  if (!requested || requested === "auto") return all;

  return all.filter((provider) => provider.name.toLowerCase() === requested);
}

function providerConfig(name: MaritimeProvider, apiKey: string | undefined) {
  const cleanKey = apiKey?.trim();
  return cleanKey ? { name, apiKey: cleanKey } : null;
}

function buildProviderUrl(provider: ProviderConfig, mmsi: string) {
  if (provider.name === "Datalastic") return buildDatalasticUrl(provider.apiKey, mmsi);
  if (provider.name === "VesselFinder") return buildVesselFinderUrl(provider.apiKey, mmsi);
  return buildMarineTrafficUrl(provider.apiKey, mmsi);
}

function buildDatalasticUrl(apiKey: string, mmsi: string) {
  const template = process.env.DATALASTIC_VESSEL_URL_TEMPLATE?.trim();

  if (template) {
    return template
      .replaceAll("{apiKey}", encodeURIComponent(apiKey))
      .replaceAll("{mmsi}", encodeURIComponent(mmsi));
  }

  const url = new URL("https://api.datalastic.com/api/v0/vessel_pro");
  url.searchParams.set("api-key", apiKey);
  url.searchParams.set("mmsi", mmsi);
  return url.toString();
}

function buildVesselFinderUrl(apiKey: string, mmsi: string) {
  const template = process.env.VESSELFINDER_VESSELS_URL_TEMPLATE?.trim();

  if (template) {
    return template
      .replaceAll("{apiKey}", encodeURIComponent(apiKey))
      .replaceAll("{mmsi}", encodeURIComponent(mmsi));
  }

  const url = new URL("https://api.vesselfinder.com/vessels");
  url.searchParams.set("userkey", apiKey);
  url.searchParams.set("mmsi", mmsi);
  url.searchParams.set("format", "json");
  url.searchParams.set("extradata", "voyage,master");
  return url.toString();
}

function buildMarineTrafficUrl(apiKey: string, mmsi: string) {
  const template =
    process.env.MARINETRAFFIC_VOYAGE_FORECAST_URL_TEMPLATE?.trim() ||
    process.env.MARINETRAFFIC_EXPORT_VESSEL_URL_TEMPLATE?.trim();

  if (template) {
    return template
      .replaceAll("{apiKey}", encodeURIComponent(apiKey))
      .replaceAll("{mmsi}", encodeURIComponent(mmsi));
  }

  return [
    "https://services.marinetraffic.com/api/voyageforecast",
    encodeURIComponent(apiKey),
    "v:2",
    `mmsi:${encodeURIComponent(mmsi)}`,
    "protocol:jsono",
    "msgtype:extended",
  ].join("/");
}

function firstPayloadRow(payload: unknown, provider?: MaritimeProvider): Record<string, unknown> | null {
  if (Array.isArray(payload)) {
    const first = payload.find((item) => item && typeof item === "object") as Record<string, unknown> | null;
    if (provider === "VesselFinder" && first?.AIS && typeof first.AIS === "object") {
      return {
        ...(first.MASTER && typeof first.MASTER === "object" ? (first.MASTER as Record<string, unknown>) : {}),
        ...(first.VOYAGE && typeof first.VOYAGE === "object" ? (first.VOYAGE as Record<string, unknown>) : {}),
        ...(first.AIS as Record<string, unknown>),
      };
    }
    return first;
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (record.data && typeof record.data === "object") {
      return firstPayloadRow(record.data, provider);
    }
    if (Array.isArray(record.DATA)) {
      return firstPayloadRow(record.DATA, provider);
    }
    if (Array.isArray(record.data)) {
      return firstPayloadRow(record.data, provider);
    }
    return record;
  }

  return null;
}

function mapMaritimeVessel(
  row: Record<string, unknown>,
  fallbackMmsi: string,
  provider: MaritimeProvider,
): MarineTrafficVessel {
  return {
    mmsi: cleanString(readField(row, "MMSI", "mmsi")) || fallbackMmsi,
    imo: cleanString(readField(row, "IMO", "imo")),
    shipId: cleanString(readField(row, "SHIP_ID", "ship_id", "SHIPID", "uuid")),
    shipName: cleanString(readField(row, "SHIPNAME", "SHIP_NAME", "NAME", "shipname", "name", "name_ais")),
    latitude: numberOrNull(readField(row, "LAT", "LATITUDE", "lat", "latitude")),
    longitude: numberOrNull(readField(row, "LON", "LONGITUDE", "lon", "longitude")),
    speedKnots: numberOrNull(readField(row, "SPEED", "speed")),
    heading: numberOrNull(readField(row, "HEADING", "heading")),
    course: numberOrNull(readField(row, "COURSE", "course")),
    status: cleanString(readField(row, "STATUS", "status", "NAVSTAT", "nav_status")),
    timestamp: cleanString(readField(row, "TIMESTAMP", "timestamp", "last_position_UTC")),
    destination: cleanString(
      readField(row, "DESTINATION", "destination", "destination_port", "destination_port_name"),
    ),
    eta: cleanString(readField(row, "ETA", "eta", "ETA_AIS", "eta_UTC")),
    etaCalculated: cleanString(readField(row, "ETA_CALC", "ETA_CALCULATED", "eta_calc", "eta_predicted_UTC")),
    currentPort: cleanString(readField(row, "CURRENT_PORT", "current_port")),
    lastPort: cleanString(
      readField(row, "LAST_PORT", "last_port", "departure_port", "departure_port_name", "PORT_DEPARTURE"),
    ),
    nextPort: cleanString(readField(row, "NEXT_PORT_NAME", "NEXT_PORT", "next_port_name", "destination_port")),
    flag: cleanString(readField(row, "FLAG", "flag", "country_iso", "country")),
    typeName: cleanString(readField(row, "TYPE_NAME", "type_name", "type", "vessel_type", "vessel_type_specific")),
    provider,
    raw: row,
  };
}

function readField(row: Record<string, unknown>, ...names: string[]) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== "") {
      return row[name];
    }
  }
  return null;
}

function cleanString(value: unknown) {
  const clean = String(value || "").trim();
  return clean || null;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
