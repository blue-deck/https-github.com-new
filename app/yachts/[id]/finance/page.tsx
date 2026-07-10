"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Fuel, Plus, ReceiptText, Wallet } from "lucide-react";
import { supabase } from "../../../lib/supabase";

type FuelLog = {
  id: string;
  fuel_type?: string | null;
  liters?: number | null;
  price_per_liter?: number | null;
  total_cost?: number | null;
  supplier?: string | null;
  location?: string | null;
  log_date?: string | null;
};

type Expense = {
  id: string;
  title?: string | null;
  category?: string | null;
  amount?: number | null;
  currency?: string | null;
  vendor?: string | null;
  expense_date?: string | null;
};

export default function FinancePage() {
  const params = useParams();
  const yachtId = String(params?.id || "");
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Operations");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");

  async function loadFinance() {
    if (!yachtId) return;

    const [{ data: fuelData }, { data: expenseData }] = await Promise.all([
      supabase
        .from("fuel_logs")
        .select("*")
        .eq("yacht_id", yachtId)
        .order("log_date", { ascending: false }),
      supabase
        .from("yacht_expenses")
        .select("*")
        .eq("yacht_id", yachtId)
        .order("expense_date", { ascending: false }),
    ]);

    setFuelLogs(fuelData || []);
    setExpenses(expenseData || []);
  }

  useEffect(() => {
    loadFinance();
  }, [yachtId]);

  async function addExpense() {
    if (!title.trim() || !amount.trim()) {
      alert("Expense title and amount are required.");
      return;
    }

    const { error } = await supabase.from("yacht_expenses").insert({
      yacht_id: yachtId,
      title,
      category,
      amount: Number(amount || 0),
      currency: "EUR",
      expense_date: new Date().toISOString().slice(0, 10),
      vendor,
      notes: "",
    });

    if (error) {
      alert(error.message);
      return;
    }

    setTitle("");
    setAmount("");
    setVendor("");
    loadFinance();
  }

  const stats = useMemo(() => {
    const fuelCost = fuelLogs.reduce((sum, log) => sum + Number(log.total_cost || 0), 0);
    const expenseCost = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const liters = fuelLogs.reduce((sum, log) => sum + Number(log.liters || 0), 0);
    const categories = new Set(expenses.map((item) => item.category || "Operations"));

    return {
      total: fuelCost + expenseCost,
      fuelCost,
      expenseCost,
      liters,
      categories: categories.size,
    };
  }, [expenses, fuelLogs]);

  const recentItems = [
    ...expenses.map((item) => ({
      id: `expense-${item.id}`,
      title: item.title || "Expense",
      detail: `${item.category || "Operations"}${item.vendor ? ` · ${item.vendor}` : ""}`,
      amount: Number(item.amount || 0),
      date: item.expense_date || "",
      type: "Expense",
    })),
    ...fuelLogs.map((item) => ({
      id: `fuel-${item.id}`,
      title: item.fuel_type || "Fuel",
      detail: `${Number(item.liters || 0)} L${item.location ? ` · ${item.location}` : ""}`,
      amount: Number(item.total_cost || 0),
      date: item.log_date || "",
      type: "Fuel",
    })),
  ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

  return (
    <main className="min-h-screen bg-[#020817] p-8 pb-28 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 rounded-[40px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-900/10 p-10">
          <p className="text-cyan-300">BlueDeck FinanceOS</p>
          <h1 className="mt-3 text-6xl font-black">Finance Center</h1>
          <p className="mt-5 max-w-3xl text-xl text-gray-400">
            Real yacht expenses, fuel costs, vendor spend and operational finance overview.
          </p>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-4">
          <Stat title="Total Spend" value={formatMoney(stats.total)} />
          <Stat title="Fuel Cost" value={formatMoney(stats.fuelCost)} />
          <Stat title="Expenses" value={formatMoney(stats.expenseCost)} />
          <Stat title="Fuel Loaded" value={`${stats.liters.toFixed(0)} L`} />
        </div>

        <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,390px)]">
          <div className="rounded-[36px] border border-white/10 bg-white/5 p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-cyan-300">Ledger</p>
                <h2 className="mt-2 text-4xl font-black">Recent Items</h2>
              </div>
              <ReceiptText className="h-10 w-10 text-cyan-300" />
            </div>

            <div className="mt-10 space-y-5">
              {recentItems.map((item) => (
                <div key={item.id} className="rounded-3xl border border-white/10 bg-black/20 p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.16em] text-cyan-300">{item.type}</p>
                      <h3 className="mt-2 text-2xl font-bold">{item.title}</h3>
                      <p className="mt-2 text-gray-400">{item.detail}</p>
                    </div>
                    <p className="text-3xl font-black text-cyan-300">{formatMoney(item.amount)}</p>
                  </div>
                </div>
              ))}

              {recentItems.length === 0 && (
                <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-gray-400">
                  No finance records yet.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
              <div className="text-cyan-300"><Plus /></div>
              <h2 className="mt-5 text-3xl font-black">Add Expense</h2>
              <div className="mt-6 space-y-4">
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Expense title" className="w-full rounded-2xl bg-white/10 p-4 text-white outline-none placeholder:text-white/45" />
                <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className="w-full rounded-2xl bg-white/10 p-4 text-white outline-none placeholder:text-white/45" />
                <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount EUR" inputMode="decimal" className="w-full rounded-2xl bg-white/10 p-4 text-white outline-none placeholder:text-white/45" />
                <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor optional" className="w-full rounded-2xl bg-white/10 p-4 text-white outline-none placeholder:text-white/45" />
                <button onClick={addExpense} className="w-full rounded-2xl bg-cyan-400 px-5 py-4 font-black text-black">
                  Save Expense
                </button>
              </div>
            </div>
            <Box icon={<Wallet />} title="Categories" value={String(stats.categories)} />
            <Box icon={<Fuel />} title="Fuel Entries" value={String(fuelLogs.length)} />
          </div>
        </div>
      </div>
    </main>
  );
}

function formatMoney(value: number) {
  return `€${value.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
      <p className="text-gray-400">{title}</p>
      <h2 className="mt-4 break-words text-3xl font-black">{value}</h2>
    </div>
  );
}

function Box({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
      <div className="text-cyan-300">{icon}</div>
      <p className="mt-5 text-gray-400">{title}</p>
      <h3 className="mt-3 text-3xl font-black">{value}</h3>
    </div>
  );
}
