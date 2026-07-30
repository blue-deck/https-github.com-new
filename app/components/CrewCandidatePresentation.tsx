"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  Eye,
  FileText,
  Flag,
  Languages,
  LockKeyhole,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { EmployerJobApplicationDetails } from "../lib/jobApplications";

export type CrewCandidateCardProfile = {
  displayName: string;
  initials: string;
  profilePhotoUrl: string;
  currentPosition: string;
  nationality: string;
  experienceYears: number;
  premiumProfile: boolean;
};

export type CrewCandidateCardCopy = {
  nameLocked: string;
  crewMember: string;
  premium: string;
  nationality: string;
  notProvided: string;
  availableToStart: string;
  experience: string;
  lessThanOneYear: string;
  years: string;
  noExperience: string;
  viewProfile: string;
};

export type CrewCandidateProfileCopy = {
  gallery: string;
  galleryHelp: string;
  galleryPhoto: string;
  noGalleryPhotos: string;
  years: string;
  noExperience: string;
  experiences: string;
  references: string;
  documents: string;
  personalDetails: string;
  gender: string;
  height: string;
  weight: string;
  smoker: string;
  visibleTattoos: string;
  nationality: string;
  location: string;
  notProvided: string;
  professionalSummary: string;
  noProfessionalSummary: string;
  skillsCharacteristics: string;
  skillsHelp: string;
  skills: string;
  characteristics: string;
  seekingPositions: string;
  workPreferences: string;
  employmentTypes: string;
  preferredLocations: string;
  languages: string;
  noLanguages: string;
};

type CrewCandidateProfileDetails = Pick<
  EmployerJobApplicationDetails["candidate"],
  | "displayName"
  | "galleryPhotos"
  | "experienceYears"
  | "referenceCount"
  | "documentCount"
  | "gender"
  | "heightCm"
  | "weightKg"
  | "smoker"
  | "visibleTattoos"
  | "nationality"
  | "location"
  | "professionalSummary"
  | "skills"
  | "characteristics"
  | "seekingPositions"
  | "workPreferences"
  | "employmentTypes"
  | "preferredLocations"
  | "languages"
>;

export function CrewCandidatePassportCard({
  candidate,
  availabilityValue,
  primaryBadge,
  fourthFact,
  copy,
  profileHref,
  onView,
}: {
  candidate: CrewCandidateCardProfile;
  availabilityValue: string;
  primaryBadge: ReactNode;
  fourthFact: {
    icon: ReactNode;
    label: string;
    value: string;
  };
  copy: CrewCandidateCardCopy;
  profileHref?: string;
  onView?: () => void;
}) {
  const actionContent = (
    <>
      <span className="inline-flex items-center gap-2">
        <Eye className="h-4 w-4" aria-hidden />
        {copy.viewProfile}
      </span>
      <ArrowRight className="h-4 w-4" aria-hidden />
    </>
  );
  const actionClassName =
    "bd-focus mt-3 flex min-h-11 w-full items-center justify-between rounded-xl bg-[#071631] px-4 text-sm font-black text-white transition hover:bg-[#0d3e72]";

  return (
    <article className="group flex min-h-full flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.04] transition hover:border-cyan-300 hover:shadow-md hover:shadow-slate-950/[0.06]">
      <div className="h-1 bg-gradient-to-r from-[#071631] via-cyan-700 to-cyan-300" />
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3.5 sm:gap-4">
          <CandidateAvatar
            profilePhotoUrl={candidate.profilePhotoUrl}
            displayName={candidate.displayName}
            initials={candidate.initials}
            className="h-[72px] w-[72px] rounded-2xl border border-slate-200 bg-white shadow-sm sm:h-20 sm:w-20"
            textClassName="text-lg sm:text-xl"
            mediaSize={160}
          />

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5 pt-0.5">
              <h2
                data-i18n-ignore
                className="truncate text-lg font-semibold tracking-[-0.025em] text-[#071631] sm:text-xl"
                title={candidate.displayName}
              >
                {candidate.displayName}
              </h2>
              <LockKeyhole
                className="h-3.5 w-3.5 shrink-0 text-slate-400"
                aria-label={copy.nameLocked}
              />
            </div>
            <p
              data-i18n-ignore
              className="mt-1 truncate text-sm font-semibold text-cyan-800"
            >
              {candidate.currentPosition || copy.crewMember}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {primaryBadge}
              {candidate.premiumProfile ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-cyan-900">
                  <BadgeCheck className="h-3 w-3" aria-hidden />
                  {copy.premium}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-y border-slate-100 py-4 sm:grid-cols-4">
          <PassportFact
            icon={<Flag />}
            label={copy.nationality}
            value={candidate.nationality || copy.notProvided}
          />
          <PassportFact
            icon={<CalendarDays />}
            label={copy.availableToStart}
            value={availabilityValue || copy.notProvided}
          />
          <PassportFact
            icon={<BriefcaseBusiness />}
            label={copy.experience}
            value={
              candidate.experienceYears > 0
                ? candidate.experienceYears < 1
                  ? copy.lessThanOneYear
                  : `${candidate.experienceYears}+ ${copy.years}`
                : copy.noExperience
            }
          />
          <PassportFact
            icon={fourthFact.icon}
            label={fourthFact.label}
            value={fourthFact.value}
          />
        </dl>

        {profileHref ? (
          <Link href={profileHref} className={actionClassName}>
            {actionContent}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onView}
            className={actionClassName}
          >
            {actionContent}
          </button>
        )}
      </div>
    </article>
  );
}

export function CrewCandidateProfileIdentity({
  candidate,
  kicker,
  titleId,
  premiumLabel,
  headingLevel = "h1",
}: {
  candidate: Pick<
    EmployerJobApplicationDetails["candidate"],
    | "displayName"
    | "initials"
    | "profilePhotoUrl"
    | "currentPosition"
    | "premiumProfile"
  >;
  kicker: string;
  titleId: string;
  premiumLabel: string;
  headingLevel?: "h1" | "h2";
}) {
  const Heading = headingLevel;

  return (
    <div className="relative flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
      <CandidateAvatar
        profilePhotoUrl={candidate.profilePhotoUrl}
        displayName={candidate.displayName}
        initials={candidate.initials}
        className="h-24 w-24 rounded-full border-[5px] border-white shadow-xl shadow-black/25"
        textClassName="text-2xl"
      />
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">
          {kicker}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Heading
            id={titleId}
            data-i18n-ignore
            className="break-words text-3xl font-black uppercase tracking-[-0.035em] sm:text-4xl"
          >
            {candidate.displayName}
          </Heading>
          <LockKeyhole className="h-5 w-5 text-white/55" aria-hidden />
        </div>
        <p
          data-i18n-ignore
          className="mt-2 font-black uppercase tracking-[0.16em] text-cyan-100"
        >
          {candidate.currentPosition}
        </p>
        {candidate.premiumProfile ? (
          <PremiumBadge label={premiumLabel} dark />
        ) : null}
      </div>
    </div>
  );
}

export function CrewCandidateProfileBody({
  candidate,
  copy,
  children,
  sectionHeadingLevel = "h3",
}: {
  candidate: CrewCandidateProfileDetails;
  copy: CrewCandidateProfileCopy;
  children?: ReactNode;
  sectionHeadingLevel?: "h2" | "h3";
}) {
  return (
    <div className="space-y-6 p-4 sm:p-7 lg:p-8">
      <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <SectionHeading
          icon={<Camera />}
          title={copy.gallery}
          text={copy.galleryHelp}
          headingLevel={sectionHeadingLevel}
        />
        {candidate.galleryPhotos.length > 0 ? (
          <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            {candidate.galleryPhotos.map((photo, index) => (
              <GalleryPhoto
                key={photo}
                source={photo}
                alt={`${candidate.displayName} ${copy.galleryPhoto} ${index + 1}`}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
            {copy.noGalleryPhotos}
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <ProfileMetric
          icon={<BriefcaseBusiness />}
          value={
            candidate.experienceYears > 0
              ? `${candidate.experienceYears}+ ${copy.years}`
              : copy.noExperience
          }
          label={copy.experiences}
        />
        <ProfileMetric
          icon={<UsersRound />}
          value={candidate.referenceCount}
          label={copy.references}
        />
        <ProfileMetric
          icon={<FileText />}
          value={candidate.documentCount}
          label={copy.documents}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeading
            icon={<UserRound />}
            title={copy.personalDetails}
            headingLevel={sectionHeadingLevel}
          />
          <dl className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-2">
            <DetailFact
              label={copy.gender}
              value={candidate.gender}
              fallback={copy.notProvided}
            />
            <DetailFact
              label={copy.height}
              value={candidate.heightCm ? `${candidate.heightCm} cm` : ""}
              fallback={copy.notProvided}
            />
            <DetailFact
              label={copy.weight}
              value={candidate.weightKg ? `${candidate.weightKg} kg` : ""}
              fallback={copy.notProvided}
            />
            <DetailFact
              label={copy.smoker}
              value={candidate.smoker}
              fallback={copy.notProvided}
            />
            <DetailFact
              label={copy.visibleTattoos}
              value={candidate.visibleTattoos}
              fallback={copy.notProvided}
            />
            <DetailFact
              label={copy.nationality}
              value={candidate.nationality}
              fallback={copy.notProvided}
            />
            <DetailFact
              label={copy.location}
              value={candidate.location}
              fallback={copy.notProvided}
              wide
            />
          </dl>
        </section>

        <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeading
            icon={<FileText />}
            title={copy.professionalSummary}
            headingLevel={sectionHeadingLevel}
          />
          <p
            data-i18n-ignore
            className="mt-5 whitespace-pre-line text-sm leading-7 text-slate-600 sm:text-base"
          >
            {candidate.professionalSummary || copy.noProfessionalSummary}
          </p>
        </section>
      </div>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <SectionHeading
          icon={<BadgeCheck />}
          title={copy.skillsCharacteristics}
          text={copy.skillsHelp}
          headingLevel={sectionHeadingLevel}
        />
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <TagGroup
            label={copy.skills}
            items={candidate.skills}
            empty={copy.notProvided}
          />
          <TagGroup
            label={copy.characteristics}
            items={candidate.characteristics}
            empty={copy.notProvided}
          />
          <TagGroup
            label={copy.seekingPositions}
            items={candidate.seekingPositions}
            empty={copy.notProvided}
          />
          <TagGroup
            label={copy.workPreferences}
            items={candidate.workPreferences}
            empty={copy.notProvided}
          />
          <TagGroup
            label={copy.employmentTypes}
            items={candidate.employmentTypes}
            empty={copy.notProvided}
          />
          <TagGroup
            label={copy.preferredLocations}
            items={candidate.preferredLocations}
            empty={copy.notProvided}
          />
        </div>
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <SectionHeading
          icon={<Languages />}
          title={copy.languages}
          headingLevel={sectionHeadingLevel}
        />
        {candidate.languages.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {candidate.languages.map((item) => (
              <div
                key={`${item.name}-${item.level}`}
                data-i18n-ignore
                className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <span className="min-w-0 break-words font-black text-[#071631]">
                  {item.name}
                </span>
                <span className="max-w-[48%] shrink-0 break-words rounded-full bg-cyan-50 px-2.5 py-1 text-right text-[10px] font-black uppercase tracking-[0.1em] text-cyan-800">
                  {item.level}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-slate-500">{copy.noLanguages}</p>
        )}
      </section>

      {children}
    </div>
  );
}

export function CandidateAvatar({
  profilePhotoUrl,
  displayName,
  initials,
  className,
  textClassName,
  mediaSize = 420,
}: {
  profilePhotoUrl: string;
  displayName: string;
  initials: string;
  className: string;
  textClassName: string;
  mediaSize?: number;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [profilePhotoUrl]);

  if (profilePhotoUrl && !imageFailed) {
    return (
      <span
        className={`relative flex shrink-0 overflow-hidden bg-slate-100 ${className}`}
      >
        <img
          src={candidateMediaSource(profilePhotoUrl, mediaSize, mediaSize)}
          alt={displayName}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-[linear-gradient(145deg,#d8f8ff,#73bffc)] font-black text-[#071631] ${className} ${textClassName}`}
      role="img"
      aria-label={displayName}
    >
      {initials || "BD"}
    </span>
  );
}

export function PassportFact({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 shrink-0 text-cyan-800 [&>svg]:h-3.5 [&>svg]:w-3.5">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="truncate text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">
          {label}
        </dt>
        <dd
          data-i18n-ignore
          className="mt-0.5 truncate text-xs font-semibold text-[#071631]"
          title={value}
        >
          {value}
        </dd>
      </div>
    </div>
  );
}

export function PremiumBadge({
  label,
  dark = false,
}: {
  label: string;
  dark?: boolean;
}) {
  return (
    <span
      className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${
        dark
          ? "border-cyan-200/30 bg-cyan-200/10 text-cyan-100"
          : "border-cyan-200 bg-cyan-50 text-cyan-900"
      }`}
    >
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}

export function SectionHeading({
  icon,
  title,
  text,
  headingLevel = "h3",
}: {
  icon: ReactNode;
  title: string;
  text?: string;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;

  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#071631] text-cyan-100 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <div>
        <Heading className="text-lg font-black text-[#071631]">
          {title}
        </Heading>
        {text ? (
          <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
        ) : null}
      </div>
    </div>
  );
}

function GalleryPhoto({ source, alt }: { source: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="grid aspect-[4/3] place-items-center rounded-2xl bg-slate-100 text-slate-400">
        <Camera className="h-7 w-7" aria-hidden />
      </span>
    );
  }

  return (
    <span className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
      <img
        src={candidateMediaSource(source, 720, 540)}
        alt={alt}
        className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

function candidateMediaSource(source: string, width: number, height: number) {
  if (
    /^\/api\/employer\/job-posts\/[0-9a-f-]+\/applications\/[0-9a-f-]+\/media\?/i.test(
      source,
    ) ||
    /^\/api\/find-crew\/[a-z0-9_-]+\/media\?/i.test(source)
  ) {
    return source;
  }
  if (source.startsWith("https://")) return source;

  const search = new URLSearchParams({
    src: source,
    w: String(width),
    h: String(height),
    fit: "cover",
  });
  return `/api/cv-image?${search.toString()}`;
}

function ProfileMetric({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: number | string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-800 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <div>
        <p className="text-2xl font-black tabular-nums text-[#071631]">
          {value}
        </p>
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
          {label}
        </p>
      </div>
    </div>
  );
}

function DetailFact({
  label,
  value,
  fallback,
  wide = false,
}: {
  label: string;
  value: string;
  fallback: string;
  wide?: boolean;
}) {
  return (
    <div className={`min-w-0 bg-white p-4 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">
        {label}
      </dt>
      <dd
        data-i18n-ignore
        className="mt-1.5 break-words font-black text-[#071631]"
      >
        {value || fallback}
      </dd>
    </div>
  );
}

function TagGroup({
  label,
  items,
  empty,
}: {
  label: string;
  items: string[];
  empty: string;
}) {
  return (
    <div>
      <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-800">
        {label}
      </h4>
      {items.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              data-i18n-ignore
              className="max-w-full break-words rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-400">{empty}</p>
      )}
    </div>
  );
}
