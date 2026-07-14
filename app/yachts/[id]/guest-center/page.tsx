"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function GuestCenterPage() {
  const yachtId = usePathname().split("/")[2];

  const [requests, setRequests] = useState<any[]>([]);

  const [guestName, setGuestName] = useState("");
  const [requestType, setRequestType] = useState("Food");
  const [requestNote, setRequestNote] = useState("");
  const [priority, setPriority] = useState("normal");

  async function fetchRequests() {
    const { data } = await supabase
      .from("guest_requests")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    setRequests(data || []);
  }

  useEffect(() => {
    if (yachtId) fetchRequests();
  }, [yachtId]);

  async function addRequest() {
    const { error } = await supabase
      .from("guest_requests")
      .insert({
        yacht_id: yachtId,
        guest_name: guestName,
        request_type: requestType,
        request_note: requestNote,
        priority,
      });

    if (error) {
      alert(error.message);
      return;
    }

    setGuestName("");
    setRequestType("Food");
    setRequestNote("");
    setPriority("normal");

    fetchRequests();
  }

  async function resolveRequest(id: string) {
    await supabase
      .from("guest_requests")
      .update({ status: "resolved" })
      .eq("id", id);

    fetchRequests();
  }

  return (
    <main className="bd-app-page min-h-screen bg-[#020817] p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <a href={`/yachts/${yachtId}`} className="text-blue-300">
          ← Back to yacht
        </a>

        <div className="bd-page-hero mt-6 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-pink-500/10 p-10">
          <p className="text-xl text-gray-400">
            BlueDeck VIP Operations
          </p>

          <h1 className="mt-4 text-6xl font-black">
            Guest Experience Center
          </h1>

          <p className="mt-4 max-w-3xl text-xl text-gray-400">
            Manage guest requests, VIP operations and onboard hospitality.
          </p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="bd-app-card rounded-3xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-3xl font-bold">
              Add Guest Request
            </h2>

            <div className="mt-6 space-y-4">
              <input
                placeholder="Guest name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              />

              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              >
                <option>Food</option>
                <option>Drink</option>
                <option>Jetski</option>
                <option>Tender</option>
                <option>Cleaning</option>
                <option>VIP Setup</option>
                <option>Transport</option>
              </select>

              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              >
                <option>normal</option>
                <option>high</option>
                <option>critical</option>
              </select>

              <textarea
                placeholder="Guest request details"
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                className="h-40 w-full rounded-2xl bg-white/10 p-4 outline-none"
              />

              <button
                onClick={addRequest}
                className="bd-primary-action w-full rounded-2xl bg-pink-400 py-4 font-bold text-black"
              >
                Add Guest Request
              </button>
            </div>
          </div>

          <div className="space-y-6 lg:col-span-2">
            {requests.map((request) => (
              <div
                key={request.id}
                className={`rounded-3xl border p-6 ${
                  request.priority === "critical"
                    ? "border-red-500/30 bg-red-500/10"
                    : request.priority === "high"
                    ? "border-yellow-500/30 bg-yellow-500/10"
                    : "bd-app-card border-white/10 bg-white/5"
                }`}
              >
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="bd-brand-label text-sm uppercase text-pink-300">
                      {request.request_type}
                    </p>

                    <h2 className="mt-2 text-3xl font-bold">
                      {request.guest_name || "Guest"}
                    </h2>

                    <p className="mt-4 text-lg">
                      {request.request_note}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-3 text-sm">
                      <span className="rounded-full bg-white/10 px-3 py-1">
                        {request.priority}
                      </span>

                      <span className="rounded-full bg-white/10 px-3 py-1">
                        {request.status}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => resolveRequest(request.id)}
                    className="rounded-2xl bg-green-400 px-5 py-3 font-bold text-black"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))}

            {requests.length === 0 && (
              <div className="bd-app-card rounded-3xl border border-white/10 bg-white/5 p-8 text-gray-400">
                No guest requests yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
