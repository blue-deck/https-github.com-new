"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function LogbookPage() {
  const yachtId = usePathname().split("/")[2];

  const [logs, setLogs] = useState<any[]>([]);

  const [logType, setLogType] = useState("daily");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [weather, setWeather] = useState("");
  const [seaState, setSeaState] = useState("");
  const [engineHours, setEngineHours] = useState("");
  const [fuelNotes, setFuelNotes] = useState("");
  const [crewNotes, setCrewNotes] = useState("");
  const [guestNotes, setGuestNotes] = useState("");
  const [maintenanceNotes, setMaintenanceNotes] = useState("");
  const [captainNotes, setCaptainNotes] = useState("");

  async function fetchLogs() {
    const { data } = await supabase
      .from("captain_logbook")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    setLogs(data || []);
  }

  useEffect(() => {
    if (yachtId) fetchLogs();
  }, [yachtId]);

  async function createLog() {
    if (!title) {
      alert("Title required");
      return;
    }

    const { error } = await supabase.from("captain_logbook").insert({
      yacht_id: yachtId,
      log_type: logType,
      title,
      location,
      weather,
      sea_state: seaState,
      engine_hours: engineHours,
      fuel_notes: fuelNotes,
      crew_notes: crewNotes,
      guest_notes: guestNotes,
      maintenance_notes: maintenanceNotes,
      captain_notes: captainNotes,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setTitle("");
    setLocation("");
    setWeather("");
    setSeaState("");
    setEngineHours("");
    setFuelNotes("");
    setCrewNotes("");
    setGuestNotes("");
    setMaintenanceNotes("");
    setCaptainNotes("");

    fetchLogs();
  }

  async function deleteLog(id: string) {
    if (!confirm("Delete logbook entry?")) return;
    await supabase.from("captain_logbook").delete().eq("id", id);
    fetchLogs();
  }

  function printLog(log: any) {
    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>Captain Logbook</title>
          <style>
            body { font-family: Arial; padding: 40px; color: #111827; }
            h1 { font-size: 34px; }
            h2 { margin-top: 28px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
            .box { border: 1px solid #ddd; padding: 16px; margin-top: 12px; border-radius: 10px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            .small { color: #6b7280; font-size: 13px; }
          </style>
        </head>
        <body>
          <h1>BlueDeck Captain Logbook</h1>
          <p class="small">Generated: ${new Date().toLocaleString()}</p>

          <h2>${log.title || ""}</h2>

          <div class="grid">
            <div class="box"><b>Date</b><br>${log.log_date || ""}</div>
            <div class="box"><b>Type</b><br>${log.log_type || ""}</div>
            <div class="box"><b>Location</b><br>${log.location || ""}</div>
            <div class="box"><b>Weather</b><br>${log.weather || ""}</div>
            <div class="box"><b>Sea State</b><br>${log.sea_state || ""}</div>
            <div class="box"><b>Engine Hours</b><br>${log.engine_hours || ""}</div>
          </div>

          <h2>Fuel Notes</h2>
          <div class="box">${log.fuel_notes || "-"}</div>

          <h2>Crew Notes</h2>
          <div class="box">${log.crew_notes || "-"}</div>

          <h2>Guest Notes</h2>
          <div class="box">${log.guest_notes || "-"}</div>

          <h2>Maintenance Notes</h2>
          <div class="box">${log.maintenance_notes || "-"}</div>

          <h2>Captain Notes</h2>
          <div class="box">${log.captain_notes || "-"}</div>

          <br><br>
          <p>Captain Signature: ___________________________</p>
        </body>
      </html>
    `);

    win.document.close();
    win.print();
  }

  return (
    <main className="min-h-screen bg-[#020817] p-6 pb-28 text-white">
      <div className="mx-auto max-w-7xl">
        <a href={`/yachts/${yachtId}`} className="text-blue-300">
          ← Back to yacht
        </a>

        <div className="mt-6 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-indigo-500/10 p-10">
          <p className="text-xl text-gray-400">BlueDeck Official Records</p>

          <h1 className="mt-4 text-6xl font-black">Captain Logbook</h1>

          <p className="mt-4 max-w-3xl text-xl text-gray-400">
            Daily captain logs, voyage notes, maintenance notes, guest notes and printable PDF records.
          </p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-3xl font-bold">New Log Entry</h2>

            <div className="mt-6 space-y-4">
              <select
                value={logType}
                onChange={(e) => setLogType(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4"
              >
                <option>daily</option>
                <option>departure</option>
                <option>arrival</option>
                <option>maintenance</option>
                <option>guest trip</option>
                <option>incident</option>
              </select>

              <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-2xl bg-white/10 p-4" />
              <input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-2xl bg-white/10 p-4" />
              <input placeholder="Weather" value={weather} onChange={(e) => setWeather(e.target.value)} className="w-full rounded-2xl bg-white/10 p-4" />
              <input placeholder="Sea state" value={seaState} onChange={(e) => setSeaState(e.target.value)} className="w-full rounded-2xl bg-white/10 p-4" />
              <input placeholder="Engine hours summary" value={engineHours} onChange={(e) => setEngineHours(e.target.value)} className="w-full rounded-2xl bg-white/10 p-4" />

              <textarea placeholder="Fuel notes" value={fuelNotes} onChange={(e) => setFuelNotes(e.target.value)} className="h-24 w-full rounded-2xl bg-white/10 p-4" />
              <textarea placeholder="Crew notes" value={crewNotes} onChange={(e) => setCrewNotes(e.target.value)} className="h-24 w-full rounded-2xl bg-white/10 p-4" />
              <textarea placeholder="Guest notes" value={guestNotes} onChange={(e) => setGuestNotes(e.target.value)} className="h-24 w-full rounded-2xl bg-white/10 p-4" />
              <textarea placeholder="Maintenance notes" value={maintenanceNotes} onChange={(e) => setMaintenanceNotes(e.target.value)} className="h-24 w-full rounded-2xl bg-white/10 p-4" />
              <textarea placeholder="Captain notes" value={captainNotes} onChange={(e) => setCaptainNotes(e.target.value)} className="h-32 w-full rounded-2xl bg-white/10 p-4" />

              <button
                onClick={createLog}
                className="w-full rounded-2xl bg-indigo-400 py-4 font-bold text-black"
              >
                Create Logbook Entry
              </button>
            </div>
          </div>

          <div className="space-y-6 lg:col-span-2">
            {logs.map((log) => (
              <div key={log.id} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm uppercase text-indigo-300">{log.log_type}</p>

                    <h2 className="mt-2 text-3xl font-bold">{log.title}</h2>

                    <div className="mt-4 flex flex-wrap gap-3 text-sm">
                      <span className="rounded-full bg-white/10 px-3 py-1">
                        {log.log_date}
                      </span>

                      <span className="rounded-full bg-white/10 px-3 py-1">
                        {log.location || "No location"}
                      </span>

                      <span className="rounded-full bg-white/10 px-3 py-1">
                        {log.weather || "No weather"}
                      </span>
                    </div>

                    {log.captain_notes && (
                      <div className="mt-5 rounded-2xl bg-black/30 p-4">
                        <p className="text-sm text-gray-400">Captain Notes</p>
                        <p className="mt-2">{log.captain_notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-[160px] flex-col gap-3">
                    <button
                      onClick={() => printLog(log)}
                      className="rounded-xl bg-indigo-400 px-4 py-3 font-bold text-black"
                    >
                      Print / PDF
                    </button>

                    <button
                      onClick={() => deleteLog(log.id)}
                      className="rounded-xl border border-red-500/30 px-4 py-3 text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {logs.length === 0 && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-gray-400">
                No logbook entries yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}