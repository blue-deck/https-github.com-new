"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, CheckCircle, Package, Plus } from "lucide-react";
import { supabase } from "../../../lib/supabase";

type InventoryItem = {
  id: string;
  title?: string | null;
  description?: string | null;
  quantity?: number | null;
  location?: string | null;
  priority?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export default function InventoryPage() {
  const params = useParams();
  const yachtId = String(params?.id || "");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [location, setLocation] = useState("");

  async function loadInventory() {
    if (!yachtId) return;

    const { data } = await supabase
      .from("bluedeck_events")
      .select("*")
      .eq("yacht_id", yachtId)
      .in("module", ["Inventory", "QR Stock"])
      .order("created_at", { ascending: false });

    setItems(data || []);
  }

  useEffect(() => {
    loadInventory();
  }, [yachtId]);

  async function addItem() {
    if (!name.trim()) {
      alert("Item name is required.");
      return;
    }

    const { error } = await supabase.from("bluedeck_events").insert({
      yacht_id: yachtId,
      module: "Inventory",
      title: name,
      description: location ? `Stored at ${location}` : "",
      quantity: Number(quantity || 0),
      location,
      priority: Number(quantity || 0) <= 2 ? "warning" : "normal",
      status: "active",
      metadata: { created_from: "InventoryOS" },
    });

    if (error) {
      alert(error.message);
      return;
    }

    setName("");
    setQuantity("");
    setLocation("");
    loadInventory();
  }

  const stats = useMemo(() => {
    const low = items.filter((item) => Number(item.quantity || 0) <= 2).length;
    const critical = items.filter((item) => item.priority === "critical").length;
    return { low, critical };
  }, [items]);

  return (
    <main className="bd-app-page min-h-screen bg-[#020817] p-8 pb-28 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="bd-page-hero mb-12 rounded-[40px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-900/10 p-10">
          <p className="text-cyan-300">BlueDeck InventoryOS</p>
          <h1 className="mt-3 text-6xl font-black">Inventory & Provisioning</h1>
          <p className="mt-5 max-w-3xl text-xl text-gray-400">
            Real spare parts, technical supplies, provisioning and stock readiness.
          </p>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-4">
          <Stat title="Items" value={String(items.length)} />
          <Stat title="Low Stock" value={String(stats.low)} />
          <Stat title="Critical" value={String(stats.critical)} />
          <Stat title="Status" value={stats.critical ? "Action" : "Ready"} />
        </div>

        <div className="bd-app-card mb-8 rounded-[32px] border border-white/10 bg-white/5 p-6">
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.5fr)_minmax(0,1fr)_auto]">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" className="rounded-2xl bg-white/10 p-4 text-white outline-none placeholder:text-white/45" />
            <input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Qty" inputMode="numeric" className="rounded-2xl bg-white/10 p-4 text-white outline-none placeholder:text-white/45" />
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="rounded-2xl bg-white/10 p-4 text-white outline-none placeholder:text-white/45" />
            <button onClick={addItem} className="flex items-center justify-center gap-3 rounded-2xl bg-cyan-400 px-7 py-4 text-lg font-black text-black">
              <Plus /> Add
            </button>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {items.map((item) => {
            const low = Number(item.quantity || 0) <= 2;

            return (
              <div key={item.id} className="bd-app-card rounded-[36px] border border-white/10 bg-white/5 p-8">
                <div className="flex items-start justify-between">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-400 text-black">
                    <Package className="h-8 w-8" />
                  </div>

                  <div className={`rounded-full px-4 py-2 text-sm ${
                    low ? "bg-yellow-500/20 text-yellow-300" : "bg-green-500/20 text-green-300"
                  }`}>
                    {low ? "Low" : "Good"}
                  </div>
                </div>

                <h2 className="mt-8 text-4xl font-black">{item.title || "Inventory Item"}</h2>
                <p className="mt-3 text-gray-400">{item.location || item.description || "No location set"}</p>

                <div className="bd-app-card mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-gray-400">Stock</p>
                  <h3 className="mt-3 text-3xl font-black text-cyan-300">{Number(item.quantity || 0)}</h3>
                </div>

                <div className="mt-6 flex items-center gap-3 text-gray-300">
                  {low ? <AlertTriangle className="text-yellow-300" /> : <CheckCircle className="text-green-300" />}
                  Stock monitoring active
                </div>
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="bd-app-card rounded-[36px] border border-white/10 bg-white/5 p-8 text-gray-400">
              No inventory items recorded yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="bd-app-card rounded-[30px] border border-white/10 bg-white/5 p-6">
      <p className="text-gray-400">{title}</p>
      <h2 className="mt-4 text-3xl font-black">{value}</h2>
    </div>
  );
}
