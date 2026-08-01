"use client";

import { useState } from "react";
import { AccessibleImageLightbox } from "../../../components/AccessibleImageLightbox";

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
  const [activePhoto, setActivePhoto] = useState<{
    photo: PublicGalleryPhoto;
    index: number;
  } | null>(null);

  return (
    <>
      <ul
        className="grid grid-cols-3 gap-1.5 sm:gap-2 md:grid-cols-4"
        aria-label={`${crewName} photo gallery`}
      >
        {photos.map((photo, index) => (
          <li key={photo.id || photo.imageUrl}>
            <button
              type="button"
              onClick={() => setActivePhoto({ photo, index })}
              className="group block aspect-square w-full cursor-pointer overflow-hidden bg-[#edf5f7] outline-none ring-0 transition focus-visible:ring-4 focus-visible:ring-cyan-200"
              aria-label={`Open photo ${index + 1} of ${photos.length} in ${crewName}'s gallery`}
              aria-haspopup="dialog"
            >
              <img
                src={photo.imageUrl}
                alt={`${crewName} yacht work gallery photo ${index + 1} of ${photos.length}`}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.035]"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            </button>
          </li>
        ))}
      </ul>

      {photos.length === 0 && (
        <div className="rounded-3xl border border-dashed border-cyan-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#2d7482]">Photo gallery</p>
          <p className="mt-2 text-lg font-black text-[#06111f]">No public photos yet</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            This crew member has not added yacht work photos to BlueDeck yet.
          </p>
        </div>
      )}

      {activePhoto ? (
        <AccessibleImageLightbox
          source={activePhoto.photo.imageUrl}
          imageAlt={`${crewName} yacht work gallery photo ${activePhoto.index + 1} of ${photos.length}`}
          dialogLabel={`${crewName} photo ${activePhoto.index + 1} of ${photos.length}`}
          closeLabel="Close photo preview"
          onClose={() => setActivePhoto(null)}
        />
      ) : null}
    </>
  );
}
