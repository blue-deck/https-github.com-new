"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, FileText, Ship } from "lucide-react";
import { supabase } from "../../../lib/supabase";

export default function ImoCrewListPage() {
  const params = useParams();
  const yachtId = String(params?.id || "");
  const [yacht, setYacht] = useState<any>(null);
  const [crew, setCrew] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    const { data: yachtData } = await supabase
      .from("yachts")
      .select("*")
      .eq("id", yachtId)
      .maybeSingle();

    const { data: crewData, error } = await supabase
      .from("yacht_crew_memberships")
      .select(`
        *,
        crew_profiles (
          full_name,
          email,
          phone,
          nationality,
          passport_number,
          passport_expiry,
          visa_country,
          visa_expiry,
          seaman_book_expiry
        )
      `)
      .eq("yacht_id", yachtId)
      .in("status", ["active", "invited"])
      .order("created_at", { ascending: true });

    if (error) {
      alert(error.message);
    }

    setYacht(yachtData);
    setCrew(crewData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#020817] p-8 text-white">
        Loading IMO crew list...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020817] px-5 py-8 text-white sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-5 rounded-[32px] border border-cyan-500/20 bg-cyan-500/10 p-8 print:hidden md:flex-row md:items-end">
          <div>
            <p className="text-cyan-300">Captain Document</p>
            <h1 className="mt-3 text-5xl font-black">IMO Crew List</h1>
            <p className="mt-4 max-w-3xl text-gray-300">
              Crew details are pulled automatically from each member’s BlueDeck
              profile, including passport and expiry information.
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-6 py-4 font-black text-black"
          >
            <Download className="h-5 w-5" />
            Download / Save PDF
          </button>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-white p-8 text-black print:border-0">
          <div className="flex items-start justify-between gap-8 border-b border-black/20 pb-6">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.14em]">
                International Maritime Crew List
              </p>
              <h2 className="mt-3 text-4xl font-black">
                {yacht?.name || "Yacht"}
              </h2>
              <p className="mt-2">
                Flag: {yacht?.flag || "-"} · Model: {yacht?.model || "-"}
              </p>
            </div>
            <div className="text-right">
              <Ship className="ml-auto h-10 w-10" />
              <p className="mt-3 text-sm">Generated: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-black/20">
                  <Th>No</Th>
                  <Th>Name</Th>
                  <Th>Position</Th>
                  <Th>Nationality</Th>
                  <Th>Passport No</Th>
                  <Th>Passport Expiry</Th>
                  <Th>Visa</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {crew.map((member, index) => (
                  <tr key={member.id} className="border-b border-black/10">
                    <Td>{index + 1}</Td>
                    <Td>{member.crew_profiles?.full_name || member.invited_email}</Td>
                    <Td>{member.position}</Td>
                    <Td>{member.crew_profiles?.nationality || "-"}</Td>
                    <Td>{member.crew_profiles?.passport_number || "-"}</Td>
                    <Td>{member.crew_profiles?.passport_expiry || "-"}</Td>
                    <Td>
                      {member.crew_profiles?.visa_country || "-"}{" "}
                      {member.crew_profiles?.visa_expiry ? `(${member.crew_profiles.visa_expiry})` : ""}
                    </Td>
                    <Td>{member.status}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {crew.length === 0 && (
            <div className="mt-8 rounded-2xl border border-black/20 p-6 text-center">
              <FileText className="mx-auto h-10 w-10" />
              <p className="mt-3 font-bold">No crew members found.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-3 font-black">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-4 align-top">{children}</td>;
}
