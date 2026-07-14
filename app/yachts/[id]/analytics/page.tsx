"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function AnalyticsPage() {
  const pathname = usePathname();
  const yachtId = pathname.split("/")[2];

  const [engineLogs, setEngineLogs] = useState<any[]>([]);
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  const [engineName, setEngineName] = useState("Main Engine");
  const [engineHours, setEngineHours] = useState("");
  const [oilPressure, setOilPressure] = useState("");
  const [coolantTemp, setCoolantTemp] = useState("");
  const [voltage, setVoltage] = useState("");
  const [notes, setNotes] = useState("");

  async function fetchData() {
    const { data: engineData } = await supabase
      .from("engine_logs")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    const { data: fuelData } = await supabase
      .from("fuel_logs")
      .select("*")
      .eq("yacht_id", yachtId);

    const { data: expenseData } = await supabase
      .from("yacht_expenses")
      .select("*")
      .eq("yacht_id", yachtId);

    const { data: checklistData } = await supabase
      .from("yacht_checklists")
      .select(`
        id,
        title,
        status,
        yacht_checklist_items (
          id,
          completed
        )
      `)
      .eq("yacht_id", yachtId);

    setEngineLogs(engineData || []);
    setFuelLogs(fuelData || []);
    setExpenses(expenseData || []);
    setTasks(
      (checklistData || []).flatMap((checklist: any) =>
        (checklist.yacht_checklist_items || []).map((item: any) => ({
          ...item,
          status: item.completed ? "completed" : "pending",
        }))
      )
    );
  }

  useEffect(() => {
    if (yachtId) fetchData();
  }, [yachtId]);

  async function addEngineLog() {
    const { error } = await supabase
      .from("engine_logs")
      .insert({
        yacht_id: yachtId,
        engine_name: engineName,
        engine_hours: Number(engineHours || 0),
        oil_pressure: Number(oilPressure || 0),
        coolant_temp: Number(coolantTemp || 0),
        voltage: Number(voltage || 0),
        notes,
      });

    if (error) {
      alert(error.message);
      return;
    }

    setEngineHours("");
    setOilPressure("");
    setCoolantTemp("");
    setVoltage("");
    setNotes("");

    fetchData();
  }

  const totalFuelCost = fuelLogs.reduce(
    (sum, log) => sum + Number(log.total_cost || 0),
    0
  );

  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );

  const completedTasks = tasks.filter(
    (task) => task.status === "completed"
  ).length;

  const pendingTasks = tasks.filter(
    (task) => task.status === "pending"
  ).length;

  const latestHours =
    engineLogs.length > 0
      ? engineLogs[0].engine_hours
      : 0;

  return (
    <main className="bd-app-page min-h-screen bg-[#020817] p-6 pb-28 text-white">
      <div className="mx-auto max-w-7xl">

        <a
          href={`/yachts/${yachtId}`}
          className="text-blue-300"
        >
          ← Back to yacht
        </a>

        <div className="bd-page-hero mt-6 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-cyan-500/10 p-10">
          <p className="text-xl text-gray-400">
            BlueDeck Analytics
          </p>

          <h1 className="mt-4 text-6xl font-black">
            Vessel Analytics
          </h1>

          <p className="mt-4 max-w-2xl text-xl text-gray-400">
            Engine tracking, fuel analytics, operational
            expenses and yacht performance overview.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-5">

          <Stat
            title="Engine Hours"
            value={latestHours}
          />

          <Stat
            title="Fuel Cost"
            value={`€${totalFuelCost.toFixed(0)}`}
          />

          <Stat
            title="Expenses"
            value={`€${totalExpenses.toFixed(0)}`}
          />

          <Stat
            title="Completed"
            value={completedTasks}
          />

          <Stat
            title="Pending"
            value={pendingTasks}
            danger
          />

        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-3">

          <div className="bd-app-card rounded-3xl border border-white/10 bg-white/5 p-8">

            <h2 className="text-3xl font-bold">
              Engine Log
            </h2>

            <div className="mt-6 space-y-4">

              <select
                value={engineName}
                onChange={(e) =>
                  setEngineName(e.target.value)
                }
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              >
                <option>Main Engine</option>
                <option>Port Engine</option>
                <option>Starboard Engine</option>
                <option>Generator</option>
              </select>

              <input
                placeholder="Engine hours"
                value={engineHours}
                onChange={(e) =>
                  setEngineHours(e.target.value)
                }
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              />

              <input
                placeholder="Oil pressure"
                value={oilPressure}
                onChange={(e) =>
                  setOilPressure(e.target.value)
                }
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              />

              <input
                placeholder="Coolant temp"
                value={coolantTemp}
                onChange={(e) =>
                  setCoolantTemp(e.target.value)
                }
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              />

              <input
                placeholder="Voltage"
                value={voltage}
                onChange={(e) =>
                  setVoltage(e.target.value)
                }
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              />

              <textarea
                placeholder="Notes"
                value={notes}
                onChange={(e) =>
                  setNotes(e.target.value)
                }
                className="h-32 w-full rounded-2xl bg-white/10 p-4 outline-none"
              />

              <button
                onClick={addEngineLog}
                className="w-full rounded-2xl bg-cyan-400 py-4 font-bold text-black"
              >
                Add Engine Log
              </button>

            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">

            <div className="bd-app-card rounded-3xl border border-white/10 bg-white/5 p-8">

              <div className="flex items-center justify-between">

                <div>
                  <p className="text-gray-400">
                    Latest Engine Hours
                  </p>

                  <h2 className="mt-3 text-6xl font-black">
                    {latestHours}
                  </h2>
                </div>

                <div className="rounded-3xl bg-cyan-500/10 p-6">
                  <p className="text-gray-400">
                    Operational Status
                  </p>

                  <h3 className="mt-3 text-3xl font-bold text-cyan-300">
                    Active
                  </h3>
                </div>

              </div>
            </div>

            <div className="bd-app-card rounded-3xl border border-white/10 bg-white/5 p-8">

              <h2 className="text-3xl font-bold">
                Engine History
              </h2>

              <div className="mt-6 space-y-4">

                {engineLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bd-app-card rounded-2xl border border-white/10 bg-black/20 p-6"
                  >

                    <div className="flex items-start justify-between">

                      <div>
                        <h3 className="text-2xl font-bold">
                          {log.engine_name}
                        </h3>

                        <p className="mt-2 text-gray-400">
                          {log.engine_hours} hours
                        </p>

                        <div className="mt-4 flex flex-wrap gap-3">

                          <div className="rounded-full bg-white/10 px-3 py-1 text-sm">
                            Oil: {log.oil_pressure}
                          </div>

                          <div className="rounded-full bg-white/10 px-3 py-1 text-sm">
                            Temp: {log.coolant_temp}
                          </div>

                          <div className="rounded-full bg-white/10 px-3 py-1 text-sm">
                            Voltage: {log.voltage}
                          </div>

                        </div>

                        {log.notes && (
                          <p className="mt-4 text-gray-400">
                            {log.notes}
                          </p>
                        )}
                      </div>

                      <p className="text-sm text-gray-500">
                        {new Date(
                          log.created_at
                        ).toLocaleDateString()}
                      </p>

                    </div>

                  </div>
                ))}

                {engineLogs.length === 0 && (
                  <div className="rounded-2xl border border-white/10 p-6 text-gray-400">
                    No engine logs yet.
                  </div>
                )}

              </div>
            </div>

          </div>

        </div>
      </div>
    </main>
  );
}

function Stat({
  title,
  value,
  danger = false,
}: any) {
  return (
    <div
      className={`rounded-3xl border p-6 ${
        danger
          ? "border-red-500/20 bg-red-500/10"
          : "bd-app-card border-white/10 bg-white/5"
      }`}
    >
      <p className="text-gray-400">
        {title}
      </p>

      <h2 className="mt-4 text-5xl font-bold">
        {value}
      </h2>
    </div>
  );
}
