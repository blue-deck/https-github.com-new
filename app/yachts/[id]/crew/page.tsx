"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import {
  Anchor,
  Bell,
  CheckCircle,
  CheckSquare,
  ClipboardList,
  LifeBuoy,
  Plus,
  ShipWheel,
  Trash2,
  Utensils,
  Wrench,
  Waves,
} from "lucide-react";

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
  const [lastInviteLink, setLastInviteLink] = useState("");
  const [loading, setLoading] = useState(false);

  const allTemplates = useMemo(() => {
    return Object.entries(checklistTemplates).flatMap(([department, items]: any) =>
      items.map((item: any) => ({
        ...item,
        department,
        key: `${department}-${item.title}`,
      }))
    );
  }, []);

  async function loadData() {
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
      alert(crewError.message);
      return;
    }

    const { data: checklistData, error: checklistError } = await supabase
      .from("yacht_checklists")
      .select("*")
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });

    if (checklistError) {
      alert(checklistError.message);
      return;
    }

    setCrew(crewData || []);
    setChecklists(checklistData || []);
  }

  useEffect(() => {
    loadData();
  }, []);

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
      const response = await supabase
        .from("crew_profiles")
        .upsert(
          {
            email: inviteEmail.trim().toLowerCase(),
            full_name: fullName,
            public_crew_id: crypto.randomUUID().slice(0, 8).toUpperCase(),
          },
          { onConflict: "email" }
        )
        .select()
        .single();
      profile = response.data;
      profileError = response.error;
    }

    if (profileError) {
      alert(profileError.message);
      setLoading(false);
      return;
    }

    const token = crypto.randomUUID();
    const inviteLink = `${window.location.origin}/invitations/${token}`;

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

    const { error: memberError } = await supabase
      .from("yacht_crew_memberships")
      .upsert({
        yacht_id: yachtId,
        crew_profile_id: profile.id,
        invited_email: inviteEmail,
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
    setLastInviteLink(inviteLink);
    setLoading(false);
    loadData();

    alert("Crew invitation created. Copy the invite link and send it to the crew member.");
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

      const { data: checklist, error } = await supabase
        .from("yacht_checklists")
        .insert({
          yacht_id: yachtId,
          title: template.title,
          department: template.department,
          checklist_type: template.type,
          assigned_to: member?.crew_profile_id,
          frequency,
          due_date: dueDate || null,
          captain_note: captainNote || null,
          status: "open",
        })
        .select()
        .single();

      if (error) {
        alert(error.message);
        continue;
      }

      const tasks = template.tasks.map((task: string) => ({
        checklist_id: checklist.id,
        task_text: task,
        completed: false,
      }));

      await supabase.from("yacht_checklist_items").insert(tasks);
    }

    setSelectedTemplates([]);
    setCaptainNote("");
    setDueDate("");
    setLoading(false);
    loadData();

    alert("Checklist assigned.");
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
    <main className="min-h-screen bg-[#020817] p-6 pb-32 text-white">
      <div className="mx-auto max-w-[1700px]">
        <div className="mb-10 rounded-[40px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-900/10 p-10">
          <p className="text-cyan-300">BlueDeck CrewOS</p>
          <h1 className="mt-3 text-6xl font-black">
            Crew Management & Checklist Assignment
          </h1>
          <p className="mt-5 max-w-4xl text-xl leading-relaxed text-gray-400">
            Add crew, assign department-based yacht checklists, manage roles,
            watchkeeping and operational duties.
          </p>
        </div>

        <div className="mb-10 grid gap-6 md:grid-cols-4">
          <Stat title="Crew" value={crew.length} icon={<Bell />} />
          <Stat title="Open Checklists" value={checklists.length} icon={<ClipboardList />} />
          <Stat title="Departments" value="5" icon={<ShipWheel />} />
          <Stat title="Status" value="Operational" icon={<CheckSquare />} />
        </div>

        <div className="grid gap-8 xl:grid-cols-[420px_1fr]">
          <div className="space-y-8">
            <div className="rounded-[36px] border border-white/10 bg-white/5 p-8">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400 text-black">
                  <Plus />
                </div>
                <div>
                  <p className="text-cyan-300">Captain Action</p>
                  <h2 className="text-4xl font-black">Invite Crew</h2>
                </div>
              </div>

              <div className="mt-8 space-y-5">
                <input
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-lg outline-none"
                />

                <input
                  placeholder="Crew ID"
                  value={crewPublicId}
                  onChange={(e) => setCrewPublicId(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-lg outline-none"
                />

                <input
                  placeholder="Crew email, if Crew ID is not known"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-lg outline-none"
                />

                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-lg outline-none"
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
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-lg outline-none"
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
                  className="w-full rounded-2xl bg-cyan-400 py-4 text-xl font-bold text-black"
                >
                  {loading ? "Saving..." : "Create Invitation"}
                </button>

                {lastInviteLink && (
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-100">
                    <p className="font-bold">Invite link</p>
                    <p className="mt-2 break-all">{lastInviteLink}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[36px] border border-white/10 bg-white/5 p-8">
              <p className="text-cyan-300">Assign To</p>
              <h2 className="mt-2 text-4xl font-black">Crew Member</h2>

              <select
                value={selectedCrew}
                onChange={(e) => setSelectedCrew(e.target.value)}
                className="mt-8 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-lg outline-none"
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
                className="mt-5 w-full rounded-2xl bg-green-400 py-4 text-xl font-bold text-black"
              >
                {loading ? "Assigning..." : "Assign Selected Checklists"}
              </button>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-lg outline-none"
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
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-lg outline-none"
                />
              </div>

              <textarea
                placeholder="Captain note for this checklist"
                value={captainNote}
                onChange={(e) => setCaptainNote(e.target.value)}
                className="mt-4 h-24 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 outline-none"
              />
            </div>

            <div className="rounded-[36px] border border-white/10 bg-white/5 p-8">
              <p className="text-cyan-300">Contract</p>
              <h2 className="mt-2 text-4xl font-black">Assign Yacht Contract</h2>
              <p className="mt-3 text-gray-400">
                Select a crew member above, paste the contract text, and send it
                for mobile signature.
              </p>
              <textarea
                value={contractText}
                onChange={(e) => setContractText(e.target.value)}
                placeholder="Contract terms, dates, salary, position, vessel name..."
                className="mt-6 h-40 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 outline-none"
              />
              <button
                onClick={assignContract}
                className="mt-5 w-full rounded-2xl bg-cyan-400 py-4 text-xl font-bold text-black"
              >
                Send Contract for Signature
              </button>
            </div>

            <div className="rounded-[36px] border border-white/10 bg-white/5 p-8">
              <p className="text-cyan-300">Assigned Work</p>
              <h2 className="mt-2 text-4xl font-black">Open Checklists</h2>

              <div className="mt-8 space-y-4">
                {checklists.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-black/30 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-bold">{item.title}</h3>
                        <p className="mt-1 text-sm text-gray-400">
                          {item.department} · {item.checklist_type}
                        </p>
                      </div>

                      <button
                        onClick={() => deleteChecklist(item.id)}
                        className="text-red-300"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}

                {checklists.length === 0 && (
                  <p className="text-gray-500">No assigned checklist yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {Object.entries(checklistTemplates).map(([dept, templates]: any) => (
              <div key={dept} className="rounded-[36px] border border-white/10 bg-white/5 p-8">
                <div className="mb-8 flex items-center gap-4">
                  <DepartmentIcon department={dept} />
                  <div>
                    <p className="text-cyan-300">Checklist Department</p>
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
                            ? "border-cyan-400 bg-cyan-400/10"
                            : "border-white/10 bg-black/20 hover:border-cyan-400/40"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`mt-1 flex h-7 w-7 items-center justify-center rounded-lg border ${
                              selected
                                ? "border-cyan-300 bg-cyan-400 text-black"
                                : "border-white/20"
                            }`}
                          >
                            {selected && <CheckCircle className="h-5 w-5" />}
                          </div>

                          <div>
                            <h3 className="text-2xl font-black">{template.title}</h3>
                            <p className="mt-2 text-sm text-cyan-300">{template.type}</p>

                            <div className="mt-5 space-y-2">
                              {template.tasks.map((task: string) => (
                                <p key={task} className="text-sm text-gray-400">
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
    </main>
  );
}

function DepartmentIcon({ department }: any) {
  if (department === "Deck") return <ShipWheel className="h-12 w-12 text-cyan-300" />;
  if (department === "Interior") return <Utensils className="h-12 w-12 text-pink-300" />;
  if (department === "Engineering") return <Wrench className="h-12 w-12 text-orange-300" />;
  if (department === "Toys") return <Waves className="h-12 w-12 text-blue-300" />;
  return <LifeBuoy className="h-12 w-12 text-red-300" />;
}

function Stat({ title, value, icon }: any) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
      <div className="flex items-center justify-between">
        <div className="text-cyan-300">{icon}</div>
        <div className="text-right">
          <p className="text-gray-400">{title}</p>
          <h2 className="mt-2 text-3xl font-black">{value}</h2>
        </div>
      </div>
    </div>
  );
}
