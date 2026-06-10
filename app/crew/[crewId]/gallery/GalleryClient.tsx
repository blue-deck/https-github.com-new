"use client";

import { useState } from "react";
import { X } from "lucide-react";

export type PublicGalleryPhoto = {
  id: string;
  imageUrl: string;
};

export function PublicCrewGallery({
  photos,
  crewName,
}: {
  photos: PublicGalleryPhoto[];
  crewName: string;
}) {
  const [activePhoto, setActivePhoto] = useState<PublicGalleryPhoto | null>(null);

  return (
    <>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:grid-cols-4">
        {photos.map((photo) => (
          <button
            key={photo.id || photo.imageUrl}
            type="button"
            onClick={() => setActivePhoto(photo)}
            className="group aspect-square cursor-pointer overflow-hidden bg-[#edf5f7] outline-none ring-0 transition focus-visible:ring-4 focus-visible:ring-cyan-200"
            aria-label={`Open ${crewName} gallery photo`}
          >
            <img
              src={photo.imageUrl}
              alt={`${crewName} yacht work photo`}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.035]"
            />
          </button>
        ))}
      </div>

      {photos.length === 0 && (
        <div className="rounded-3xl border border-dashed border-cyan-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#2d7482]">Photo gallery</p>
          <p className="mt-2 text-lg font-black text-[#06111f]">No public photos yet</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            This crew member has not added yacht work photos to BlueDeck yet.
          </p>
        </div>
      )}

      {activePhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#06111f]/62 p-4 backdrop-blur-sm"
          onMouseDown={() => setActivePhoto(null)}
        >
          <div
            className="relative w-[min(760px,88vw)] rounded-[28px] bg-white p-3 shadow-2xl shadow-slate-950/35"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActivePhoto(null)}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-[#06111f] shadow-lg shadow-slate-950/20 transition hover:bg-cyan-50"
              aria-label="Close photo preview"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={activePhoto.imageUrl}
              alt={`${crewName} yacht work photo preview`}
              className="max-h-[72vh] w-full rounded-[22px] object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
