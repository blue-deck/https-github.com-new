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
  raw: Record<string, unknown>;
};

export type MarineTrafficVoyage = {
  title: string;
  departurePort: string;
  arrivalPort: string;
  eta: string;
  etaCalculated: string;
  status: string;
  source: "MarineTraffic";
};

export function normalizeMmsi(value: unknown) {
  const clean = String(value || "").replace(/\D/g, "");
  return /^\d{9}$/.test(clean) ? clean : "";
}

export async function fetchMarineTrafficVessel(mmsi: string) {
  const apiKey = process.env.MARINETRAFFIC_API_KEY?.trim();
  const cleanMmsi = normalizeMmsi(mmsi);

  if (!apiKey) {
    return {
      ok: false as const,
      status: 503,
      error: "MarineTraffic API key is not configured.",
      configured: false,
    };
  }

  if (!cleanMmsi) {
    return {
      ok: false as const,
      status: 400,
      error: "A valid 9-digit MMSI is required.",
      configured: true,
    };
  }

  const requestUrl = buildMarineTrafficUrl(apiKey, cleanMmsi);
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
      error: responseText || `MarineTraffic returned HTTP ${response.status}.`,
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
      error: "MarineTraffic returned a non-JSON response.",
      configured: true,
    };
  }

  const row = firstPayloadRow(payload);
  if (!row) {
    return {
      ok: false as const,
      status: 404,
      error: "MarineTraffic returned no AIS record for this MMSI.",
      configured: true,
    };
  }

  return {
    ok: true as const,
    configured: true,
    vessel: mapMarineTrafficVessel(row, cleanMmsi),
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
    source: "MarineTraffic",
  };
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

function firstPayloadRow(payload: unknown): Record<string, unknown> | null {
  if (Array.isArray(payload)) {
    return payload.find((item) => item && typeof item === "object") as Record<string, unknown> | null;
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.DATA)) {
      return firstPayloadRow(record.DATA);
    }
    if (Array.isArray(record.data)) {
      return firstPayloadRow(record.data);
    }
    return record;
  }

  return null;
}

function mapMarineTrafficVessel(row: Record<string, unknown>, fallbackMmsi: string): MarineTrafficVessel {
  return {
    mmsi: cleanString(readField(row, "MMSI", "mmsi")) || fallbackMmsi,
    imo: cleanString(readField(row, "IMO", "imo")),
    shipId: cleanString(readField(row, "SHIP_ID", "ship_id", "SHIPID")),
    shipName: cleanString(readField(row, "SHIPNAME", "SHIP_NAME", "NAME", "shipname")),
    latitude: numberOrNull(readField(row, "LAT", "LATITUDE", "lat", "latitude")),
    longitude: numberOrNull(readField(row, "LON", "LONGITUDE", "lon", "longitude")),
    speedKnots: numberOrNull(readField(row, "SPEED", "speed")),
    heading: numberOrNull(readField(row, "HEADING", "heading")),
    course: numberOrNull(readField(row, "COURSE", "course")),
    status: cleanString(readField(row, "STATUS", "status")),
    timestamp: cleanString(readField(row, "TIMESTAMP", "timestamp")),
    destination: cleanString(readField(row, "DESTINATION", "destination")),
    eta: cleanString(readField(row, "ETA", "eta")),
    etaCalculated: cleanString(readField(row, "ETA_CALC", "ETA_CALCULATED", "eta_calc")),
    currentPort: cleanString(readField(row, "CURRENT_PORT", "current_port")),
    lastPort: cleanString(readField(row, "LAST_PORT", "last_port")),
    nextPort: cleanString(readField(row, "NEXT_PORT_NAME", "NEXT_PORT", "next_port_name")),
    flag: cleanString(readField(row, "FLAG", "flag")),
    typeName: cleanString(readField(row, "TYPE_NAME", "type_name")),
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
