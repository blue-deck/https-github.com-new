"use client";

import {
  Shield,
  Anchor,
  ChefHat,
  Wrench,
  Plus,
  Phone,
  Mail,
} from "lucide-react";

const crew = [
  {
    name: "Sinan Uymaz",
    role: "Captain",
    nationality: "Turkey",
    status: "On Duty",
    icon: Shield,
    email: "captain@heliophilia.com",
    phone: "+90 555 000 0000",
  },
  {
    name: "Liliya Kashapova",
    role: "Stewardess",
    nationality: "Russia",
    status: "Active",
    icon: Anchor,
    email: "liliya@heliophilia.com",
    phone: "+7 900 000 0000",
  },
  {
    name: "Caglar Kara",
    role: "Deckhand",
    nationality: "Turkey",
    status: "Active",
    icon: Anchor,
    email: "caglar@heliophilia.com",
    phone: "+90 555 111 1111",
  },
  {
    name: "Marco Rossi",
    role: "Chef",
    nationality: "Italy",
    status: "Off Duty",
    icon: ChefHat,
    email: "chef@heliophilia.com",
    phone: "+39 300 000 0000",
  },
  {
    name: "David Stone",
    role: "Engineer",
    nationality: "United Kingdom",
    status: "On Call",
    icon: Wrench,
    email: "engineer@heliophilia.com",
    phone: "+44 7000 000000",
  },
];

export default function CrewPage() {
  return (
    <main className="min-h-screen bg-[#020817] p-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-cyan-300">BlueDeck CrewOS</p>

            <h1 className="mt-3 text-6xl font-black">
              Crew Center
            </h1>

            <p className="mt-5 max-w-3xl text-xl text-gray-400">
              Enterprise crew operations and onboard personnel management.
            </p>
          </div>

          <button className="flex items-center gap-3 rounded-2xl bg-cyan-400 px-7 py-5 text-lg font-black text-black transition hover:scale-105">
            <Plus className="h-5 w-5" />
            Add Crew Member
          </button>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-4">
          <Stat title="Total Crew" value="5" />
          <Stat title="On Duty" value="3" />
          <Stat title="Departments" value="4" />
          <Stat title="Status" value="Operational" />
        </div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {crew.map((member) => {
            const Icon = member.icon;

            return (
              <div
                key={member.name}
                className="rounded-[36px] border border-white/10 bg-white/5 p-8"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-400 text-black">
                    <Icon className="h-8 w-8" />
                  </div>

                  <div className="rounded-full bg-green-500/20 px-4 py-2 text-sm text-green-300">
                    {member.status}
                  </div>
                </div>

                <h2 className="mt-8 text-4xl font-black">
                  {member.name}
                </h2>

                <p className="mt-3 text-2xl text-cyan-300">
                  {member.role}
                </p>

                <p className="mt-2 text-gray-400">
                  {member.nationality}
                </p>

                <div className="mt-8 space-y-4">
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <Mail className="h-5 w-5 text-cyan-300" />

                    <span className="text-sm text-gray-300">
                      {member.email}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <Phone className="h-5 w-5 text-cyan-300" />

                    <span className="text-sm text-gray-300">
                      {member.phone}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function Stat({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
      <p className="text-gray-400">{title}</p>

      <h2 className="mt-4 text-3xl font-black">
        {value}
      </h2>
    </div>
  );
}