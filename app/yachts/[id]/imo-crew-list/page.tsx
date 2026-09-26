"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileText, RefreshCw } from "lucide-react";
import { useLanguage } from "../../../components/LanguageProvider";
import { supabase } from "../../../lib/supabase";
import { createImoCrewListDraft, type ImoCrewListDraft } from "../../../lib/imoCrewList";
import ImoCrewListEditor from "./ImoCrewListEditor";
import styles from "./imoCrewList.module.css";

export default function ImoCrewListPage() {
  const params = useParams();
  const yachtId = String(params?.id || "").trim().toLowerCase();
  const { language } = useLanguage();
  const [loaded, setLoaded] = useState<{ yachtId: string; draft: ImoCrewListDraft } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
      if (active) setError("timeout");
    }, 20000);

    async function load() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (!active || controller.signal.aborted) return;
        if (sessionError) throw sessionError;
        if (!session?.access_token) {
          window.location.replace(`/login?next=${encodeURIComponent(`/yachts/${yachtId}/imo-crew-list`)}`);
          return;
        }
        const response = await fetch(`/api/yachts/${encodeURIComponent(yachtId)}/crew-data`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!active || controller.signal.aborted) return;
        if (response.status === 401) {
          window.location.replace(`/login?next=${encodeURIComponent(`/yachts/${yachtId}/imo-crew-list`)}`);
          return;
        }
        if (!response.ok || !payload?.ok || !payload.yacht || !Array.isArray(payload.crew)) {
          setError(response.status === 403 ? "forbidden" : response.status === 404 ? "not-found" : "load");
          return;
        }
        setLoaded({ yachtId, draft: createImoCrewListDraft(yachtId, payload.yacht, payload.crew) });
      } catch {
        if (active && !controller.signal.aborted) setError("load");
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void load();
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [yachtId, attempt]);

  if (loaded?.yachtId === yachtId && !error) {
    return <ImoCrewListEditor key={yachtId} initialDraft={loaded.draft} language={language} />;
  }

  const tr = language === "tr";
  return (
    <main className={`bd-app-page ${styles.page}`} data-i18n-ignore>
      <div className={styles.container}>
        <Link className={styles.back} href={`/yachts/${yachtId}`}><ArrowLeft size={16} />{tr ? "Yat çalışma alanı" : "Yacht workspace"}</Link>
        <div className={styles.loading} role={error ? "alert" : "status"} aria-busy={!error}>
          <FileText size={32} />
          <h1>IMO Crew List</h1>
          <p>{error === "forbidden"
            ? (tr ? "Bu yatın mürettebat listesine erişim yetkiniz yok." : "You do not have access to this yacht’s crew list.")
            : error === "not-found"
              ? (tr ? "Yat çalışma alanı bulunamadı." : "This yacht workspace could not be found.")
              : error
                ? (tr ? "Mürettebat listesi yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin." : "The crew list could not be loaded. Check your connection and try again.")
                : (tr ? "Gemi ve aktif mürettebat bilgileri yükleniyor…" : "Loading vessel and active crew details…")}</p>
          {error && error !== "forbidden" && error !== "not-found" && <button className={styles.secondary} onClick={() => { setError(""); setLoaded(null); setAttempt((value) => value + 1); }}><RefreshCw size={16} />{tr ? "Yeniden dene" : "Try again"}</button>}
        </div>
      </div>
    </main>
  );
}
