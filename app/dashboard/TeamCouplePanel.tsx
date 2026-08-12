"use client";

import {
  Check,
  Clock3,
  Copy,
  LoaderCircle,
  Plus,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { supabase } from "../lib/supabase";
import {
  normalizeTeamCoupleCrewId,
  parseTeamCoupleDashboard,
  type TeamCoupleDashboard,
  type TeamCoupleInvitation,
  type TeamCouplePerson,
} from "../lib/teamCouple";

const copyByLanguage = {
  en: {
    title: "Team/Couple",
    add: "Add",
    linkedCount: (count: number) => `${count} linked`,
    incomingInviteCount: (count: number) =>
      `${count} incoming Team/Couple ${count === 1 ? "invite" : "invites"}`,
    dialogDescription:
      "Invite trusted crew by Crew ID and manage joint applications from one place.",
    close: "Close Team/Couple",
    yourCrewId: "Your Crew ID",
    copyCrewId: "Copy Crew ID",
    copied: "Copied",
    copyFailed: "Your Crew ID could not be copied.",
    addPerson: "Add by Crew ID",
    crewIdPlaceholder: "BD-…",
    inviteHint: "The crew member will see your name, Crew ID and role here.",
    sendInvite: "Send invite",
    sending: "Sending…",
    incoming: "Invites for you",
    outgoing: "Pending invites",
    members: "Your Team/Couple",
    noMembers: "No one is linked yet. Add a trusted crew member by Crew ID.",
    accept: "Accept",
    decline: "Decline",
    pending: "Pending",
    cancelInvite: "Cancel invite",
    remove: "Remove",
    removePerson: (name: string) => `Remove ${name} from Team/Couple`,
    unavailablePerson: "Unavailable crew member",
    unavailableStatus: "Account unavailable",
    unavailableHint: "This account is unavailable. You can safely remove this connection.",
    loading: "Loading Team/Couple…",
    roleCrew: "Crew",
    roleCaptain: "Captain",
    invalidCrewId: "Enter a valid Crew ID.",
    authRequired: "Please sign in again to manage Team/Couple.",
    accessRequired: "Active Crew or Captain access is required.",
    invalidRequest: "This Team/Couple action is invalid.",
    inviteUnavailable: "This Crew ID is not available for a Team/Couple invite.",
    relationshipConflict: "A Team/Couple connection or invite already exists.",
    relationshipStale: "This connection changed. The latest Team/Couple details are shown.",
    memberLimit: "A Team/Couple can contain at most eight people.",
    pendingInviteLimit: "Too many Team/Couple invitations are pending.",
    rateLimited: "Too many requests. Please wait a moment and try again.",
    serviceUnavailable: "Team/Couple is temporarily unavailable.",
    savedRefreshFailed:
      "Your change was saved, but the latest Team/Couple details could not be loaded. Reopen this panel to refresh.",
    requestFailed: "Team/Couple could not be updated. Please try again.",
    loadFailed: "Team/Couple details could not be loaded.",
    inviteSent: "Team/Couple invite sent.",
    inviteAccepted: "Team/Couple invite accepted.",
    inviteDeclined: "Team/Couple invite declined.",
    connectionRemoved: "Team/Couple connection removed.",
    inviteCancelled: "Pending invite cancelled.",
  },
  tr: {
    title: "Team/Couple",
    add: "Ekle",
    linkedCount: (count: number) => `${count} bağlı`,
    incomingInviteCount: (count: number) =>
      `${count} gelen Team/Couple daveti`,
    dialogDescription:
      "Güvendiğiniz mürettebatı Crew ID ile davet edin ve ortak başvuruları tek yerden yönetin.",
    close: "Team/Couple penceresini kapat",
    yourCrewId: "Crew ID’niz",
    copyCrewId: "Crew ID’yi kopyala",
    copied: "Kopyalandı",
    copyFailed: "Crew ID’niz kopyalanamadı.",
    addPerson: "Crew ID ile ekle",
    crewIdPlaceholder: "BD-…",
    inviteHint: "Mürettebat üyesi adınızı, Crew ID’nizi ve rolünüzü burada görecek.",
    sendInvite: "Davet gönder",
    sending: "Gönderiliyor…",
    incoming: "Size gelen davetler",
    outgoing: "Bekleyen davetler",
    members: "Team/Couple ekibiniz",
    noMembers: "Henüz bağlı kimse yok. Güvendiğiniz bir mürettebatı Crew ID ile ekleyin.",
    accept: "Kabul et",
    decline: "Reddet",
    pending: "Bekliyor",
    cancelInvite: "Daveti iptal et",
    remove: "Sil",
    removePerson: (name: string) => `${name} adlı kişiyi Team/Couple’dan sil`,
    unavailablePerson: "Kullanılamayan mürettebat üyesi",
    unavailableStatus: "Hesap kullanılamıyor",
    unavailableHint: "Bu hesap kullanılamıyor. Bağlantıyı güvenle silebilirsiniz.",
    loading: "Team/Couple yükleniyor…",
    roleCrew: "Crew",
    roleCaptain: "Captain",
    invalidCrewId: "Geçerli bir Crew ID girin.",
    authRequired: "Team/Couple’ı yönetmek için lütfen yeniden giriş yapın.",
    accessRequired: "Aktif Crew veya Captain erişimi gereklidir.",
    invalidRequest: "Bu Team/Couple işlemi geçersiz.",
    inviteUnavailable: "Bu Crew ID, Team/Couple daveti için kullanılamıyor.",
    relationshipConflict: "Bu kişiyle zaten bir Team/Couple bağlantısı veya daveti var.",
    relationshipStale: "Bu bağlantı değişti. Güncel Team/Couple bilgileri gösteriliyor.",
    memberLimit: "Bir Team/Couple en fazla sekiz kişiden oluşabilir.",
    pendingInviteLimit: "Çok fazla bekleyen Team/Couple daveti var.",
    rateLimited: "Çok fazla istek gönderildi. Lütfen kısa bir süre sonra tekrar deneyin.",
    serviceUnavailable: "Team/Couple geçici olarak kullanılamıyor.",
    savedRefreshFailed:
      "Değişikliğiniz kaydedildi ancak güncel Team/Couple bilgileri yüklenemedi. Yenilemek için bu paneli yeniden açın.",
    requestFailed: "Team/Couple güncellenemedi. Lütfen tekrar deneyin.",
    loadFailed: "Team/Couple bilgileri yüklenemedi.",
    inviteSent: "Team/Couple daveti gönderildi.",
    inviteAccepted: "Team/Couple daveti kabul edildi.",
    inviteDeclined: "Team/Couple daveti reddedildi.",
    connectionRemoved: "Team/Couple bağlantısı silindi.",
    inviteCancelled: "Bekleyen davet iptal edildi.",
  },
} as const;

type MutationMethod = "POST" | "PATCH" | "DELETE";
type MutationBody = Record<string, string | number>;
type MutationReconciler = (dashboard: TeamCoupleDashboard) => boolean;

export default function TeamCouplePanel() {
  const { language } = useLanguage();
  const copyText = copyByLanguage[language];
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const crewIdInputId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const requestSequenceRef = useRef(0);
  const lastLoadedAtRef = useRef(0);
  const dashboardRef = useRef<TeamCoupleDashboard | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const [open, setOpen] = useState(false);
  const [dashboard, setDashboard] = useState<TeamCoupleDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [crewId, setCrewId] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  const loadDashboard = useCallback(async (quiet = false) => {
    const requestSequence = ++requestSequenceRef.current;
    if (!quiet) setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("AUTH_REQUIRED");

      const response = await fetch("/api/team-couple", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(apiErrorCode(payload, response.status));
      }

      const nextDashboard = dashboardFromApi(payload);
      if (!nextDashboard) throw new Error("LOAD_FAILED");

      if (!mountedRef.current || requestSequence !== requestSequenceRef.current) {
        return false;
      }
      dashboardRef.current = nextDashboard;
      setDashboard(nextDashboard);
      setError("");
      lastLoadedAtRef.current = Date.now();
      return true;
    } catch (cause) {
      if (
        mountedRef.current &&
        requestSequence === requestSequenceRef.current &&
        (!quiet || !dashboardRef.current)
      ) {
        setError(localizedError(cause, copyText, "LOAD_FAILED"));
      }
      return false;
    } finally {
      if (mountedRef.current && requestSequence === requestSequenceRef.current) {
        setLoading(false);
      }
    }
  }, [copyText]);

  useEffect(() => {
    mountedRef.current = true;
    void loadDashboard();
    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, [loadDashboard]);

  useEffect(() => {
    const refreshOnFocus = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastLoadedAtRef.current >= 30_000
      ) {
        void loadDashboard(true);
      }
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [loadDashboard]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => closeButtonRef.current?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  async function runMutation(
    method: MutationMethod,
    body: MutationBody,
    actionKey: string,
    successMessage: string,
    reconciled: MutationReconciler,
  ) {
    setBusyAction(actionKey);
    setError("");
    setNotice("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("AUTH_REQUIRED");

      const response = await fetch("/api/team-couple", {
        method,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(apiErrorCode(payload, response.status));
      }

      const refreshed = await loadDashboard();
      if (mountedRef.current) {
        if (refreshed) {
          setNotice(successMessage);
        } else {
          setNotice("");
          setError(copyText.savedRefreshFailed);
          lastLoadedAtRef.current = 0;
        }
      }
      return true;
    } catch (cause) {
      const mutationError = localizedError(cause, copyText, "MUTATION_FAILED");
      const refreshed = await loadDashboard(true);
      if (mountedRef.current) {
        if (refreshed && dashboardRef.current && reconciled(dashboardRef.current)) {
          setError("");
          setNotice(successMessage);
          return true;
        }
        setNotice("");
        setError(mutationError);
      }
      return false;
    } finally {
      if (mountedRef.current) setBusyAction("");
    }
  }

  async function sendInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCrewId = normalizeTeamCoupleCrewId(crewId);
    if (!normalizedCrewId) {
      setNotice("");
      setError(copyText.invalidCrewId);
      return;
    }

    const sent = await runMutation(
      "POST",
      { crewId: normalizedCrewId },
      "invite",
      copyText.inviteSent,
      (nextDashboard) =>
        nextDashboard.outgoingInvites.some(
          (invitation) => invitation.publicCrewId === normalizedCrewId,
        ),
    );
    if (sent) setCrewId("");
  }

  async function respondToInvite(
    invitation: TeamCoupleInvitation,
    action: "accept" | "decline",
  ) {
    if (action === "accept") {
      await runMutation(
        "PATCH",
        {
          relationshipId: invitation.relationshipId,
          action,
          expectedVersion: invitation.version,
        },
        `${action}:${invitation.relationshipId}`,
        copyText.inviteAccepted,
        (nextDashboard) =>
          nextDashboard.members.some(
            (member) => member.relationshipId === invitation.relationshipId,
          ),
      );
      return;
    }

    await runMutation(
      "DELETE",
      {
        relationshipId: invitation.relationshipId,
        action: "decline",
        expectedVersion: invitation.version,
      },
      `${action}:${invitation.relationshipId}`,
      copyText.inviteDeclined,
      (nextDashboard) => !hasRelationship(nextDashboard, invitation.relationshipId),
    );
  }

  async function removeConnection(
    person: TeamCouplePerson,
    pendingInvite = false,
  ) {
    await runMutation(
      "DELETE",
      {
        relationshipId: person.relationshipId,
        action: pendingInvite ? "cancel" : "remove",
        expectedVersion: person.version,
      },
      `${pendingInvite ? "cancel" : "remove"}:${person.relationshipId}`,
      pendingInvite ? copyText.inviteCancelled : copyText.connectionRemoved,
      (nextDashboard) => !hasRelationship(nextDashboard, person.relationshipId),
    );
  }

  async function copyOwnCrewId() {
    if (!dashboard?.ownCrewId) return;
    try {
      await navigator.clipboard.writeText(dashboard.ownCrewId);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2_000);
    } catch {
      setError(copyText.copyFailed);
    }
  }

  const incomingCount = dashboard?.incomingInvites.length || 0;
  const memberCount = dashboard?.members.length || 0;
  const mutationInProgress = Boolean(busyAction);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
          setNotice("");
          if (Date.now() - lastLoadedAtRef.current >= 30_000) {
            void loadDashboard(true);
          }
        }}
        className="bd-focus relative inline-flex min-h-8 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50/60"
      >
        <UsersRound className="h-3.5 w-3.5 text-cyan-700" aria-hidden />
        <span className="font-semibold text-slate-500">{copyText.title}</span>
        <span className="font-black text-[#173f4a]">
          {loading && !dashboard
            ? "…"
            : memberCount > 0
              ? copyText.linkedCount(memberCount)
              : copyText.add}
        </span>
        {incomingCount > 0 ? (
          <>
            <span
              aria-hidden
              className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-black text-white shadow-sm"
            >
              {incomingCount > 9 ? "9+" : incomingCount}
            </span>
            <span className="sr-only">
              {copyText.incomingInviteCount(incomingCount)}
            </span>
          </>
        ) : null}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescriptionId}
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        onClose={() => {
          setOpen(false);
          requestAnimationFrame(() => triggerRef.current?.focus());
        }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(680px,calc(100vw-2rem))] overflow-hidden rounded-[28px] border border-white/80 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/45 backdrop:backdrop-blur-sm"
      >
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <div className="flex items-start justify-between gap-5 border-b border-slate-100 px-5 py-5 sm:px-7 sm:py-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-800 ring-1 ring-cyan-100">
                  <UsersRound className="h-4.5 w-4.5" aria-hidden />
                </span>
                <h2
                  id={dialogTitleId}
                  className="text-xl font-black tracking-[-0.025em] text-[#071f3c]"
                >
                  {copyText.title}
                </h2>
              </div>
              <p
                id={dialogDescriptionId}
                className="mt-3 max-w-xl text-sm leading-6 text-slate-500"
              >
                {copyText.dialogDescription}
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label={copyText.close}
              className="bd-focus flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-950"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">
            {error ? (
              <div
                role="alert"
                className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
              >
                {error || copyText.requestFailed}
              </div>
            ) : null}
            {notice ? (
              <div
                role="status"
                className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
              >
                <Check className="h-4 w-4" aria-hidden />
                {notice}
              </div>
            ) : null}

            {loading && !dashboard ? (
              <div className="flex min-h-52 items-center justify-center gap-3 text-sm font-bold text-slate-500">
                <LoaderCircle className="h-5 w-5 animate-spin text-cyan-700" aria-hidden />
                {copyText.loading}
              </div>
            ) : dashboard ? (
              <div className="space-y-6" aria-busy={mutationInProgress}>
                <section className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50/85 to-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-800">
                    {copyText.yourCrewId}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <code
                      data-i18n-ignore
                      className="min-w-0 truncate text-sm font-black tracking-[0.08em] text-[#071f3c]"
                    >
                      {dashboard.ownCrewId}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copyOwnCrewId()}
                      className="bd-focus inline-flex min-h-9 shrink-0 items-center gap-2 rounded-xl border border-cyan-200 bg-white px-3 text-xs font-black text-cyan-800 transition hover:border-cyan-300 hover:bg-cyan-50"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {copied ? copyText.copied : copyText.copyCrewId}
                    </button>
                  </div>
                </section>

                <form onSubmit={sendInvite} className="rounded-2xl border border-slate-200 p-4">
                  <label
                    htmlFor={crewIdInputId}
                    className="text-sm font-black text-[#071f3c]"
                  >
                    {copyText.addPerson}
                  </label>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <div className="relative min-w-0 flex-1">
                      <UserPlus
                        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden
                      />
                      <input
                        id={crewIdInputId}
                        value={crewId}
                        onChange={(event) =>
                          setCrewId(event.target.value.toUpperCase().slice(0, 64))
                        }
                        placeholder={copyText.crewIdPlaceholder}
                        autoComplete="off"
                        spellCheck={false}
                        disabled={mutationInProgress}
                        className="bd-focus min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm font-bold uppercase tracking-[0.04em] text-slate-950 placeholder:font-medium placeholder:tracking-normal placeholder:text-slate-400 disabled:opacity-60"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={mutationInProgress || !crewId.trim()}
                      className="bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-4 text-sm font-black text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyAction === "invite" ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Plus className="h-4 w-4" aria-hidden />
                      )}
                      {busyAction === "invite" ? copyText.sending : copyText.sendInvite}
                    </button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {copyText.inviteHint}
                  </p>
                </form>

                {dashboard.incomingInvites.length > 0 ? (
                  <section>
                    <SectionTitle
                      icon={<UserPlus className="h-4 w-4" aria-hidden />}
                      title={copyText.incoming}
                      count={dashboard.incomingInvites.length}
                    />
                    <div className="mt-3 space-y-2">
                      {dashboard.incomingInvites.map((invitation) => (
                        <article
                          key={invitation.relationshipId}
                          className={`rounded-2xl border p-4 ${
                            invitation.isAvailable
                              ? "border-amber-200 bg-amber-50/60"
                              : "border-slate-200 bg-slate-50/80"
                          }`}
                        >
                          <PersonIdentity
                            person={invitation}
                            roleLabel={roleLabel(invitation, copyText)}
                            detail={
                              invitation.isAvailable
                                ? formatInviteDate(invitation.invitedAt, language)
                                : formatInviteDate(invitation.invitedAt, language)
                            }
                            unavailableName={copyText.unavailablePerson}
                            unavailableStatus={copyText.unavailableStatus}
                          />
                          {!invitation.isAvailable ? (
                            <p className="mt-3 text-xs leading-5 text-slate-500">
                              {copyText.unavailableHint}
                            </p>
                          ) : null}
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={mutationInProgress || !invitation.isAvailable}
                              onClick={() => void respondToInvite(invitation, "accept")}
                              className="bd-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 text-xs font-black text-white transition hover:bg-emerald-800 disabled:opacity-50"
                            >
                              {busyAction === `accept:${invitation.relationshipId}` ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                              ) : (
                                <Check className="h-4 w-4" aria-hidden />
                              )}
                              {copyText.accept}
                            </button>
                            <button
                              type="button"
                              disabled={mutationInProgress}
                              onClick={() => void respondToInvite(invitation, "decline")}
                              className="bd-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:border-rose-200 hover:text-rose-700 disabled:opacity-50"
                            >
                              {busyAction === `decline:${invitation.relationshipId}` ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                              ) : (
                                <X className="h-4 w-4" aria-hidden />
                              )}
                              {copyText.decline}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section>
                  <SectionTitle
                    icon={<UsersRound className="h-4 w-4" aria-hidden />}
                    title={copyText.members}
                    count={dashboard.members.length}
                  />
                  {dashboard.members.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {dashboard.members.map((member) => (
                        <article
                          key={member.relationshipId}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                        >
                          <PersonIdentity
                            person={member}
                            roleLabel={roleLabel(member, copyText)}
                            unavailableName={copyText.unavailablePerson}
                            unavailableStatus={copyText.unavailableStatus}
                          />
                          <button
                            type="button"
                            disabled={mutationInProgress}
                            onClick={() => void removeConnection(member)}
                            aria-label={copyText.removePerson(
                              member.isAvailable
                                ? member.fullName
                                : copyText.unavailablePerson,
                            )}
                            title={copyText.remove}
                            className="bd-focus flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                          >
                            {busyAction === `remove:${member.relationshipId}` ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="h-4 w-4" aria-hidden />
                            )}
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-sm leading-6 text-slate-500">
                      {copyText.noMembers}
                    </p>
                  )}
                </section>

                {dashboard.outgoingInvites.length > 0 ? (
                  <section>
                    <SectionTitle
                      icon={<Clock3 className="h-4 w-4" aria-hidden />}
                      title={copyText.outgoing}
                      count={dashboard.outgoingInvites.length}
                    />
                    <div className="mt-3 space-y-2">
                      {dashboard.outgoingInvites.map((invitation) => (
                        <article
                          key={invitation.relationshipId}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                        >
                          <PersonIdentity
                            person={invitation}
                            roleLabel={roleLabel(invitation, copyText)}
                            detail={
                              invitation.isAvailable
                                ? `${copyText.pending} · ${formatInviteDate(invitation.invitedAt, language)}`
                                : formatInviteDate(invitation.invitedAt, language)
                            }
                            unavailableName={copyText.unavailablePerson}
                            unavailableStatus={copyText.unavailableStatus}
                          />
                          <button
                            type="button"
                            disabled={mutationInProgress}
                            onClick={() => void removeConnection(invitation, true)}
                            aria-label={`${copyText.cancelInvite}: ${
                              invitation.isAvailable
                                ? invitation.fullName
                                : copyText.unavailablePerson
                            }`}
                            title={copyText.cancelInvite}
                            className="bd-focus flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                          >
                            {busyAction === `cancel:${invitation.relationshipId}` ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="h-4 w-4" aria-hidden />
                            )}
                          </button>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                {copyText.loadFailed}
              </div>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}

function SectionTitle({
  icon,
  title,
  count,
}: {
  icon: ReactNode;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 text-[#071f3c]">
      <span className="text-cyan-700">{icon}</span>
      <h3 className="text-sm font-black">{title}</h3>
      <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">
        {count}
      </span>
    </div>
  );
}

function PersonIdentity({
  person,
  roleLabel,
  detail,
  unavailableName,
  unavailableStatus,
}: {
  person: TeamCouplePerson;
  roleLabel: string;
  detail?: string;
  unavailableName: string;
  unavailableStatus: string;
}) {
  const displayName = person.isAvailable ? person.fullName : unavailableName;
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#071f3c] text-xs font-black text-white"
      >
        {initials || "BD"}
      </span>
      <div className="min-w-0">
        <p data-i18n-ignore className="truncate text-sm font-black text-slate-950">
          {displayName}
        </p>
        <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
          {person.isAvailable ? (
            <>
              <span data-i18n-ignore>{person.publicCrewId}</span>
              <span aria-hidden> · </span>
              <span data-i18n-ignore>{roleLabel}</span>
            </>
          ) : (
            unavailableStatus
          )}
        </p>
        {detail ? (
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function roleLabel(
  person: TeamCouplePerson,
  copyText: (typeof copyByLanguage)[keyof typeof copyByLanguage],
) {
  return (
    person.currentPosition ||
    (person.accountRole === "captain" ? copyText.roleCaptain : copyText.roleCrew)
  );
}

function hasRelationship(
  dashboard: TeamCoupleDashboard,
  relationshipId: string,
) {
  return [
    ...dashboard.members,
    ...dashboard.incomingInvites,
    ...dashboard.outgoingInvites,
  ].some((person) => person.relationshipId === relationshipId);
}

function formatInviteDate(value: string, language: "en" | "tr") {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  return new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(timestamp);
}

function dashboardFromApi(value: unknown) {
  if (!isRecord(value) || value.ok !== true) return null;
  return parseTeamCoupleDashboard(value.dashboard);
}

function apiErrorCode(value: unknown, status: number) {
  if (isRecord(value) && typeof value.code === "string") {
    const code = value.code.trim();
    if (code) return code;
  }
  if (status === 401) return "AUTH_REQUIRED";
  if (status === 403) return "ACCESS_REQUIRED";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVICE_UNAVAILABLE";
  return "MUTATION_FAILED";
}

function localizedError(
  cause: unknown,
  copyText: (typeof copyByLanguage)[keyof typeof copyByLanguage],
  fallbackCode: "LOAD_FAILED" | "MUTATION_FAILED",
) {
  const code = cause instanceof Error ? cause.message : fallbackCode;
  switch (code) {
    case "AUTH_REQUIRED":
      return copyText.authRequired;
    case "ACCESS_REQUIRED":
      return copyText.accessRequired;
    case "INVALID_CREW_ID":
      return copyText.invalidCrewId;
    case "INVALID_REQUEST":
    case "CONTENT_TYPE_REQUIRED":
    case "REQUEST_TOO_LARGE":
      return copyText.invalidRequest;
    case "INVITE_UNAVAILABLE":
      return copyText.inviteUnavailable;
    case "RELATIONSHIP_CONFLICT":
      return copyText.relationshipConflict;
    case "RELATIONSHIP_STALE":
      return copyText.relationshipStale;
    case "MEMBER_LIMIT":
      return copyText.memberLimit;
    case "PENDING_INVITE_LIMIT":
      return copyText.pendingInviteLimit;
    case "RATE_LIMITED":
      return copyText.rateLimited;
    case "SERVICE_UNAVAILABLE":
      return copyText.serviceUnavailable;
    case "LOAD_FAILED":
      return copyText.loadFailed;
    default:
      return fallbackCode === "LOAD_FAILED"
        ? copyText.loadFailed
        : copyText.requestFailed;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
