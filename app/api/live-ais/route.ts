import { NextResponse } from "next/server";
import { fetchMarineTrafficVessel, normalizeMmsi } from "../../lib/marineTraffic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mmsi = normalizeMmsi(searchParams.get("mmsi"));

    if (!mmsi) {
      return NextResponse.json(
        {
          ok: false,
          source: "Maritime AIS",
          error: "Pass a valid 9-digit MMSI with ?mmsi=... to fetch live AIS from the configured maritime provider.",
          vessels: [],
        },
        { status: 400 },
      );
    }

    const result = await fetchMarineTrafficVessel(mmsi);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          source: "Maritime AIS",
          error: result.error,
          vessels: [],
        },
        { status: result.status },
      );
    }

    return NextResponse.json({
      ok: true,
      source: result.provider || result.vessel.provider || "Maritime AIS",
      vessels: [
        {
          id: result.vessel.mmsi,
          mmsi: result.vessel.mmsi,
          name: result.vessel.shipName || result.vessel.mmsi,
          lat: result.vessel.latitude,
          lon: result.vessel.longitude,
          speed: result.vessel.speedKnots,
          course: result.vessel.course,
          heading: result.vessel.heading,
          type: result.vessel.typeName || "Vessel",
          destination: result.vessel.destination,
          eta: result.vessel.eta || result.vessel.etaCalculated,
          risk: "normal",
        },
      ],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        source: "Maritime AIS",
        error: error instanceof Error ? error.message : "Live AIS request failed.",
        vessels: [],
      },
      { status: 500 },
    );
  }
}
