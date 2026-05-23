"use client";

import { Wallet, Fuel, Ship, Plus } from "lucide-react";

const expenses = [
  { title: "Fuel", amount: "€4,850", category: "Fuel" },
  { title: "Marina Fee", amount: "€1,200", category: "Marina" },
  { title: "Provisioning", amount: "€780", category: "Supplies" },
  { title: "Engineering Parts", amount: "€560", category: "Maintenance" },
];

export default function FinancePage() {
  return (
    <main className="min-h-screen bg-[#020817] p-8 pb-28 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 rounded-[40px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-900/10 p-10">
          <p className="text-cyan-300">BlueDeck FinanceOS</p>
          <h1 className="mt-3 text-6xl font-black">Finance Center</h1>
          <p className="mt-5 max-w-3xl text-xl text-gray-400">
            Yacht expenses, fuel costs, marina payments and operational finance overview.
          </p>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-4">
          <Stat title="Monthly Spend" value="€7,390" />
          <Stat title="Fuel Cost" value="€4,850" />
          <Stat title="Marina" value="€1,200" />
          <Stat title="Budget Status" value="Good" />
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="rounded-[36px] border border-white/10 bg-white/5 p-8 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-300">Expenses</p>
                <h2 className="mt-2 text-4xl font-black">Recent Items</h2>
              </div>

              <button className="flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-4 font-black text-black">
                <Plus /> Add
              </button>
            </div>

            <div className="mt-10 space-y-5">
              {expenses.map((item) => (
                <div key={item.title} className="rounded-3xl border border-white/10 bg-black/20 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold">{item.title}</h3>
                      <p className="mt-2 text-gray-400">{item.category}</p>
                    </div>
                    <p className="text-3xl font-black text-cyan-300">{item.amount}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <Box icon={<Wallet />} title="Cash Flow" value="Healthy" />
            <Box icon={<Fuel />} title="Fuel Efficiency" value="Normal" />
            <Box icon={<Ship />} title="Trip Cost" value="€2,450" />
          </div>
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

function Box({ icon, title, value }: any) {
  return (
    <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
      <div className="text-cyan-300">{icon}</div>
      <p className="mt-5 text-gray-400">{title}</p>
      <h3 className="mt-3 text-3xl font-black">{value}</h3>
    </div>
  );
}