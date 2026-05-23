"use client";

import { Package, AlertTriangle, CheckCircle, Plus } from "lucide-react";

const items = [
  { name: "Oil Filters", stock: "12", status: "Good" },
  { name: "Impellers", stock: "6", status: "Good" },
  { name: "Engine Oil", stock: "80 L", status: "Good" },
  { name: "Watermaker Filters", stock: "2", status: "Low" },
];

export default function InventoryPage() {
  return (
    <main className="min-h-screen bg-[#020817] p-8 pb-28 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 rounded-[40px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-900/10 p-10">
          <p className="text-cyan-300">BlueDeck InventoryOS</p>
          <h1 className="mt-3 text-6xl font-black">Inventory & Provisioning</h1>
          <p className="mt-5 max-w-3xl text-xl text-gray-400">
            Spare parts, technical supplies, provisioning and stock readiness.
          </p>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-4">
          <Stat title="Items" value="4" />
          <Stat title="Low Stock" value="1" />
          <Stat title="Critical" value="0" />
          <Stat title="Status" value="Ready" />
        </div>

        <div className="mb-8 flex justify-end">
          <button className="flex items-center gap-3 rounded-2xl bg-cyan-400 px-7 py-5 text-lg font-black text-black">
            <Plus /> Add Item
          </button>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {items.map((item) => (
            <div key={item.name} className="rounded-[36px] border border-white/10 bg-white/5 p-8">
              <div className="flex items-start justify-between">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-400 text-black">
                  <Package className="h-8 w-8" />
                </div>

                <div className={`rounded-full px-4 py-2 text-sm ${
                  item.status === "Low" ? "bg-yellow-500/20 text-yellow-300" : "bg-green-500/20 text-green-300"
                }`}>
                  {item.status}
                </div>
              </div>

              <h2 className="mt-8 text-4xl font-black">{item.name}</h2>

              <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-gray-400">Stock</p>
                <h3 className="mt-3 text-3xl font-black text-cyan-300">{item.stock}</h3>
              </div>

              <div className="mt-6 flex items-center gap-3 text-gray-300">
                {item.status === "Low" ? <AlertTriangle className="text-yellow-300" /> : <CheckCircle className="text-green-300" />}
                Stock monitoring active
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function Stat({ title, value }: any) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
      <p className="text-gray-400">{title}</p>
      <h2 className="mt-4 text-3xl font-black">{value}</h2>
    </div>
  );
}