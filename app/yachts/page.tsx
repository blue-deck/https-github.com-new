"use client";

import Link from "next/link";
import {
  Anchor,
  ArrowRight,
  CheckCircle2,
  ChevronUp,
  CircleAlert,
  Flag,
  LoaderCircle,
  Plus,
  Radio,
  ShieldCheck,
  Ship,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { supabase } from "../lib/supabase";

type Yacht = {
  id: string;
  name: string;
  model: string;
  flag: string;
  mmsi?: string | null;
};

type Notice = {
  tone: "success" | "error";
  message: string;
};

const copy = {
  en: {
    kicker: "Captain Workspace",
    title: "Your fleet, clearly in view.",
    intro:
      "Open each yacht’s private workspace, review its core details or add a new vessel in a few simple steps.",
    addYacht: "Add yacht",
    closeForm: "Close form",
    yachts: "Yachts",
    mmsiRecords: "MMSI records",
    access: "Access",
    private: "Private",
    fleetTitle: "Your yachts",
    fleetIntro: "Select a vessel to continue to its secure operations workspace.",
    vessel: "Vessel",
    workspaceReady: "Workspace ready",
    modelFallback: "Model not added",
    flagFallback: "Flag not added",
    mmsiFallback: "MMSI not added",
    openWorkspace: "Open workspace",
    emptyTitle: "Your fleet is ready for its first yacht.",
    emptyText:
      "Add the vessel’s name and optional identification details. You can continue setup inside its private workspace.",
    addFirstYacht: "Add first yacht",
    formKicker: "New vessel",
    formTitle: "Add a yacht",
    formIntro: "Only the yacht name is required. The remaining details can be added now or later.",
    yachtName: "Yacht name",
    yachtNamePlaceholder: "e.g. Blue Horizon",
    model: "Model",
    modelPlaceholder: "Builder or model",
    flag: "Flag",
    flagPlaceholder: "Flag state",
    mmsi: "MMSI number",
    mmsiPlaceholder: "9-digit MMSI",
    required: "Required",
    optional: "Optional",
    createYacht: "Create yacht",
    creating: "Creating yacht...",
    cancel: "Cancel",
    created: "Yacht created. Its private workspace is ready.",
    yachtNameRequired: "Enter a yacht name to continue.",
    mmsiInvalid: "MMSI must contain exactly 9 digits.",
    loadError: "Your yachts could not be loaded. Please try again.",
    createError: "The yacht could not be created. Please try again.",
    loading: "Loading captain workspace",
  },
  tr: {
    kicker: "Kaptan Çalışma Alanı",
    title: "Filonuz, tek bakışta.",
    intro:
      "Her yatın özel çalışma alanını açın, temel bilgilerini inceleyin veya birkaç kolay adımda yeni bir tekne ekleyin.",
    addYacht: "Yat ekle",
    closeForm: "Formu kapat",
    yachts: "Yat",
    mmsiRecords: "MMSI kaydı",
    access: "Erişim",
    private: "Özel",
    fleetTitle: "Yatlarınız",
    fleetIntro: "Güvenli operasyon çalışma alanına devam etmek için bir yat seçin.",
    vessel: "Yat",
    workspaceReady: "Çalışma alanı hazır",
    modelFallback: "Model eklenmedi",
    flagFallback: "Bayrak eklenmedi",
    mmsiFallback: "MMSI eklenmedi",
    openWorkspace: "Çalışma alanını aç",
    emptyTitle: "Filonuz ilk yat için hazır.",
    emptyText:
      "Yatın adını ve isteğe bağlı kimlik bilgilerini ekleyin. Kuruluma özel çalışma alanından devam edebilirsiniz.",
    addFirstYacht: "İlk yatı ekle",
    formKicker: "Yeni yat",
    formTitle: "Yat ekleyin",
    formIntro: "Yalnızca yat adı zorunludur. Diğer bilgileri şimdi veya daha sonra ekleyebilirsiniz.",
    yachtName: "Yat adı",
    yachtNamePlaceholder: "Örn. Blue Horizon",
    model: "Model",
    modelPlaceholder: "Üretici veya model",
    flag: "Bayrak",
    flagPlaceholder: "Bayrak devleti",
    mmsi: "MMSI numarası",
    mmsiPlaceholder: "9 haneli MMSI",
    required: "Zorunlu",
    optional: "İsteğe bağlı",
    createYacht: "Yatı oluştur",
    creating: "Yat oluşturuluyor...",
    cancel: "İptal",
    created: "Yat oluşturuldu. Özel çalışma alanı hazır.",
    yachtNameRequired: "Devam etmek için yat adını girin.",
    mmsiInvalid: "MMSI tam olarak 9 haneden oluşmalıdır.",
    loadError: "Yatlarınız yüklenemedi. Lütfen tekrar deneyin.",
    createError: "Yat oluşturulamadı. Lütfen tekrar deneyin.",
    loading: "Kaptan çalışma alanı yükleniyor",
  },
} as const;

export default function YachtsPage() {
  const { language } = useLanguage();
  const text = copy[language];
  const [yachts, setYachts] = useState<Yacht[]>([]);
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [flag, setFlag] = useState("");
  const [mmsi, setMmsi] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const registeredMmsiCount = useMemo(
    () => yachts.filter((yacht) => Boolean(yacht.mmsi)).length,
    [yachts],
  );

  async function fetchYachts(options?: { revealFormWhenEmpty?: boolean }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("yachts")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("BlueDeck yachts could not be loaded.", error);
      setNotice({ tone: "error", message: text.loadError });
      setLoading(false);
      return;
    }

    const nextYachts = data || [];
    setYachts(nextYachts);
    if (options?.revealFormWhenEmpty && nextYachts.length === 0) {
      setFormOpen(true);
    }
    setLoading(false);
  }

  async function createYacht(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (!name.trim()) {
      setNotice({ tone: "error", message: text.yachtNameRequired });
      return;
    }

    if (mmsi && !/^\d{9}$/.test(mmsi)) {
      setNotice({ tone: "error", message: text.mmsiInvalid });
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setCreating(true);

    const yachtPayload = {
      name: name.trim(),
      model: model.trim(),
      flag: flag.trim(),
      mmsi: mmsi || null,
      owner_id: user.id,
    };

    let { error } = await supabase.from("yachts").insert([yachtPayload]);

    if (error && /mmsi|schema cache|column/i.test(error.message)) {
      const fallbackPayload = {
        name: name.trim(),
        model: model.trim(),
        flag: flag.trim(),
        owner_id: user.id,
      };
      const fallback = await supabase.from("yachts").insert([fallbackPayload]);
      error = fallback.error;
    }

    if (error) {
      console.error("BlueDeck yacht could not be created.", error);
      setNotice({ tone: "error", message: text.createError });
      setCreating(false);
      return;
    }

    setName("");
    setModel("");
    setFlag("");
    setMmsi("");
    setNotice({ tone: "success", message: text.created });
    setFormOpen(false);
    await fetchYachts();
    setCreating(false);
  }

  useEffect(() => {
    void fetchYachts({ revealFormWhenEmpty: true });
  }, []);

  function openForm() {
    setFormOpen(true);
    setNotice(null);
    window.requestAnimationFrame(() => {
      document.getElementById("add-yacht")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }

  if (loading) {
    return (
      <main
        data-i18n-ignore
        className="bd-app-page bd-ocean-shell min-h-screen px-4 py-8 text-slate-900 sm:px-8 sm:py-10 lg:px-10 lg:py-12"
      >
        <div className="bd-ocean-content mx-auto max-w-7xl animate-pulse" aria-label={text.loading}>
          <div className="h-80 rounded-[32px] bg-[#071631]" />
          <div className="mt-8 h-8 w-48 rounded-full bg-slate-200" />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="h-56 rounded-[28px] bg-white/80" />
            <div className="h-56 rounded-[28px] bg-white/80" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      data-i18n-ignore
      className="bd-app-page bd-ocean-shell min-h-screen px-4 py-8 text-slate-900 sm:px-8 sm:py-10 lg:px-10 lg:py-12"
    >
      <div className="bd-ocean-content mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#071631] text-white shadow-[0_28px_80px_rgba(4,16,36,0.2)]">
          <div className="pointer-events-none absolute -right-24 -top-40 h-96 w-96 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-80 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative p-6 sm:p-9 lg:p-11">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-200/15 bg-white/7 text-cyan-200">
                    <Anchor className="h-5 w-5" aria-hidden />
                  </span>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                    {text.kicker}
                  </p>
                </div>

                <h1 className="bd-serif mt-8 max-w-3xl text-4xl leading-[1.02] tracking-[-0.035em] text-white sm:text-6xl lg:text-7xl">
                  {text.title}
                </h1>
                <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-slate-300 sm:text-lg">
                  {text.intro}
                </p>
              </div>

              <button
                type="button"
                onClick={formOpen ? () => setFormOpen(false) : openForm}
                aria-expanded={formOpen}
                aria-controls="add-yacht"
                className="bd-focus inline-flex min-h-14 shrink-0 items-center justify-center gap-2.5 rounded-2xl bg-white px-5 text-sm font-black text-[#071631] shadow-xl shadow-black/15 transition hover:-translate-y-0.5 hover:bg-cyan-50"
              >
                {formOpen ? (
                  <ChevronUp className="h-5 w-5" aria-hidden />
                ) : (
                  <Plus className="h-5 w-5" aria-hidden />
                )}
                {formOpen ? text.closeForm : text.addYacht}
              </button>
            </div>

            <div className="mt-10 grid gap-3 border-t border-white/10 pt-6 sm:grid-cols-3">
              <SummaryItem
                icon={Ship}
                label={text.yachts}
                value={String(yachts.length).padStart(2, "0")}
              />
              <SummaryItem
                icon={Radio}
                label={text.mmsiRecords}
                value={String(registeredMmsiCount).padStart(2, "0")}
              />
              <SummaryItem icon={ShieldCheck} label={text.access} value={text.private} />
            </div>
          </div>
        </section>

        {formOpen ? (
          <section
            id="add-yacht"
            className="bd-glass-card-strong mt-6 scroll-mt-28 rounded-[28px] p-5 sm:p-7 lg:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">
                  {text.formKicker}
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.025em] text-[#071f3c] sm:text-3xl">
                  {text.formTitle}
                </h2>
                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">
                  {text.formIntro}
                </p>
              </div>

              {yachts.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  aria-label={text.closeForm}
                  className="bd-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              ) : null}
            </div>

            <form onSubmit={createYacht} className="mt-7">
              <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  label={text.yachtName}
                  badge={text.required}
                  placeholder={text.yachtNamePlaceholder}
                  value={name}
                  onChange={setName}
                  autoComplete="organization"
                  required
                />
                <Field
                  label={text.model}
                  badge={text.optional}
                  placeholder={text.modelPlaceholder}
                  value={model}
                  onChange={setModel}
                />
                <Field
                  label={text.flag}
                  badge={text.optional}
                  placeholder={text.flagPlaceholder}
                  value={flag}
                  onChange={setFlag}
                />
                <Field
                  label={text.mmsi}
                  badge={text.optional}
                  placeholder={text.mmsiPlaceholder}
                  value={mmsi}
                  onChange={(value) => setMmsi(value.replace(/\D/g, "").slice(0, 9))}
                  inputMode="numeric"
                  maxLength={9}
                />
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200/80 pt-5 sm:flex-row sm:items-center sm:justify-end">
                {yachts.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setFormOpen(false)}
                    className="bd-focus inline-flex min-h-13 items-center justify-center rounded-2xl px-5 text-sm font-black text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                  >
                    {text.cancel}
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={creating}
                  className="bd-focus inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#071631] px-6 text-sm font-black text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-[#0d254f] disabled:cursor-wait disabled:opacity-65"
                >
                  {creating ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
                  ) : (
                    <Plus className="h-5 w-5" aria-hidden />
                  )}
                  {creating ? text.creating : text.createYacht}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {notice ? (
          <div
            role={notice.tone === "error" ? "alert" : "status"}
            className={`mt-6 flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm font-bold ${
              notice.tone === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {notice.tone === "error" ? (
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            )}
            <span>{notice.message}</span>
          </div>
        ) : null}

        <section className="mt-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">
                {text.kicker}
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#071f3c] sm:text-4xl">
                {text.fleetTitle}
              </h2>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                {text.fleetIntro}
              </p>
            </div>

            {yachts.length > 0 && !formOpen ? (
              <button
                type="button"
                onClick={openForm}
                className="bd-focus inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-[#173b58] shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-[#071631] sm:self-auto"
              >
                <Plus className="h-4 w-4" aria-hidden />
                {text.addYacht}
              </button>
            ) : null}
          </div>

          {yachts.length > 0 ? (
            <div className="mt-6 grid min-w-0 gap-4 md:grid-cols-2">
              {yachts.map((yacht, index) => (
                <Link
                  href={`/yachts/${yacht.id}`}
                  key={yacht.id}
                  className="bd-focus group relative overflow-hidden rounded-[26px] border border-slate-200/90 bg-white p-5 shadow-[0_18px_52px_rgba(4,16,36,0.07)] transition duration-200 hover:-translate-y-1 hover:border-cyan-300 hover:shadow-[0_24px_65px_rgba(4,16,36,0.11)] sm:p-6"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#071631] via-[#0d254f] to-cyan-500 opacity-90" />

                  <div className="flex items-start gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[#eef5f9] text-cyan-800 transition group-hover:bg-[#071631] group-hover:text-cyan-200">
                      <Ship className="h-6 w-6" aria-hidden />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">
                          {text.vessel} {String(index + 1).padStart(2, "0")}
                        </p>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {text.workspaceReady}
                        </span>
                      </div>

                      <h3
                        data-i18n-ignore
                        className="mt-3 truncate text-2xl font-black tracking-[-0.03em] text-[#071f3c] sm:text-3xl"
                      >
                        {yacht.name}
                      </h3>
                      <p
                        data-i18n-ignore
                        className={`mt-1.5 truncate text-sm font-semibold ${
                          yacht.model ? "text-slate-600" : "text-slate-400"
                        }`}
                      >
                        {yacht.model || text.modelFallback}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-2 sm:grid-cols-2">
                    <Detail icon={Flag} value={yacht.flag || text.flagFallback} muted={!yacht.flag} />
                    <Detail
                      icon={Radio}
                      value={yacht.mmsi ? `MMSI ${yacht.mmsi}` : text.mmsiFallback}
                      muted={!yacht.mmsi}
                    />
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-sm font-black text-[#173b58] transition group-hover:text-cyan-800">
                      {text.openWorkspace}
                    </span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#071631] text-white transition group-hover:translate-x-1 group-hover:bg-cyan-700">
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bd-glass-card mt-6 rounded-[28px] p-7 text-center sm:p-10">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-cyan-100 bg-white text-cyan-800 shadow-sm">
                <Ship className="h-7 w-7" aria-hidden />
              </span>
              <h3 className="mt-5 text-2xl font-black tracking-[-0.025em] text-[#071f3c]">
                {text.emptyTitle}
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-6 text-slate-600">
                {text.emptyText}
              </p>
              {!formOpen ? (
                <button
                  type="button"
                  onClick={openForm}
                  className="bd-focus mt-6 inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#071631] px-6 text-sm font-black text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-[#0d254f]"
                >
                  <Plus className="h-5 w-5" aria-hidden />
                  {text.addFirstYacht}
                </button>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Ship;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.045] px-4 py-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/8 text-cyan-200">
        <Icon className="h-4.5 w-4.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 truncate text-lg font-black text-white">{value}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  badge,
  value,
  placeholder,
  onChange,
  required,
  inputMode,
  maxLength,
  autoComplete,
}: {
  label: string;
  badge: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  required?: boolean;
  inputMode?: "text" | "numeric";
  maxLength?: number;
  autoComplete?: string;
}) {
  return (
    <label className="min-w-0">
      <span className="flex items-center justify-between gap-2 text-sm font-black text-[#173b58]">
        <span>{label}</span>
        <span
          className={`text-[9px] uppercase tracking-[0.12em] ${
            required ? "text-cyan-700" : "text-slate-400"
          }`}
        >
          {badge}
        </span>
      </span>
      <input
        value={value}
        placeholder={placeholder}
        required={required}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-13 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-950 placeholder:font-medium placeholder:text-slate-400"
      />
    </label>
  );
}

function Detail({
  icon: Icon,
  value,
  muted,
}: {
  icon: typeof Flag;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-2xl bg-[#f3f7fb] px-3.5 py-3">
      <Icon className={`h-4 w-4 shrink-0 ${muted ? "text-slate-400" : "text-cyan-700"}`} aria-hidden />
      <span
        data-i18n-ignore
        className={`truncate text-xs font-bold ${muted ? "text-slate-400" : "text-slate-600"}`}
      >
        {value}
      </span>
    </div>
  );
}
