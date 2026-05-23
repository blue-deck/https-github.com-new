"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function ChecklistsPage() {
  const pathname = usePathname();
  const yachtId = pathname.split("/")[2];

  const [title, setTitle] = useState("");
  const [type, setType] = useState("Daily");
  const [assignedTo, setAssignedTo] = useState("");
  const [items, setItems] = useState("");
  const [checklists, setChecklists] = useState<any[]>([]);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);

  async function fetchData() {
    const { data: checklistData } = await supabase
      .from("checklists")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    const { data: itemData } = await supabase
      .from("checklist_items")
      .select("*");

    setChecklists(checklistData || []);
    setChecklistItems(itemData || []);
  }

  useEffect(() => {
    if (yachtId) fetchData();
  }, [yachtId]);

  async function createChecklist() {
    if (!title) {
      alert("Enter title");
      return;
    }

    const { data, error } = await supabase
      .from("checklists")
      .insert({
        yacht_id: yachtId,
        title,
        checklist_type: type,
        assigned_to: assignedTo,
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    const splitItems = items
      .split("\n")
      .map((i) => i.trim())
      .filter(Boolean);

    for (const item of splitItems) {
      await supabase.from("checklist_items").insert({
        checklist_id: data.id,
        item,
      });
    }

    setTitle("");
    setAssignedTo("");
    setItems("");

    fetchData();
  }

  async function toggleItem(itemId: string, current: boolean) {
    await supabase
      .from("checklist_items")
      .update({
        completed: !current,
      })
      .eq("id", itemId);

    fetchData();
  }

  async function deleteChecklist(id: string) {
    const ok = confirm("Delete checklist?");
    if (!ok) return;

    await supabase.from("checklists").delete().eq("id", id);

    fetchData();
  }

  return (
    <main className="min-h-screen bg-[#081120] p-10 text-white">
      <div className="mx-auto max-w-7xl">
        <a href={`/yachts/${yachtId}`} className="text-blue-300">
          ← Back to yacht
        </a>

        <div className="mt-6 rounded-3xl bg-white/5 p-8">
          <p className="text-gray-400">BlueDeck Operations</p>

          <h1 className="mt-3 text-5xl font-bold">Checklists</h1>

          <p className="mt-4 text-gray-400">
            Daily, weekly and operational yacht checklists.
          </p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="rounded-3xl bg-white/5 p-8">
            <h2 className="text-3xl font-bold">Create Checklist</h2>

            <div className="mt-6 space-y-4">
              <input
                placeholder="Checklist title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              />

              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              >
                <option>Daily</option>
                <option>Weekly</option>
                <option>Departure</option>
                <option>Arrival</option>
                <option>Safety</option>
                <option>Engine Room</option>
              </select>

              <input
                placeholder="Assigned crew email"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              />

              <textarea
                rows={8}
                placeholder={`One item per line

Check engine oil
Check bilge
Wash deck
Fuel inspection`}
                value={items}
                onChange={(e) => setItems(e.target.value)}
                className="w-full rounded-2xl bg-white/10 p-4 outline-none"
              />

              <button
                onClick={createChecklist}
                className="w-full rounded-2xl bg-blue-400 py-4 font-bold text-black"
              >
                Create Checklist
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {checklists.map((checklist) => {
              const relatedItems = checklistItems.filter(
                (item) => item.checklist_id === checklist.id
              );

              const completedCount = relatedItems.filter(
                (i) => i.completed
              ).length;

              return (
                <div
                  key={checklist.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-2xl font-bold">
                        {checklist.title}
                      </h3>

                      <p className="mt-2 text-gray-400">
                        {checklist.checklist_type}
                      </p>

                      <p className="mt-1 text-gray-500">
                        {checklist.assigned_to}
                      </p>
                    </div>

                    <button
                      onClick={() => deleteChecklist(checklist.id)}
                      className="rounded-xl border border-red-500/30 px-4 py-2 text-red-300"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="mt-6">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm text-gray-400">
                        Progress
                      </p>

                      <p className="text-sm text-gray-400">
                        {completedCount}/{relatedItems.length}
                      </p>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-green-400"
                        style={{
                          width: `${
                            relatedItems.length === 0
                              ? 0
                              : (completedCount /
                                  relatedItems.length) *
                                100
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    {relatedItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-2xl bg-black/20 p-4"
                      >
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() =>
                            toggleItem(item.id, item.completed)
                          }
                          className="h-5 w-5"
                        />

                        <p
                          className={
                            item.completed
                              ? "text-green-300 line-through"
                              : ""
                          }
                        >
                          {item.item}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}