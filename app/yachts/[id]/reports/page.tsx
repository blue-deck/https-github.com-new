"use client";

import { FileText, Printer, Ship, Wrench, Users, Wallet } from "lucide-react";

export default function ReportsPage() {
  function printPage() {
    window.print();
  }

  return (
    <main className="min-h-screen bg-[#020817] p-8 pb-28 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 rounded-[40px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-900/10 p-10">
          <p className="text-cyan-300">BlueDeck Reports</p>
          <h1 className="mt-3 text-6xl font-black">Reports & PDF Export</h1>
          <p className="mt-5 max-w-3xl text-xl text-gray-400">
            Captain reports, engineering summaries and operational PDF exports.
          </p>

          <button
            onClick={printPage}
            className="mt-8 flex items-center gap-3 rounded-2xl bg-cyan-400 px-7 py-5 text-lg font-black text-black"
          >
            <Printer />
            Print / Export PDF
          </button>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <Report icon={<Ship />} title="Captain Daily Report" text="Yacht operational status is stable. Navigation systems are online." />
          <Report icon={<Wrench />} title="Engineering Report" text="Engineering systems operational. No critical alarms detected." />
          <Report icon={<Users />} title="Crew Report" text="Crew center operational. Duties and departments are active." />
          <Report icon={<Wallet />} title="Finance Report" text="Finance system ready for operational accounting." />
        </div>
      </div>
    </main>
  );
}

function Report({ icon, title, text }: any) {
  return (
    <div className="rounded-[36px] border border-white/10 bg-white/5 p-8">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-400 text-black">
        {icon}
      </div>

      <h2 className="text-4xl font-black">{title}</h2>
      <p className="mt-5 text-xl leading-relaxed text-gray-400">{text}</p>

      <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
        <div className="flex items-center gap-3 text-cyan-300">
          <FileText />
          Ready for PDF export
        </div>
      </div>
    </div>
  );
}