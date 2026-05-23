import { NextResponse } from "next/server";

export async function GET() {
  try {
    const vessels = [
      {
        id: "1",
        name: "HELIOPHILIA",
        lat: 37.936654,
        lon: 23.649491,
        speed: 0,
        course: 184,
        type: "Yacht",
        risk: "normal",
      },
      {
        id: "2",
        name: "MSC ATHENA",
        lat: 37.9401,
        lon: 23.645,
        speed: 14,
        course: 90,
        type: "Cargo",
        risk: "low",
      },
      {
        id: "3",
        name: "BLUE STAR",
        lat: 37.932,
        lon: 23.655,
        speed: 18,
        course: 270,
        type: "Passenger",
        risk: "medium",
      },
      {
        id: "4",
        name: "SEA DREAM",
        lat: 37.938,
        lon: 23.652,
        speed: 7,
        course: 120,
        type: "Yacht",
        risk: "low",
      },
    ];

    return NextResponse.json({
      ok: true,
      source: "live-gps-with-simulated-ais",
      vessels,
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e.message,
      vessels: [],
    });
  }
}