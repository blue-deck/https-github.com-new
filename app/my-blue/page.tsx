"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Camera,
  ChevronLeft,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AccessibleImageLightbox } from "../components/AccessibleImageLightbox";
import { loadAccountCapabilities } from "../lib/accountCapabilities";
import { signCrewPortfolioReference } from "../lib/crewPortfolioStorage";
import {
  createSafeStoragePath,
  maximumImageUploadBytes,
  safePortfolioUploadMimeTypes,
  validateStorageUpload,
} from "../lib/storage";
import { supabase } from "../lib/supabase";
import { resolveSupabaseUrl } from "../lib/supabaseConfig";

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
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PortfolioPhoto | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const uploadRunRef = useRef(0);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const suppressPreviewUntilRef = useRef(0);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: {
        start: ["Space"],
        cancel: ["Escape"],
        end: ["Space", "Tab"],
      },
    }),
  );

  const editablePortfolio = useMemo(
    () => sortPortfolioPhotos(portfolio.filter((photo) => photo.image_url)),
    [portfolio],
  );
  const sortablePhotoIds = useMemo(
    () => editablePortfolio.map(portfolioPhotoKey),
    [editablePortfolio],
  );
  const dndAccessibility = useMemo<{
    announcements: Announcements;
    screenReaderInstructions: ScreenReaderInstructions;
  }>(() => {
    const positionOf = (id: string | number) => sortablePhotoIds.indexOf(String(id)) + 1;
    const total = sortablePhotoIds.length;

    return {
      screenReaderInstructions: {
        draggable:
          "Press Enter to preview the photo. To reorder it, press Space, use the arrow keys to move it, then press Space again to drop. Press Tab to drop and continue, or Escape to cancel.",
      },
      announcements: {
        onDragStart({ active }) {
          return `Photo ${positionOf(active.id)} of ${total} picked up.`;
        },
        onDragOver({ over }) {
          return over ? `Photo is over position ${positionOf(over.id)} of ${total}.` : undefined;
        },
        onDragEnd({ over }) {
          return over ? `Photo dropped at position ${positionOf(over.id)} of ${total}.` : "Photo returned to its original position.";
        },
        onDragCancel() {
          return "Photo movement cancelled.";
        },
      },
    };
  }, [sortablePhotoIds]);

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

      const capabilities = await loadAccountCapabilities().catch(() => null);
      if (capabilities?.canUseCrewWorkspace !== true) {
        window.location.replace("/dashboard");
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

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setPreview(null);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [preview]);

  async function callRelatedApi(input: {
    action: "save" | "delete" | "reorder";
    payload?: Record<string, unknown>;
    id?: string;
    items?: Array<{ id: string; location: string }>;
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

  function applyPortfolioOrder(orderedPortfolio: PortfolioPhoto[]) {
    setPortfolio((current) => {
      const orderedIds = new Set(orderedPortfolio.map((photo) => photo.id || photo.image_url));
      const untouched = current.filter((photo) => !orderedIds.has(photo.id || photo.image_url));
      return [...orderedPortfolio, ...untouched];
    });
  }

  async function persistPortfolioOrder(
    orderedPortfolio: PortfolioPhoto[],
    previousPortfolio: PortfolioPhoto[],
  ) {
    setSaving(true);
    setErrorMessage("");

    try {
      const items = orderedPortfolio.map((photo) => ({
        id: photo.id || "",
        location: encodeGalleryLocation(photo.location, photo.gallery_order),
      }));
      if (items.some((item) => !item.id)) {
        throw new Error("The new gallery order could not be saved.");
      }

      const result = await callRelatedApi({ action: "reorder", items });
      if (!result.ok) throw new Error(result.error || "The new gallery order could not be saved.");
    } catch (error) {
      applyPortfolioOrder(previousPortfolio);
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : "The new gallery order could not be saved. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const photoId = String(event.active.id);
    suppressPreviewUntilRef.current = Number.POSITIVE_INFINITY;
    setActivePhotoId(photoId);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActivePhotoId(null);
    suppressPreviewUntilRef.current = Date.now() + 350;
    const { active, over } = event;
    if (!over || active.id === over.id || saving || uploading) return;

    const oldIndex = sortablePhotoIds.indexOf(String(active.id));
    const newIndex = sortablePhotoIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const orderedPortfolio = arrayMove(editablePortfolio, oldIndex, newIndex).map((photo, order) => ({
      ...photo,
      gallery_order: order,
    }));

    applyPortfolioOrder(orderedPortfolio);
    await persistPortfolioOrder(orderedPortfolio, editablePortfolio);
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
    const validationError = validateStorageUpload(
      file,
      safePortfolioUploadMimeTypes,
      maximumImageUploadBytes,
    );
    if (validationError) {
      setErrorMessage(validationError);
      return "";
    }

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

      return signCrewPortfolioReference(
        supabase,
        path,
        [profile.id],
        resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
      );
    } finally {
      if (uploadRun === uploadRunRef.current) setUploading(false);
    }
  }

  if (loading) {
    return (
      <main className="bd-app-page bd-ocean-shell bd-page-gutter min-h-screen px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
        <div className="bd-ocean-content bd-page-frame mx-auto max-w-[1320px]">
          <div className="bd-glass-card-strong rounded-[28px] p-6 text-sm font-semibold text-slate-600">
            Loading photo gallery...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bd-app-page bd-ocean-shell bd-page-gutter min-h-screen overflow-x-hidden px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="bd-ocean-content bd-page-frame mx-auto max-w-[1320px]">
        <Link
          href="/dashboard"
          className="bd-focus mb-3 inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white/90 px-3 text-xs font-black uppercase tracking-[0.08em] text-[#173f4a] shadow-sm backdrop-blur transition hover:border-cyan-300 hover:text-cyan-800"
          aria-label="Back to dashboard"
          title="Back to dashboard"
        >
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </Link>

        <header
          className="overflow-hidden rounded-[22px] border border-slate-200/80 bg-white/95 shadow-lg shadow-slate-950/6 backdrop-blur"
          aria-busy={uploading || saving}
        >
          <div className="bd-brand-rule h-0.5" />
          <div className="p-4 sm:p-5">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#173f4a] text-white shadow-sm">
                  <Camera className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700">My Blue</p>
                  <h1 className="truncate text-xl font-black tracking-[-0.02em] text-[#071f3c] sm:text-2xl">
                    Photo Gallery
                  </h1>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    Selected photos appear on the public Find Crew profile for active Crew and Captain accounts.
                  </p>
                </div>
              </div>

              <span
                className="inline-flex h-8 shrink-0 items-center rounded-full border border-cyan-100 bg-cyan-50/80 px-3 text-xs font-bold tabular-nums text-[#173f4a]"
                aria-label={`${editablePortfolio.length} ${editablePortfolio.length === 1 ? "photo" : "photos"}`}
              >
                {editablePortfolio.length} {editablePortfolio.length === 1 ? "photo" : "photos"}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <p
                id="gallery-reorder-instructions"
                className="order-2 min-w-0 text-[11px] font-medium leading-4 text-slate-500 sm:order-1"
              >
                {saving
                  ? "Saving gallery changes..."
                  : editablePortfolio.length > 1
                    ? "Hold and drag to reorder · Saves automatically"
                    : editablePortfolio.length === 1
                      ? "Add another photo to arrange your gallery"
                      : "Add photos to build your gallery"}
              </p>

              <div className="order-1 flex w-full items-center gap-2 sm:order-2 sm:w-auto">
                <button
                  type="button"
                  disabled={uploading || saving}
                  onClick={() => photoInputRef.current?.click()}
                  className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#173f4a] px-4 text-sm font-bold text-white shadow-sm transition sm:min-w-40 sm:flex-none ${
                    uploading || saving
                      ? "cursor-progress opacity-70"
                      : "cursor-pointer hover:bg-[#0d5968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
                  }`}
                >
                  <Upload className="h-4 w-4" aria-hidden />
                  {uploading ? "Uploading..." : "Add photo"}
                </button>
                {uploading && (
                  <button
                    type="button"
                    onClick={cancelUpload}
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                    aria-label="Cancel photo upload"
                    title="Cancel upload"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept={Array.from(safePortfolioUploadMimeTypes).join(",")}
                  aria-label="Choose gallery photo"
                  disabled={uploading || saving}
                  className="sr-only"
                  tabIndex={-1}
                  onChange={async (event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    if (!file) return;
                    const url = await uploadPhoto(file);
                    if (url) await saveNewPhoto(url);
                  }}
                />
              </div>
            </div>
            <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {uploading ? "Uploading gallery photo..." : saving ? "Saving gallery changes..." : ""}
            </span>
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

        <section className="mt-4 rounded-[24px] border border-[#2fb6c7]/20 bg-white/95 p-3 shadow-xl shadow-slate-950/10 sm:p-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            accessibility={dndAccessibility}
            onDragStart={handleDragStart}
            onDragCancel={() => {
              setActivePhotoId(null);
              suppressPreviewUntilRef.current = Date.now() + 350;
            }}
            onDragEnd={(event) => void handleDragEnd(event)}
          >
            <SortableContext items={sortablePhotoIds} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {editablePortfolio.map((item, index) => {
                  const photoId = portfolioPhotoKey(item);
                  return (
                    <GalleryPhotoCard
                      key={photoId}
                      id={photoId}
                      item={item}
                      position={index + 1}
                      total={editablePortfolio.length}
                      active={activePhotoId === photoId}
                      disabled={saving || uploading}
                      onDelete={() => deletePhoto(item.id)}
                      onPreview={() => {
                        if (Date.now() < suppressPreviewUntilRef.current) return;
                        setPreview(item);
                      }}
                    />
                  );
                })}
                {editablePortfolio.length === 0 && (
                  <div className="col-span-full rounded-2xl border border-dashed border-cyan-200 bg-cyan-50/30 px-5 py-12 text-center">
                    <Camera className="mx-auto h-8 w-8 text-cyan-700" />
                    <p className="mt-3 text-sm font-black text-[#173f4a]">No gallery photos yet</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Use Add photo to start your My Blue gallery.
                    </p>
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </section>
      </div>

      {preview &&
        createPortal(
          <AccessibleImageLightbox
            source={preview.image_url}
            imageAlt={preview.title || "Photo gallery preview"}
            dialogLabel={
              preview.title
                ? `Photo gallery preview: ${preview.title}`
                : "Photo gallery preview"
            }
            closeLabel="Close photo preview"
            onClose={() => setPreview(null)}
          />,
          document.body,
        )}
    </main>
  );
}

function GalleryPhotoCard({
  id,
  item,
  position,
  total,
  active,
  disabled,
  onDelete,
  onPreview,
}: {
  id: string;
  item: PortfolioPhoto;
  position: number;
  total: number;
  active: boolean;
  disabled: boolean;
  onDelete: () => void;
  onPreview: () => void;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id, disabled: disabled || total < 2 });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const sortableEnabled = !disabled && total > 1;
  const sortableAttributes = sortableEnabled ? attributes : {};
  const sortableListeners = sortableEnabled ? listeners : {};
  const describedBy = sortableEnabled
    ? [attributes["aria-describedby"], "gallery-reorder-instructions"].filter(Boolean).join(" ")
    : undefined;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`min-w-0 rounded-xl transition-[opacity,filter,box-shadow] ${
        isDragging || active
          ? "z-20 opacity-75 shadow-2xl shadow-cyan-950/25 ring-2 ring-cyan-500"
          : "opacity-100"
      }`}
    >
      <div className="relative aspect-square">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...sortableAttributes}
          {...sortableListeners}
          onClick={onPreview}
          className={`group bd-focus block h-full w-full touch-manipulation overflow-hidden rounded-xl bg-[#eef6f8] shadow-sm shadow-slate-950/8 transition hover:shadow-lg hover:shadow-cyan-950/12 ${
            sortableEnabled ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
          }`}
          aria-label={`Photo ${position} of ${total}. Press Enter to preview${sortableEnabled ? "; press Space or hold and drag to reorder" : ""}.`}
          aria-describedby={describedBy}
          title={sortableEnabled ? "Click to preview. Hold and drag to reorder." : "Click to preview."}
        >
          <img
            src={item.image_url}
            alt="Photo gallery"
            draggable={false}
            className="h-full w-full select-none object-cover transition duration-300 group-hover:scale-[1.025]"
          />
        </button>
      </div>
      <div className="mt-2 grid gap-1.5">
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
    </article>
  );
}

function portfolioPhotoKey(photo: PortfolioPhoto) {
  return photo.id || photo.image_url;
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
