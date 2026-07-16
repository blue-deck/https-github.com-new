"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useState } from "react";
import {
  galleryPreviewQuality,
  galleryThumbnailQuality,
  isSupabaseStorageImageUrl,
  parseSupabaseStorageObjectUrl,
  supabaseContainedImageLoader,
  supabaseSquareImageLoader,
} from "../lib/imageDelivery";
import { supabase } from "../lib/supabase";

type OptimizedSupabaseImageProps = Omit<ImageProps, "loader" | "quality" | "src" | "unoptimized"> & {
  src: string;
  delivery?: "square" | "contained";
  quality?: number;
};

export function OptimizedSupabaseImage({
  src,
  alt,
  delivery = "contained",
  quality,
  ...props
}: OptimizedSupabaseImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState(src);
  const resolvedObject = parseSupabaseStorageObjectUrl(resolvedSrc);
  const canTransform =
    isSupabaseStorageImageUrl(resolvedSrc) && !resolvedObject?.isPrivate;
  const resolvedQuality =
    quality || (delivery === "square" ? galleryThumbnailQuality : galleryPreviewQuality);

  useEffect(() => {
    let active = true;
    const object = parseSupabaseStorageObjectUrl(src);

    if (!object?.isPrivate) {
      setResolvedSrc(src);
      return () => {
        active = false;
      };
    }

    const { bucket, path } = object;

    async function signPrivateImage() {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60 * 6);

      if (active) {
        setResolvedSrc(!error && data?.signedUrl ? data.signedUrl : src);
      }
    }

    void signPrivateImage();
    return () => {
      active = false;
    };
  }, [src]);

  return (
    <Image
      {...props}
      src={resolvedSrc}
      alt={alt}
      loader={
        canTransform
          ? delivery === "square"
            ? supabaseSquareImageLoader
            : supabaseContainedImageLoader
          : undefined
      }
      quality={resolvedQuality}
      unoptimized={!canTransform}
    />
  );
}
