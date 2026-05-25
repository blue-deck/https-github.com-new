"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import {
  Anchor,
  Bell,
  Camera,
  CheckCircle,
  CheckSquare,
  ClipboardList,
  Clock3,
  LifeBuoy,
  Plus,
  RefreshCcw,
  ShipWheel,
  Trash2,
  Utensils,
  UserRound,
  Wrench,
  Waves,
  X,
} from "lucide-react";
import { saveYachtMembership } from "../../../lib/yachtMemberships";

const yachtId = "f434e90f-b8d8-443c-ad23-d5cedbe4308f";

const checklistTemplates: any = {
  Deck: [
    {
      title: "Departure Preparation",
      type: "Departure",
      tasks: [
        "Fenders ready",
        "Lines ready",
        "Deck clear",
        "Tender secured",
        "Passerelle secured",
        "Navigation lights checked",
        "Water toys secured",
        "Guest areas checked",
      ],
    },
    {
      title: "Arrival Preparation",
      type: "Arrival",
      tasks: [
        "Fenders deployed",
        "Mooring lines prepared",
        "Passerelle ready",
        "Deck crew in position",
        "Shore power cable ready",
        "Water hose ready",
      ],
    },
    {
      title: "Anchor Watch",
      type: "Watchkeeping",
      tasks: [
        "Anchor position checked",
        "GPS drift checked",
        "Weather checked",
        "Nearby vessels checked",
        "Deck security round completed",
        "Bilge alarm panel checked",
      ],
    },
    {
      title: "Exterior Washdown",
      type: "Daily",
      tasks: [
        "Aft deck washed",
        "Foredeck washed",
        "Side decks washed",
        "Stainless wiped",
        "Teak checked",
        "Windows rinsed",
      ],
    },
  ],

  Interior: [
    {
      title: "Guest Arrival Preparation",
      type: "Guest",
      tasks: [
        "Cabins prepared",
        "Bathrooms sanitized",
        "Towels placed",
        "Welcome drinks ready",
        "Guest amenities placed",
        "Interior temperature checked",
      ],
    },
    {
      title: "Cabin Turnover",
      type: "Daily",
      tasks: [
        "Beds made",
        "Bathrooms cleaned",
        "Laundry collected",
        "Bins emptied",
        "Amenities refilled",
        "Cabin surfaces cleaned",
      ],
    },
    {
      title: "Table Service Setup",
      type: "Guest",
      tasks: [
        "Table dressed",
        "Cutlery polished",
        "Glassware checked",
        "Napkins prepared",
        "Drinks station ready",
        "Galley coordination confirmed",
      ],
    },
  ],

  Engineering: [
    {
      title: "Engine Room Daily Check",
      type: "Daily",
      tasks: [
        "Main engine oil levels checked",
        "Generator oil levels checked",
        "Bilges checked",
        "Seawater strainers checked",
        "Battery voltage checked",
        "Engine room temperature checked",
        "Leaks checked",
        "Alarm panel checked",
      ],
    },
    {
      title: "Generator Watch",
      type: "Watchkeeping",
      tasks: [
        "Generator load checked",
        "Generator temperature checked",
        "Fuel level checked",
        "Exhaust water flow checked",
        "Abnormal noise checked",
        "Engine room ventilation checked",
      ],
    },
    {
      title: "Watermaker Check",
      type: "Maintenance",
      tasks: [
        "Pre-filters checked",
        "Pressure checked",
        "Fresh water production checked",
        "Leaks checked",
        "Flush cycle confirmed",
        "System logged",
      ],
    },
  ],

  Toys: [
    {
      title: "Jetski Preparation",
      type: "Toys",
      tasks: [
        "Fuel level checked",
        "Battery checked",
        "Safety lanyard checked",
        "Flush connection ready",
        "Lifejackets ready",
        "Guest briefing prepared",
      ],
    },
    {
      title: "Seabob Preparation",
      type: "Toys",
      tasks: [
        "Batteries charged",
        "Units rinsed",
        "Prop guards checked",
        "Charging station checked",
        "Guest safety briefing ready",
      ],
    },
    {
      title: "Beach Club Setup",
      type: "Guest",
      tasks: [
        "Towels ready",
        "Water toys ready",
        "Drinks cooler ready",
        "Shade setup ready",
        "Tender standby confirmed",
        "Safety gear ready",
      ],
    },
  ],

  Safety: [
    {
      title: "Guest Safety Briefing",
      type: "Safety",
      tasks: [
        "Lifejackets location explained",
        "Muster point explained",
        "Smoking rules explained",
        "Tender safety explained",
        "Water toys safety explained",
        "Emergency procedure explained",
      ],
    },
    {
      title: "Weekly Safety Check",
      type: "Weekly",
      tasks: [
        "Fire extinguishers checked",
        "EPIRB checked",
        "Life raft expiry checked",
        "First aid kit checked",
        "Emergency lights checked",
        "MOB equipment checked",
      ],
    },
  ],
};

export default function CrewPage() {
  const [crew, setCrew] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [selectedCrew, setSelectedCrew] = useState("");
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [crewPublicId, setCrewPublicId] = useState("");
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("Deckhand");
  const [department, setDepartment] = useState("Deck");
  const [frequency, setFrequency] = useState("Daily");
  const [dueDate, setDueDate] = useState("");
  const [captainNote, setCaptainNote] = useState("");
  const [contractText, setContractText] = useState("");
  const [inviteNotice, setInviteNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ label: string; url: string } | null>(null);

  const allTemplates = useMemo(() => {
    return Object.entries(checklistTemplates).flatMap(([department, items]: any) =>
      items.map((item: any) => ({
        ...item,
        department,
        key: `${department}-${item.title}`,
      }))
    );
  }, []);

  async function loadData(silent = false) {
    const { data: crewData, error: crewError } = await supabase
      .from("yacht_crew_memberships")
      .select(`
        *,
        crew_profiles (
          id,
          email,
          full_name,
          phone,
          nationality,
          passport_number,
          passport_expiry,
          stcw_expiry,
          medical_expiry
        )
      `)
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    if (crewError) {
      if (!silent) alert(crewError.message);
      return;
    }

    const { data: checklistData, error: checklistError } = await supabase
      .from("yacht_checklists")
      .select(`
        *,
        yacht_checklist_items (*)
      `)
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    if (checklistError) {
      if (!silent) alert(checklistError.message);
      return;
    }

    setCrew(crewData || []);
    setChecklists(checklistData || []);
  }

  useEffect(() => {
    loadData();
    const interval = window.setInterval(() => loadData(true), 10000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!photoPreview) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPhotoPreview(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [photoPreview]);

  async function addCrew() {
    if (!inviteEmail && !crewPublicId) {
      alert("Crew email or Crew ID required");
      return;
    }

    setLoading(true);

    const lookup = crewPublicId.trim().toUpperCase();
    let profile = null;
    let profileError = null;

    if (lookup) {
      const response = await supabase
        .from("crew_profiles")
        .select("*")
        .eq("public_crew_id", lookup)
        .maybeSingle();
      profile = response.data;
      profileError = response.error;
    }

    if (!profile && inviteEmail) {
      const normalizedInviteEmail = inviteEmail.trim().toLowerCase();
      const existingProfile = await supabase
        .from("crew_profiles")
        .select("*")
        .eq("email", normalizedInviteEmail)
        .limit(1);

      if (existingProfile.error) {
        profileError = existingProfile.error;
      } else if (existingProfile.data?.[0]) {
        profile = existingProfile.data[0];

        if (fullName && !profile.full_name) {
          await supabase
            .from("crew_profiles")
            .update({ full_name: fullName })
            .eq("id", profile.id);
        }
      } else {
        const response = await supabase
          .from("crew_profiles")
          .insert({
            email: normalizedInviteEmail,
            full_name: fullName,
            public_crew_id: crypto.randomUUID().slice(0, 8).toUpperCase(),
          })
          .select()
          .single();

        profile = response.data;
        profileError = response.error;
      }
    }

    if (profileError) {
      alert(profileError.message);
      setLoading(false);
      return;
    }

    if (!profile?.id) {
      alert("Crew profile could not be created. Please check the Crew ID or email.");
      setLoading(false);
      return;
    }

    const token = crypto.randomUUID();
    const inviteOrigin =
      window.location.hostname === "localhost"
        ? "https://bluedeck.app"
        : window.location.origin;
    const inviteLink = `${inviteOrigin}/invitations/${token}`;

    const { error: inviteError } = await supabase.from("crew_invitations").insert({
      yacht_id: yachtId,
      crew_profile_id: profile.id,
      invited_email: inviteEmail || profile.email,
      public_crew_id: profile.public_crew_id,
      position,
      department,
      status: "pending",
      token,
      invite_link: inviteLink,
    });

    if (inviteError) {
      alert(inviteError.message);
      setLoading(false);
      return;
    }

    const { error: memberError } = await saveYachtMembership(supabase, {
      yacht_id: yachtId,
      crew_profile_id: profile.id,
      invited_email: inviteEmail || profile.email,
      position,
      department,
      status: "invited",
    });

    if (memberError) {
      alert(memberError.message);
      setLoading(false);
      return;
    }

    setInviteEmail("");
    setCrewPublicId("");
    setFullName("");
    setInviteNotice("Invitation is now waiting inside the crew member's My YachtOS portal.");
    setLoading(false);
    loadData();

    alert("Crew invitation created. The crew member will see it inside My YachtOS.");
  }

  function toggleTemplate(key: string) {
    setSelectedTemplates((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  }

  async function assignSelectedChecklists() {
    if (!selectedCrew) {
      alert("Select crew member");
      return;
    }

    if (selectedTemplates.length === 0) {
      alert("Select checklist");
      return;
    }

    setLoading(true);

    const member = crew.find((item) => item.id === selectedCrew);

    for (const key of selectedTemplates) {
      const template = allTemplates.find((item) => item.key === key);
      if (!template) continue;

      const { data: checklist, error } = await createChecklist({
        yacht_id: yachtId,
        title: template.title,
        department: template.department,
        checklist_type: template.type,
        assigned_to: member?.crew_profile_id,
        due_date: dueDate || null,
        status: "open",
        items: {
          frequency,
          captain_note: captainNote || null,
          tasks: template.tasks,
        },
      });

      if (error) {
        alert(error.message);
        continue;
      }

      const tasks = template.tasks.map((task: string) => ({
        checklist_id: checklist.id,
        task_text: task,
        completed: false,
      }));

      const { error: itemError } = await insertChecklistItems(tasks);
      if (itemError) alert(itemError.message);
    }

    setSelectedTemplates([]);
    setCaptainNote("");
    setDueDate("");
    setLoading(false);
    loadData();

    alert("Checklist assigned.");
  }

  async function createChecklist(payload: Record<string, any>) {
    const variants = [
      payload,
      omitKeys(payload, ["items"]),
      omitKeys(payload, ["items", "due_date"]),
      omitKeys(payload, ["items", "due_date", "status"]),
    ];

    let lastResponse: any = null;

    for (const variant of variants) {
      const response = await supabase
        .from("yacht_checklists")
        .insert(variant)
        .select()
        .single();

      if (!response.error) return response;
      lastResponse = response;

      if (!isSchemaCacheError(response.error)) return response;
    }

    return lastResponse;
  }

  async function insertChecklistItems(tasks: any[]) {
    const variants = [
      tasks,
      tasks.map((task) => omitKeys(task, ["completed"])),
    ];

    let lastResponse: any = null;

    for (const variant of variants) {
      const response = await supabase.from("yacht_checklist_items").insert(variant);
      if (!response.error) return response;
      lastResponse = response;

      if (!isSchemaCacheError(response.error)) return response;
    }

    return lastResponse;
  }

  async function deleteChecklist(id: string) {
    if (!confirm("Delete checklist?")) return;

    await supabase.from("yacht_checklists").delete().eq("id", id);
    loadData();
  }

  async function assignContract() {
    if (!selectedCrew) {
      alert("Select crew member");
      return;
    }

    if (!contractText.trim()) {
      alert("Contract text required");
      return;
    }

    const member = crew.find((item) => item.id === selectedCrew);

    const { error } = await supabase.from("yacht_contracts").insert({
      yacht_id: yachtId,
      crew_profile_id: member?.crew_profile_id,
      membership_id: selectedCrew,
      contract_text: contractText,
      status: "sent_for_signature",
      sent_at: new Date().toISOString(),
    });

    if (error) {
      alert(error.message);
      return;
    }

    setContractText("");
    alert("Contract sent for mobile signature.");
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#fbf7ef_0%,#eef7f8_48%,#f7efe0_100%)] p-6 pb-32 text-slate-900">
      <div className="mx-auto max-w-[1700px]">
        <div className="mb-10 overflow-hidden rounded-[40px] border border-white/70 bg-white/85 shadow-2xl shadow-cyan-950/10 backdrop-blur">
          <div className="h-1.5 bg-[linear-gradient(90deg,#08111f,#22d3ee,#d8b45f,#ef776f)]" />
          <div className="p-10">
          <p className="font-semibold uppercase tracking-[0.18em] text-cyan-700">BlueDeck CrewOS</p>
          <h1 className="mt-3 text-6xl font-black">
            Crew Management & Checklist Assignment
          </h1>
          <p className="mt-5 max-w-4xl text-xl leading-relaxed text-slate-500">
            Add crew, assign department-based yacht checklists, manage roles,
            watchkeeping and operational duties.
          </p>
          </div>
        </div>

        <div className="mb-10 grid gap-6 md:grid-cols-4">
          <Stat title="Crew" value={crew.length} icon={<Bell />} />
          <Stat title="Open Checklists" value={checklists.length} icon={<ClipboardList />} />
          <Stat title="Departments" value="5" icon={<ShipWheel />} />
          <Stat title="Status" value="Operational" icon={<CheckSquare />} />
        </div>

        <div className="grid gap-8 xl:grid-cols-[420px_1fr]">
          <div className="space-y-8">
            <div className="rounded-[36px] border border-slate-200 bg-white/85 p-8 shadow-xl shadow-cyan-950/5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-600 text-white shadow-[0_18px_40px_rgba(8,145,178,0.22)]">
                  <Plus />
                </div>
                <div>
                  <p className="text-cyan-700">Captain Action</p>
                  <h2 className="text-4xl font-black">Invite Crew</h2>
                </div>
              </div>

              <div className="mt-8 space-y-5">
                <input
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-300"
                />

                <input
                  placeholder="Crew ID"
                  value={crewPublicId}
                  onChange={(e) => setCrewPublicId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-300"
                />

                <input
                  placeholder="Crew email, if Crew ID is not known"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-300"
                />

                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg text-slate-950 outline-none focus:border-cyan-300"
                >
                  <option>Captain</option>
                  <option>Engineer</option>
                  <option>Deckhand</option>
                  <option>Stewardess</option>
                  <option>Chef</option>
                </select>

                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg text-slate-950 outline-none focus:border-cyan-300"
                >
                  <option>Deck</option>
                  <option>Interior</option>
                  <option>Engineering</option>
                  <option>Toys</option>
                  <option>Safety</option>
                </select>

                <button
                  onClick={addCrew}
                  disabled={loading}
                  className="w-full rounded-2xl bg-cyan-600 py-4 text-xl font-bold text-white shadow-lg shadow-cyan-700/20 transition hover:bg-cyan-700 disabled:opacity-60"
                >
                  {loading ? "Saving..." : "Create Invitation"}
                </button>

                {inviteNotice && (
                  <div className="rounded-2xl border border-cyan-400/25 bg-cyan-50 p-4 text-sm text-slate-700">
                    <p className="font-bold">Invitation sent</p>
                    <p className="mt-2 leading-6">{inviteNotice}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[36px] border border-slate-200 bg-white/85 p-8 shadow-xl shadow-cyan-950/5">
              <p className="text-cyan-700">Assign To</p>
              <h2 className="mt-2 text-4xl font-black">Crew Member</h2>

              <select
                value={selectedCrew}
                onChange={(e) => setSelectedCrew(e.target.value)}
                className="mt-8 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg text-slate-950 outline-none focus:border-cyan-300"
              >
                <option value="">Select crew</option>
                {crew.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.crew_profiles?.full_name || member.invited_email} — {member.position}
                  </option>
                ))}
              </select>

              <button
                onClick={assignSelectedChecklists}
                disabled={loading}
                className="mt-5 w-full rounded-2xl bg-slate-950 py-4 text-xl font-bold text-white transition hover:bg-cyan-700 disabled:opacity-60"
              >
                {loading ? "Assigning..." : "Assign Selected Checklists"}
              </button>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg text-slate-950 outline-none focus:border-cyan-300"
                >
                  <option>Daily</option>
                  <option>Weekly</option>
                  <option>One-time</option>
                  <option>Before Departure</option>
                  <option>After Arrival</option>
                </select>

                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg text-slate-950 outline-none focus:border-cyan-300"
                />
              </div>

              <textarea
                placeholder="Captain note for this checklist"
                value={captainNote}
                onChange={(e) => setCaptainNote(e.target.value)}
                className="mt-4 h-24 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-300"
              />
            </div>

            <div className="rounded-[36px] border border-slate-200 bg-white/85 p-8 shadow-xl shadow-cyan-950/5">
              <p className="text-cyan-700">Contract</p>
              <h2 className="mt-2 text-4xl font-black">Assign Yacht Contract</h2>
              <p className="mt-3 text-slate-500">
                Select a crew member above, paste the contract text, and send it
                for mobile signature.
              </p>
              <textarea
                value={contractText}
                onChange={(e) => setContractText(e.target.value)}
                placeholder="Contract terms, dates, salary, position, vessel name..."
                className="mt-6 h-40 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-300"
              />
              <button
                onClick={assignContract}
                className="mt-5 w-full rounded-2xl bg-cyan-600 py-4 text-xl font-bold text-white shadow-lg shadow-cyan-700/20 transition hover:bg-cyan-700"
              >
                Send Contract for Signature
              </button>
            </div>

            <div className="rounded-[36px] border border-slate-200 bg-white/85 p-8 shadow-xl shadow-cyan-950/5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-cyan-700">Assigned Work</p>
                  <h2 className="mt-2 text-4xl font-black">Crew Progress</h2>
                </div>
                <button
                  onClick={() => loadData()}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-cyan-700 transition hover:border-cyan-300"
                  title="Refresh crew progress"
                >
                  <RefreshCcw className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-8 space-y-4">
                {checklists.map((item) => {
                  const progress = getChecklistProgress(item);
                  const assignedCrew = crew.find(
                    (member) => member.crew_profile_id === item.assigned_to
                  );
                  const tasks = item.yacht_checklist_items || [];

                  return (
                    <div
                      key={item.id}
                      className="rounded-3xl border border-slate-200 bg-white p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-bold">{item.title}</h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {item.department} · {item.checklist_type}
                            {getChecklistFrequency(item) ? ` · ${getChecklistFrequency(item)}` : ""}
                          </p>
                          <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                            <UserRound className="h-4 w-4 text-cyan-700" />
                            {assignedCrew?.crew_profiles?.full_name ||
                              assignedCrew?.invited_email ||
                              "Crew member"}
                          </p>
                        </div>

                        <button
                          onClick={() => deleteChecklist(item.id)}
                          className="text-[#b9423b]"
                          title="Delete checklist"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>

                      {getChecklistNote(item) && (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-slate-700">
                          Captain note: {getChecklistNote(item)}
                        </div>
                      )}

                      <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-semibold text-slate-600">
                            {progress.done}/{progress.total} completed
                          </span>
                          <span className="font-black text-cyan-700">
                            {progress.percent}%
                          </span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-cyan-600 transition-all"
                            style={{ width: `${progress.percent}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-5 space-y-3">
                        {tasks.map((task: any) => {
                          const beforePhoto = getTaskPhoto(task, "before");
                          const afterPhoto = getTaskPhoto(task, "after");

                          return (
                            <div
                              key={task.id}
                              className={`rounded-2xl border p-4 ${
                                task.completed
                                  ? "border-emerald-200 bg-emerald-50"
                                  : "border-slate-200 bg-slate-50"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                                    task.completed
                                      ? "border-emerald-500 bg-emerald-500 text-white"
                                      : "border-slate-300 bg-white text-slate-300"
                                  }`}
                                >
                                  {task.completed && <CheckCircle className="h-5 w-5" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`font-semibold ${
                                      task.completed ? "text-slate-700" : "text-slate-500"
                                    }`}
                                  >
                                    {task.task_text}
                                  </p>
                                  {task.completed && (
                                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                      <Clock3 className="h-3.5 w-3.5 text-cyan-700" />
                                      Done by {task.completed_by || assignedCrew?.crew_profiles?.email || "crew"}
                                      {task.completed_at ? ` · ${formatDateTime(task.completed_at)}` : ""}
                                    </p>
                                  )}

                                  {(beforePhoto || afterPhoto) && (
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                      <TaskPhotoPreview label="Before" url={beforePhoto} onOpen={setPhotoPreview} />
                                      <TaskPhotoPreview label="After" url={afterPhoto} onOpen={setPhotoPreview} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {tasks.length === 0 && (
                          <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                            This checklist has no task items yet.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {checklists.length === 0 && (
                  <p className="text-slate-500">No assigned checklist yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {Object.entries(checklistTemplates).map(([dept, templates]: any) => (
              <div key={dept} className="rounded-[36px] border border-slate-200 bg-white/85 p-8 shadow-xl shadow-cyan-950/5">
                <div className="mb-8 flex items-center gap-4">
                  <DepartmentIcon department={dept} />
                  <div>
                    <p className="text-cyan-700">Checklist Department</p>
                    <h2 className="text-5xl font-black">{dept}</h2>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  {templates.map((template: any) => {
                    const key = `${dept}-${template.title}`;
                    const selected = selectedTemplates.includes(key);

                    return (
                      <button
                        key={key}
                        onClick={() => toggleTemplate(key)}
                        className={`rounded-[28px] border p-6 text-left transition ${
                          selected
                            ? "border-cyan-400 bg-cyan-50 shadow-[0_18px_50px_rgba(8,145,178,0.12)]"
                            : "border-slate-200 bg-white hover:border-cyan-300"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`mt-1 flex h-7 w-7 items-center justify-center rounded-lg border ${
                              selected
                                ? "border-cyan-600 bg-cyan-600 text-white"
                                : "border-slate-300"
                            }`}
                          >
                            {selected && <CheckCircle className="h-5 w-5" />}
                          </div>

                          <div>
                            <h3 className="text-2xl font-black">{template.title}</h3>
                            <p className="mt-2 text-sm text-cyan-700">{template.type}</p>

                            <div className="mt-5 space-y-2">
                              {template.tasks.map((task: string) => (
                                <p key={task} className="text-sm text-slate-500">
                                  • {task}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {photoPreview && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          onClick={() => setPhotoPreview(null)}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-[32px] border border-white/20 bg-white shadow-2xl shadow-slate-950/40"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">
                  Task Photo
                </p>
                <h3 className="text-2xl font-black text-slate-950">{photoPreview.label}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPhotoPreview(null)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800"
                aria-label="Close photo preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-950">
              <img
                src={photoPreview.url}
                alt={`${photoPreview.label} task photo`}
                className="max-h-[78vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function DepartmentIcon({ department }: any) {
  if (department === "Deck") return <ShipWheel className="h-12 w-12 text-cyan-700" />;
  if (department === "Interior") return <Utensils className="h-12 w-12 text-[#b9427b]" />;
  if (department === "Engineering") return <Wrench className="h-12 w-12 text-[#c46d24]" />;
  if (department === "Toys") return <Waves className="h-12 w-12 text-blue-700" />;
  return <LifeBuoy className="h-12 w-12 text-[#b9423b]" />;
}

function omitKeys<T extends Record<string, any>>(value: T, keys: string[]) {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.includes(key))
  );
}

function isSchemaCacheError(error: any) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  return message.toLowerCase().includes("schema cache");
}

function getChecklistProgress(checklist: any) {
  const tasks = checklist?.yacht_checklist_items || [];
  const total = tasks.length;
  const done = tasks.filter((task: any) => task.completed).length;
  return {
    total,
    done,
    percent: total ? Math.round((done / total) * 100) : 0,
  };
}

function getChecklistFrequency(checklist: any) {
  return checklist?.frequency || checklist?.items?.frequency || "";
}

function getChecklistNote(checklist: any) {
  return checklist?.captain_note || checklist?.items?.captain_note || "";
}

function parseTaskNote(task: any) {
  if (!task?.note) return {};
  if (typeof task.note === "object") return task.note;

  try {
    return JSON.parse(task.note);
  } catch {
    return {};
  }
}

function getTaskPhoto(task: any, type: "before" | "after") {
  const note = parseTaskNote(task);
  return (
    task?.[`${type}_photo_url`] ||
    note?.[`${type}_photo_url`] ||
    note?.photos?.[type] ||
    ""
  );
}

function formatDateTime(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TaskPhotoPreview({
  label,
  url,
  onOpen,
}: {
  label: string;
  url?: string;
  onOpen: (photo: { label: string; url: string }) => void;
}) {
  if (!url) return null;

  return (
    <button
      type="button"
      onClick={() => onOpen({ label, url })}
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:border-cyan-300 hover:shadow-lg hover:shadow-cyan-950/10"
    >
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-500">
        <Camera className="h-3.5 w-3.5 text-cyan-700" />
        {label}
      </div>
      <img
        src={url}
        alt={`${label} task photo`}
        className="h-28 w-full object-cover transition group-hover:scale-[1.02]"
      />
    </button>
  );
}

function Stat({ title, value, icon }: any) {
  return (
    <div className="rounded-[30px] border border-slate-200 bg-white/85 p-6 shadow-xl shadow-cyan-950/5">
      <div className="flex items-center justify-between">
        <div className="text-cyan-700">{icon}</div>
        <div className="text-right">
          <p className="text-slate-500">{title}</p>
          <h2 className="mt-2 text-3xl font-black">{value}</h2>
        </div>
      </div>
    </div>
  );
}
