"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

const modules = [
  "AIS",
  "Weather",
  "Alarm",
  "PDF Report",
  "Owner Itinerary",
  "Marina Booking",
  "Charter",
  "Engineer Work Order",
  "Inventory",
  "QR Stock",
  "Offline Sync",
  "Photo Defect",
  "Captain Signature",
  "Maintenance Calendar",
  "Service Prediction",
  "Voyage Risk",
  "Fuel Analytics",
  "Crew Payroll",
  "Expense Approval",
  "Multilingual",
];

export default function BlueDeckOSV2Page() {
  const params = useParams();
  const yachtId = String(params?.id || "");

  const [events, setEvents] = useState<any[]>([]);
  const [module, setModule] = useState("AIS");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [status, setStatus] = useState("open");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [location, setLocation] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  async function loadEvents() {
    const { data, error } = await supabase
      .from("bluedeck_events")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setEvents(data || []);
  }

  useEffect(() => {
    if (yachtId) loadEvents();
  }, [yachtId]);

  async function addEvent() {
    if (!title) {
      alert("Title required");
      return;
    }

    const { error } = await supabase.from("bluedeck_events").insert({
      yacht_id: yachtId,
      module,
      title,
      description,
      priority,
      status,
      amount: Number(amount || 0),
      quantity: Number(quantity || 0),
      location,
      assigned_to: assignedTo,
      metadata: {
        created_from: "BlueDeck OS v2",
        mode: "enterprise",
      },
    });

    if (error) {
      alert(error.message);
      return;
    }

    setTitle("");
    setDescription("");
    setAmount("");
    setQuantity("");
    setLocation("");
    setAssignedTo("");

    loadEvents();
  }

  async function updateStatus(id: string, nextStatus: string) {
    await supabase.from("bluedeck_events").update({ status: nextStatus }).eq("id", id);
    loadEvents();
  }

  async function deleteEvent(id: string) {
    if (!confirm("Delete item?")) return;
    await supabase.from("bluedeck_events").delete().eq("id", id);
    loadEvents();
  }

  function printOSReport() {
    window.print();
  }

  const stats = useMemo(() => {
    const open = events.filter((e) => e.status === "open").length;
    const critical = events.filter((e) => e.priority === "critical").length;
    const cost = events.reduce((s, e) => s + Number(e.amount || 0), 0);
    const inventory = events
      .filter((e) => e.module === "Inventory" || e.module === "QR Stock")
      .reduce((s, e) => s + Number(e.quantity || 0), 0);

    return { open, critical, cost, inventory };
  }, [events]);

  const grouped = modules.map((m) => ({
    module: m,
    items: events.filter((e) => e.module === m),
  }));

  return (
    <main className="min-h-screen bg-[#020817] p-6 pb-28 text-white">
      <div className="mx-auto max-w-7xl">
        <Link href={`/yachts/${yachtId}`} className="text-cyan-300">
          ← Back to yacht
        </Link>

        <div className="mt-6 rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-500/20 to-cyan-500/10 p-10">
          <p className="text-cyan-300">BlueDeck OS v2</p>
          <h1 className="mt-4 text-6xl font-black">Enterprise Yacht Operating System</h1>
          <p className="mt-4 max-w-4xl text-xl text-gray-300">
            AIS, weather, alerts, PDF reports, owner itinerary, marina CRM, charter mode,
            engineer work orders, inventory, defect reports, payroll, approvals and voyage risk.
          </p>

          <button
            onClick={printOSReport}
            className="mt-6 rounded-2xl bg-cyan-400 px-6 py-4 font-bold text-black"
          >
            Print / Export Full OS Report
          </button>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-4">
          <Stat title="Total Items" value={events.length} />
          <Stat title="Open" value={stats.open} />
          <Stat title="Critical" value={stats.critical} danger />
          <Stat title="Recorded Cost" value={`€${stats.cost.toFixed(0)}`} />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[430px_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-3xl font-bold">Create OS Item</h2>

            <div className="mt-6 space-y-4">
              <select
                value={module}
                onChange={(e) => setModule(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              >
                {modules.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>

              <input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              />

              <textarea
                placeholder="Description / notes"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-32 w-full rounded-2xl bg-white/10 p-4 outline-none"
              />

              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              >
                <option>normal</option>
                <option>warning</option>
                <option>critical</option>
              </select>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              >
                <option>open</option>
                <option>planned</option>
                <option>active</option>
                <option>approved</option>
                <option>completed</option>
              </select>

              <input
                placeholder="Amount / cost"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              />

              <input
                placeholder="Quantity / stock"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              />

              <input
                placeholder="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              />

              <input
                placeholder="Assigned to"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              />

              <button
                onClick={addEvent}
                className="w-full rounded-2xl bg-purple-400 py-4 text-xl font-bold text-black"
              >
                Add to BlueDeck OS
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-8">
              <h2 className="text-3xl font-bold">AI Yacht Overview</h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Insight
                  title="Voyage Risk"
                  text={
                    stats.critical > 0
                      ? "Critical items detected. Review before departure."
                      : "No critical voyage risk detected."
                  }
                  danger={stats.critical > 0}
                />

                <Insight
                  title="Inventory Brain"
                  text={`Tracked stock quantity: ${stats.inventory}.`}
                />

                <Insight
                  title="Expense Approval"
                  text={`Recorded operational amount: €${stats.cost.toFixed(0)}.`}
                />

                <Insight
                  title="Offline Mode"
                  text="This local dashboard can continue as a manual offline logbook pattern."
                />
              </div>
            </div>

            {grouped.map((group) => (
              <div
                key={group.module}
                className="rounded-3xl border border-white/10 bg-white/5 p-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-bold">{group.module}</h2>
                  <span className="rounded-full bg-black/30 px-4 py-2 text-sm">
                    {group.items.length}
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-2xl border p-5 ${
                        item.priority === "critical"
                          ? "border-red-500/30 bg-red-500/10"
                          : item.priority === "warning"
                          ? "border-yellow-500/30 bg-yellow-500/10"
                          : "border-white/10 bg-black/20"
                      }`}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm uppercase text-cyan-300">
                            {item.status} · {item.priority}
                          </p>

                          <h3 className="mt-2 text-2xl font-bold">{item.title}</h3>

                          {item.description && (
                            <p className="mt-3 whitespace-pre-wrap text-gray-300">
                              {item.description}
                            </p>
                          )}

                          <div className="mt-4 flex flex-wrap gap-2 text-sm text-gray-300">
                            {item.location && <Tag text={item.location} />}
                            {item.assigned_to && <Tag text={`Assigned: ${item.assigned_to}`} />}
                            {Number(item.amount || 0) > 0 && <Tag text={`€${item.amount}`} />}
                            {Number(item.quantity || 0) > 0 && <Tag text={`Qty ${item.quantity}`} />}
                          </div>

                          <p className="mt-4 text-xs text-gray-500">
                            {new Date(item.created_at).toLocaleString()}
                          </p>
                        </div>

                        <div className="flex min-w-[150px] flex-col gap-2">
                          <button
                            onClick={() => updateStatus(item.id, "approved")}
                            className="rounded-xl bg-green-400 px-4 py-2 font-bold text-black"
                          >
                            Approve
                          </button>

                          <button
                            onClick={() => updateStatus(item.id, "completed")}
                            className="rounded-xl bg-cyan-400 px-4 py-2 font-bold text-black"
                          >
                            Complete
                          </button>

                          <button
                            onClick={() => deleteEvent(item.id)}
                            className="rounded-xl border border-red-500/30 px-4 py-2 text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {group.items.length === 0 && (
                    <div className="rounded-2xl border border-white/10 p-5 text-gray-500">
                      No items.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ title, value, danger = false }: any) {
  return (
    <div
      className={`rounded-3xl border p-6 ${
        danger ? "border-red-500/30 bg-red-500/10" : "border-white/10 bg-white/5"
      }`}
    >
      <p className="text-gray-400">{title}</p>
      <h2 className="mt-4 text-4xl font-black">{value}</h2>
    </div>
  );
}

function Insight({ title, text, danger = false }: any) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        danger ? "border-red-500/30 bg-red-500/10" : "border-white/10 bg-black/20"
      }`}
    >
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="mt-2 text-gray-300">{text}</p>
    </div>
  );
}

function Tag({ text }: any) {
  return <span className="rounded-full bg-black/30 px-3 py-1">{text}</span>;
}