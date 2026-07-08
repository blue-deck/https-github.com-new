"use client";

import Image from "next/image";
import Link from "next/link";

type BlueDeckLogoLinkProps = {
  href?: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  label?: string;
};

type BlueDeckMarkProps = {
  className?: string;
  imageClassName?: string;
  priority?: boolean;
};

export function BlueDeckLogoLink({
  href = "/",
  className = "",
  imageClassName = "",
  priority = false,
  label = "BlueDeck home",
}: BlueDeckLogoLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`bd-focus inline-flex items-center overflow-hidden bg-transparent ${className}`}
    >
      <Image
        src="/bluedeck-logo-wide.png"
        alt="BlueDeck"
        width={980}
        height={551}
        priority={priority}
        className={`h-full w-full object-contain ${imageClassName}`}
      />
    </Link>
  );
}

export function BlueDeckMark({
  className = "",
  imageClassName = "",
  priority = false,
}: BlueDeckMarkProps) {
  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden bg-transparent ${className}`}
    >
      <Image
        src="/bluedeck-logo-mark.png"
        alt="BlueDeck"
        width={1024}
        height={1024}
        priority={priority}
        className={`h-full w-full object-contain ${imageClassName}`}
      />
    </span>
  );
}
