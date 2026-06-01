import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  fetchMarineTrafficVessel,
  marineTrafficVoyageFromVessel,
  normalizeMmsi,
  type MarineTrafficVessel,
  type MarineTrafficVoyage,
} from "../../../lib/marineTraffic";
import { resolveSupabaseUrl } from "../../../lib/supabaseConfig";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const yachtId = searchParams.get("yachtId") || "";
  const requestedMmsi = normalizeMmsi(searchParams.get("mmsi"));

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  const supabase = createClient(resolveSupabaseUrl(supabaseUrl), supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let yacht: Record<string, unknown> | null = null;

  if (yachtId) {
    const { data } = await supabase
      .from("yachts")
      .select("*")
      .eq("id", yachtId)
      .maybeSingle();

    yacht = data || null;
  }

  const yachtMmsi = normalizeMmsi(
    yacht?.mmsi ||
      yacht?.ais_mmsi ||
      yacht?.marine_traffic_mmsi ||
      yacht?.marinetraffic_mmsi,
  );
  const mmsi = requestedMmsi || yachtMmsi;

  if (!mmsi) {
    return NextResponse.json(
      {
        ok: false,
        configured: Boolean(
          process.env.DATALASTIC_API_KEY ||
            process.env.VESSELFINDER_API_KEY ||
            process.env.MARINETRAFFIC_API_KEY,
        ),
        error: "Add a 9-digit MMSI number to this yacht to enable automatic maritime voyage data.",
        yacht,
      },
      { status: 400 },
    );
  }

  const result = await fetchMarineTrafficVessel(mmsi);

  if (!result.ok) {
    return NextResponse.json(result, { status: result.status });
  }

  const voyage = marineTrafficVoyageFromVessel(result.vessel);

  if (yachtId) {
    await Promise.all([
      savePositionSnapshot(supabase, yachtId, result.vessel),
      saveVoyageSnapshot(supabase, yachtId, voyage, result.vessel),
    ]);
  }

  return NextResponse.json({
    ok: true,
    source: result.provider || result.vessel.provider || voyage.source,
    yachtId: yachtId || null,
    mmsi,
    vessel: result.vessel,
    voyage,
  });
}

async function savePositionSnapshot(
  supabase: SupabaseClient,
  yachtId: string,
  vessel: MarineTrafficVessel,
) {
  if (vessel.latitude === null || vessel.longitude === null) return;

  await supabase.from("yacht_positions").insert({
    yacht_id: yachtId,
    latitude: vessel.latitude,
    longitude: vessel.longitude,
    speed: vessel.speedKnots,
    heading: vessel.heading ?? vessel.course,
    location_name: vessel.currentPort || vessel.destination || "Maritime AIS",
  });
}

async function saveVoyageSnapshot(
  supabase: SupabaseClient,
  yachtId: string,
  voyage: MarineTrafficVoyage,
  vessel: MarineTrafficVessel,
) {
  const latest = await supabase
    .from("voyages")
    .select("id")
    .eq("yacht_id", yachtId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const minimalPayload = {
    yacht_id: yachtId,
    title: voyage.title,
    departure_port: voyage.departurePort,
    arrival_port: voyage.arrivalPort,
    fuel_estimate: 0,
    fuel_remaining: 0,
  };

  const payload = {
    ...minimalPayload,
    source: voyage.source,
    source_mmsi: vessel.mmsi,
    eta: voyage.eta,
    status: voyage.status,
  };

  if (latest.data?.id) {
    const update = await supabase.from("voyages").update(payload).eq("id", latest.data.id);
    if (update.error && /schema cache|column/i.test(update.error.message)) {
      await supabase.from("voyages").update(minimalPayload).eq("id", latest.data.id);
    }
    return;
  }

  const insert = await supabase.from("voyages").insert(payload);
  if (insert.error && /schema cache|column/i.test(insert.error.message)) {
    await supabase.from("voyages").insert(minimalPayload);
  }
}
