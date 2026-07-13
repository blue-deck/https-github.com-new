"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  ChevronLeft,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { createSafeStoragePath } from "../lib/storage";
import { supabase } from "../lib/supabase";

type CrewProfileSummary = {
  id: string;
  full_name?: string;
  public_crew_id?: string;
};

type PortfolioPhoto = {
  id?: string;
  created_at?: string;
  title: string;
  image_url: string;
  location: string;
  gallery_order?: number;
};

type RelatedApiResult = {
  ok?: boolean;
  error?: string;
  portfolio?: PortfolioPhoto[];
};

const emptyPhoto: PortfolioPhoto = {
  title: "",
  image_url: "",
  location: "",
};

const galleryOrderPrefix = "__BLUDECK_GALLERY_ORDER__";

export default function MyBluePage() {
  const [profile, setProfile] = useState<CrewProfileSummary | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingOrder, setEditingOrder] = useState(false);
  const [preview, setPreview] = useState<PortfolioPhoto | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const uploadRunRef = useRef(0);

  const editablePortfolio = useMemo(
    () => sortPortfolioPhotos(portfolio.filter((photo) => photo.image_url)),
    [portfolio],
  );

  const loadRelated = useCallback(async (profileId: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      window.location.href = "/login";
      return false;
    }

    const response = await fetch(`/api/crew-profile/related?profileId=${encodeURIComponent(profileId)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });
    const result = (await response.json().catch(() => null)) as RelatedApiResult | null;

    if (!response.ok || !result?.ok) {
      setErrorMessage(result?.error || "Photo gallery could not be loaded.");
      return false;
    }

    setPortfolio(sortPortfolioPhotos((result.portfolio || []).map(normalizePortfolioRecord)));
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadGallery() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        window.location.href = "/login";
        return;
      }

      const { data: existingProfile, error: profileError } = await supabase
        .from("crew_profiles")
        .select("id, full_name, public_crew_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) {
        if (!cancelled) {
          setErrorMessage(profileError.message);
          setLoading(false);
        }
        return;
      }

      let crewProfile = existingProfile as CrewProfileSummary | null;

      if (!crewProfile) {
        const { data: createdProfile, error: createError } = await supabase
          .from("crew_profiles")
          .insert({
            user_id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.email,
            public_crew_id: user.id.slice(0, 8).toUpperCase(),
            current_positions: [],
            seeking_positions: [],
            work_preferences: [],
            personal_skills: [],
            personal_characteristics: [],
            languages: [],
          })
          .select("id, full_name, public_crew_id")
          .single();

        if (createError || !createdProfile) {
          if (!cancelled) {
            setErrorMessage(createError?.message || "Crew profile could not be created.");
            setLoading(false);
          }
          return;
        }

        crewProfile = createdProfile as CrewProfileSummary;
      }

      if (cancelled) return;
      setProfile(crewProfile);
      await loadRelated(crewProfile.id);
      if (!cancelled) setLoading(false);
    }

    void loadGallery();

    return () => {
      cancelled = true;
    };
  }, [loadRelated]);

  useEffect(() => {
    if (!preview) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setPreview(null);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [preview]);

  async function callRelatedApi(input: {
    action: "save" | "delete";
    payload?: Record<string, unknown>;
    id?: string;
  }) {
    if (!profile?.id) return { ok: false, error: "Crew profile is not loaded." };

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      window.location.href = "/login";
      return { ok: false, error: "Login session is required." };
    }

    const response = await fetch("/api/crew-profile/related", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ ...input, kind: "portfolio", profileId: profile.id }),
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

    if (!response.ok || !result?.ok) {
      return { ok: false, error: result?.error || "Photo gallery could not be saved." };
    }

    return { ok: true, error: "" };
  }

  async function savePortfolioPhoto(item: PortfolioPhoto) {
    const result = await callRelatedApi({
      action: "save",
      payload: {
        ...item,
        title: "",
        location: encodeGalleryLocation(item.location, item.gallery_order),
      },
      id: item.id,
    });

    if (!result.ok) {
      setErrorMessage(result.error);
      return false;
    }

    if (profile?.id) await loadRelated(profile.id);
    return true;
  }

  async function saveNewPhoto(imageUrl: string) {
    if (!imageUrl) return;
    setSaving(true);
    setErrorMessage("");

    try {
      await savePortfolioPhoto({
        ...emptyPhoto,
        image_url: imageUrl,
        gallery_order: nextPortfolioOrder(editablePortfolio),
      });
    } finally {
      setSaving(false);
    }
  }

  async function reorderPhoto(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= editablePortfolio.length || saving) return;

    const reordered = [...editablePortfolio];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    const orderedPortfolio = reordered.map((photo, order) => ({ ...photo, gallery_order: order }));

    setPortfolio((current) => {
      const orderedIds = new Set(orderedPortfolio.map((photo) => photo.id || photo.image_url));
      const untouched = current.filter((photo) => !orderedIds.has(photo.id || photo.image_url));
      return [...orderedPortfolio, ...untouched];
    });
    setSaving(true);
    setErrorMessage("");

    try {
      const results = await Promise.all(
        orderedPortfolio.map((photo) =>
          callRelatedApi({
            action: "save",
            payload: {
              ...photo,
              title: "",
              location: encodeGalleryLocation(photo.location, photo.gallery_order),
            },
            id: photo.id,
          }),
        ),
      );
      const failed = results.find((result) => !result.ok);
      if (failed) setErrorMessage(failed.error);
      if (profile?.id) await loadRelated(profile.id);
    } finally {
      setSaving(false);
    }
  }

  async function deletePhoto(id?: string) {
    if (!id || !profile?.id || saving) return;
    setSaving(true);
    setErrorMessage("");

    try {
      const result = await callRelatedApi({ action: "delete", id });
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      await loadRelated(profile.id);
    } finally {
      setSaving(false);
    }
  }

  function cancelUpload() {
    uploadRunRef.current += 1;
    setUploading(false);
    setErrorMessage("");
  }

  async function uploadPhoto(file: File) {
    if (!profile?.id) return "";

    const uploadRun = uploadRunRef.current + 1;
    uploadRunRef.current = uploadRun;
    setErrorMessage("");
    setUploading(true);
    const path = createSafeStoragePath(profile.id, file);

    try {
      const { error } = await supabase.storage.from("crew-portfolio").upload(path, file);

      if (uploadRun !== uploadRunRef.current) {
        if (!error) await supabase.storage.from("crew-portfolio").remove([path]);
        return "";
      }

      if (error) {
        setErrorMessage(formatUploadError(error.message));
        return "";
      }

      const { data } = supabase.storage.from("crew-portfolio").getPublicUrl(path);
      return data.publicUrl;
    } finally {
      if (uploadRun === uploadRunRef.current) setUploading(false);
    }
  }

  if (loading) {
    return (
      <main className="bd-ocean-shell min-h-screen px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
        <div className="bd-ocean-content mx-auto max-w-[1320px]">
          <div className="bd-glass-card-strong rounded-[28px] p-6 text-sm font-semibold text-slate-600">
            Loading photo gallery...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bd-ocean-shell min-h-screen overflow-x-hidden px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="bd-ocean-content mx-auto max-w-[1320px]">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/85 px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-[#173f4a] shadow-sm transition hover:border-cyan-300 hover:text-cyan-800"
        >
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </Link>

        <header className="bd-glass-card-strong overflow-hidden rounded-[30px]">
          <div className="h-1.5 bg-[linear-gradient(90deg,#07111f_0%,#0891b2_45%,#2d7482_100%)]" />
          <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-700">My Blue</p>
              <h1 className="bd-serif mt-3 text-4xl font-normal text-[#071f3c] sm:text-5xl">Photo Gallery</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Add and arrange photos from your yacht work, onboard projects and maritime experience.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/80 px-4 py-3 text-[#173f4a]">
              <Camera className="h-5 w-5 text-cyan-700" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-800">Gallery</p>
                <p className="text-lg font-black tabular-nums">{editablePortfolio.length} photos</p>
              </div>
            </div>
          </div>
        </header>

        {errorMessage && (
          <section className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                <div className="min-w-0">
                  <h2 className="font-semibold">Photo gallery action failed</h2>
                  <p className="mt-1 break-words text-sm leading-6 text-rose-800">{errorMessage}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage("")}
                className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                Dismiss
              </button>
            </div>
          </section>
        )}

        <section className="mt-6 overflow-hidden rounded-[28px] border border-[#2fb6c7]/25 bg-white shadow-2xl shadow-slate-950/14">
          <div className="h-1 bg-[linear-gradient(90deg,#07313b_0%,#8ed8e6_36%,#21aebf_72%,#0a4452_100%)]" />
          <div className="p-4 sm:p-6">
            <div className="rounded-2xl border border-cyan-100 bg-[linear-gradient(135deg,#f7fdff_0%,#eef9fb_100%)] p-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#173f4a] text-white shadow-sm">
                    <Camera className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#06111f]">Professional photo gallery</p>
                    <p className="mt-1 max-w-4xl text-sm leading-6 text-[#5a6870]">
                      Your photos are saved automatically and appear in your public BlueDeck gallery.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingOrder((current) => !current)}
                  disabled={editablePortfolio.length < 2 || saving || uploading}
                  className={`inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-3 text-xs font-black uppercase tracking-[0.08em] shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto ${
                    editingOrder
                      ? "bg-[#173f4a] text-white"
                      : "border border-slate-200 bg-white text-[#173f4a] hover:border-cyan-300"
                  }`}
                >
                  <Pencil className="h-4 w-4" />
                  {editingOrder ? "Done" : "Edit order"}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <label
                  className={`inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#173f4a] shadow-sm transition ${
                    uploading || saving
                      ? "cursor-progress opacity-70"
                      : "cursor-pointer hover:border-cyan-300 hover:text-cyan-800"
                  }`}
                >
                  <Upload className="h-4 w-4 text-cyan-700" />
                  {uploading ? "Uploading..." : saving ? "Saving..." : "Add photo"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploading || saving}
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      if (!file) return;
                      const url = await uploadPhoto(file);
                      if (url) await saveNewPhoto(url);
                    }}
                  />
                </label>
                {uploading && (
                  <button
                    type="button"
                    onClick={cancelUpload}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-200 hover:text-rose-700"
                  >
                    Cancel upload
                  </button>
                )}
                {saving && (
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-[#2d7482]">Saving gallery...</span>
                )}
              </div>
              <p className="mt-2 text-xs font-semibold text-[#6b7a82]">
                New photos appear first. Use edit order to arrange the public gallery.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {editablePortfolio.map((item, index) => (
                <GalleryPhotoCard
                  key={item.id || item.image_url}
                  item={item}
                  editing={editingOrder}
                  disabled={saving || uploading}
                  canMoveLeft={index > 0}
                  canMoveRight={index < editablePortfolio.length - 1}
                  onMoveLeft={() => reorderPhoto(index, -1)}
                  onMoveRight={() => reorderPhoto(index, 1)}
                  onDelete={() => deletePhoto(item.id)}
                  onPreview={() => setPreview(item)}
                />
              ))}
              {editablePortfolio.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-cyan-200 bg-cyan-50/30 px-5 py-12 text-center">
                  <Camera className="mx-auto h-8 w-8 text-cyan-700" />
                  <p className="mt-3 text-sm font-black text-[#173f4a]">No gallery photos yet</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Use Add photo to start your My Blue gallery.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#06111f]/55 p-4 backdrop-blur-sm"
          onMouseDown={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Photo gallery preview"
        >
          <div
            className="relative w-[min(760px,92vw)] rounded-3xl bg-white p-3 shadow-2xl shadow-slate-950/30"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-[#06111f] shadow-lg shadow-slate-950/15 transition hover:bg-cyan-50"
              aria-label="Close photo preview"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={preview.image_url}
              alt="Photo gallery preview"
              className="max-h-[78vh] w-full rounded-2xl object-contain"
            />
          </div>
        </div>
      )}
    </main>
  );
}

function GalleryPhotoCard({
  item,
  editing,
  disabled,
  canMoveLeft,
  canMoveRight,
  onMoveLeft,
  onMoveRight,
  onDelete,
  onPreview,
}: {
  item: PortfolioPhoto;
  editing: boolean;
  disabled: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDelete: () => void;
  onPreview: () => void;
}) {
  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={onPreview}
        className="group block aspect-square w-full cursor-pointer overflow-hidden rounded-xl bg-[#eef6f8] shadow-sm shadow-slate-950/8 transition hover:shadow-lg hover:shadow-cyan-950/12"
      >
        <img
          src={item.image_url}
          alt="Photo gallery"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
        />
      </button>
      <div className="mt-2 grid gap-1.5">
        {editing && (
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={onMoveLeft}
              disabled={!canMoveLeft || disabled}
              className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-cyan-100 bg-white text-[#173f4a] transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Move photo left"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onMoveRight}
              disabled={!canMoveRight || disabled}
              className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-cyan-100 bg-white text-[#173f4a] transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Move photo right"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-rose-100 bg-white px-2 text-[10px] font-black uppercase tracking-[0.08em] text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </div>
  );
}

function splitGalleryLocation(value?: string | null) {
  const location = value || "";
  if (!location.startsWith(galleryOrderPrefix)) {
    return { location, order: undefined as number | undefined };
  }

  const lineBreak = location.indexOf("\n");
  const orderText = location.slice(galleryOrderPrefix.length, lineBreak === -1 ? undefined : lineBreak).trim();
  const parsedOrder = Number(orderText);
  return {
    location: lineBreak === -1 ? "" : location.slice(lineBreak + 1),
    order: Number.isFinite(parsedOrder) ? parsedOrder : undefined,
  };
}

function encodeGalleryLocation(location?: string | null, order?: number) {
  const cleanLocation = (location || "").trim();
  if (typeof order !== "number" || !Number.isFinite(order)) return cleanLocation;
  return `${galleryOrderPrefix}${order}\n${cleanLocation}`;
}

function normalizePortfolioRecord(photo: PortfolioPhoto) {
  const parsed = splitGalleryLocation(photo.location);
  return {
    ...photo,
    location: parsed.location,
    gallery_order: typeof photo.gallery_order === "number" ? photo.gallery_order : parsed.order,
  };
}

function portfolioSortValue(photo: PortfolioPhoto, index: number) {
  if (typeof photo.gallery_order === "number" && Number.isFinite(photo.gallery_order)) {
    return photo.gallery_order;
  }

  const createdAt = photo.created_at ? Date.parse(photo.created_at) : 0;
  return createdAt ? -createdAt : index;
}

function sortPortfolioPhotos(photos: PortfolioPhoto[]) {
  return [...photos].sort((first, second) => {
    const firstIndex = photos.indexOf(first);
    const secondIndex = photos.indexOf(second);
    return portfolioSortValue(first, firstIndex) - portfolioSortValue(second, secondIndex);
  });
}

function nextPortfolioOrder(photos: PortfolioPhoto[]) {
  if (photos.length === 0) return 0;
  return Math.min(...photos.map((photo, index) => portfolioSortValue(photo, index))) - 1;
}

function formatUploadError(message: string) {
  if (message === "Bucket not found") {
    return "File storage is not ready yet. Please create the required BlueDeck storage bucket in Supabase.";
  }

  if (/invalid key/i.test(message)) {
    return "This file name could not be accepted by storage. Please refresh the page and try again.";
  }

  return message;
}
