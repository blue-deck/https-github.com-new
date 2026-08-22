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
import { useEffect, useId, useState, type ReactNode } from "react";
import { formatCrewExperienceDuration } from "../lib/crewExperience";
import type { EmployerJobApplicationDetails } from "../lib/jobApplications";
import { AccessibleImageLightbox } from "./AccessibleImageLightbox";

const crewExperienceLabels = {
  en: { yacht: "Yacht", other: "Other" },
  tr: { yacht: "Yat", other: "Diğer" },
} as const;

export type CrewCandidateCardProfile = {
  displayName: string;
  initials: string;
  profilePhotoUrl: string;
  currentPosition: string;
  nationality: string;
  experienceYears: number;
  yachtExperienceYears?: number;
  otherExperienceYears?: number;
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
  openGalleryPhoto: string;
  closeGalleryPhoto: string;
  noGalleryPhotos: string;
  years: string;
  lessThanOneYear: string;
  noExperience: string;
  experiences: string;
  references: string;
  documents: string;
  personalDetails: string;
  gender: string;
  maritalStatus: string;
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
  teamCouple?: string;
  teamCoupleConnected?: string;
  teamCoupleHelp?: string;
};

type CrewCandidateProfileDetails = Pick<
  EmployerJobApplicationDetails["candidate"],
  | "displayName"
  | "galleryPhotos"
  | "experienceYears"
  | "referenceCount"
  | "documentCount"
  | "gender"
  | "maritalStatus"
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
> & {
  hasTeamCouple?: boolean;
  yachtExperienceYears?: number;
  otherExperienceYears?: number;
};

type CrewCandidateProfileOverviewDetails = Pick<
  EmployerJobApplicationDetails["candidate"],
  | "displayName"
  | "initials"
  | "profilePhotoUrl"
  | "currentPosition"
  | "premiumProfile"
  | "experienceYears"
  | "referenceCount"
  | "professionalSummary"
> & {
  yachtExperienceYears?: number;
  otherExperienceYears?: number;
};

export function CrewCandidatePassportCard({
  candidate,
  availabilityValue,
  primaryBadge,
  fourthFact,
  copy,
  profileHref,
  onView,
  experienceLanguage = "en",
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
  experienceLanguage?: "en" | "tr";
}) {
  const titleId = useId();
  const actionLabel = `${copy.viewProfile}: ${candidate.displayName}`;
  const actionContent = (
    <>
      <span className="inline-flex items-center gap-2">
        <Eye className="h-5 w-5" aria-hidden />
        {copy.viewProfile}
      </span>
      <ArrowRight
        className="h-5 w-5 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
        aria-hidden
      />
    </>
  );
  const actionClassName =
    "bd-focus flex min-h-14 w-full items-center justify-between rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white shadow-[0_12px_28px_-18px_rgba(7,31,60,0.9)] transition hover:bg-cyan-800";

  return (
    <article
      aria-labelledby={titleId}
      className="group relative grid overflow-hidden rounded-[1.35rem] border border-slate-200/90 bg-white shadow-[0_18px_55px_-42px_rgba(7,31,60,0.48)] transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-[0_24px_70px_-42px_rgba(8,145,178,0.38)] focus-within:border-cyan-400 motion-reduce:transform-none lg:min-h-[190px] lg:grid-cols-[minmax(17rem,1fr)_minmax(24rem,1.55fr)_minmax(14rem,0.75fr)]"
    >
      <div className="flex min-w-0 items-center gap-4 px-5 py-6 sm:px-7 lg:border-r lg:border-slate-200 lg:px-7 lg:py-7 xl:px-8">
        <CandidateAvatar
          profilePhotoUrl={candidate.profilePhotoUrl}
          displayName={candidate.displayName}
          initials={candidate.initials}
          className="h-20 w-20 rounded-2xl border border-slate-200 bg-white shadow-sm sm:h-24 sm:w-24 lg:h-20 lg:w-20 xl:h-24 xl:w-24"
          textClassName="text-lg sm:text-xl"
          mediaSize={192}
          decorative
        />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-2">
            <h3
              id={titleId}
              data-i18n-ignore
              className="min-w-0 break-words text-xl font-semibold tracking-[-0.03em] text-[#071631] sm:text-2xl"
            >
              {candidate.displayName}
              <span className="sr-only"> — {copy.nameLocked}</span>
            </h3>
            <LockKeyhole
              className="mt-1 h-4 w-4 shrink-0 text-slate-400"
              aria-hidden
            />
          </div>
          <p
            data-i18n-ignore
            className="mt-1.5 break-words text-sm font-black leading-6 text-cyan-800"
          >
            {candidate.currentPosition || copy.crewMember}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {primaryBadge}
            {candidate.premiumProfile ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-cyan-900">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                {copy.premium}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <dl className="grid min-w-0 grid-cols-2 content-center gap-x-7 gap-y-5 border-t border-slate-200 px-5 py-6 sm:px-7 lg:border-t-0 lg:px-8 lg:py-7 xl:gap-x-10 xl:px-10">
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
          value={candidateExperienceValue(
            candidate,
            experienceLanguage,
            profileExperienceLabel(
              candidate.experienceYears,
              copy.years,
              copy.lessThanOneYear,
              copy.noExperience,
            ),
          )}
        />
        <PassportFact
          icon={fourthFact.icon}
          label={fourthFact.label}
          value={fourthFact.value}
        />
      </dl>

      <div className="flex min-w-0 flex-col justify-center border-t border-slate-200 px-5 py-6 sm:px-7 lg:border-l lg:border-t-0 lg:px-6 lg:py-7 xl:px-7">
        {profileHref ? (
          <Link
            href={profileHref}
            aria-label={actionLabel}
            className={actionClassName}
          >
            {actionContent}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onView}
            aria-label={actionLabel}
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

export function CrewCandidateEmployerProfileOverview({
  candidate,
  copy,
  kicker,
  titleId,
  premiumLabel,
  roleFallback,
  headingLevel = "h2",
  reserveTrailingActionSpace = true,
  experienceLanguage = "en",
}: {
  candidate: CrewCandidateProfileOverviewDetails;
  copy: CrewCandidateProfileCopy;
  kicker: string;
  titleId: string;
  premiumLabel: string;
  roleFallback: string;
  headingLevel?: "h1" | "h2";
  reserveTrailingActionSpace?: boolean;
  experienceLanguage?: "en" | "tr";
}) {
  const Heading = headingLevel;
  const summaryHeadingLevel = headingLevel === "h1" ? "h2" : "h3";
  const experienceValue = candidateExperienceValue(
    candidate,
    experienceLanguage,
    profileExperienceLabel(
      candidate.experienceYears,
      copy.years,
      copy.lessThanOneYear,
      copy.noExperience,
    ),
    true,
  );

  return (
    <section className="grid overflow-hidden border-b border-slate-200 bg-white lg:grid-cols-2">
      <div className="relative isolate flex min-h-[248px] overflow-hidden bg-[radial-gradient(circle_at_14%_8%,rgba(34,211,238,0.15),transparent_34%),linear-gradient(132deg,#031126,#071631_56%,#0d254f)] text-white sm:min-h-[290px] lg:min-h-[340px] lg:border-r lg:border-cyan-900/10">
        <BlueDeckYachtBlueprint />
        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <div
            className={`flex min-w-0 flex-1 items-center gap-3 px-4 py-5 min-[390px]:gap-4 sm:gap-6 sm:px-7 sm:py-7 xl:px-8 ${reserveTrailingActionSpace ? "pr-14 sm:pr-7" : ""}`}
          >
            <CandidateAvatar
              profilePhotoUrl={candidate.profilePhotoUrl}
              displayName={candidate.displayName}
              initials={candidate.initials}
              className="h-20 w-20 rounded-full border-[3px] border-[#071631] ring-2 ring-cyan-200/70 ring-offset-2 ring-offset-[#071631] shadow-xl shadow-black/30 min-[390px]:h-[92px] min-[390px]:w-[92px] sm:h-28 sm:w-28 xl:h-32 xl:w-32"
              textClassName="text-xl sm:text-2xl"
              mediaSize={320}
              eager
            />

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2.5">
                <p className="min-w-0 text-[9px] font-black uppercase tracking-[0.2em] text-cyan-200 sm:text-[10px] sm:tracking-[0.24em]">
                  {kicker}
                </p>
                {candidate.premiumProfile ? (
                  <span
                    className="inline-flex shrink-0 text-cyan-100"
                    title={premiumLabel}
                  >
                    <BadgeCheck className="h-[18px] w-[18px] sm:h-5 sm:w-5" aria-hidden />
                    <span className="sr-only">{premiumLabel}</span>
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex min-w-0 items-start gap-2 sm:mt-4 sm:gap-3">
                <Heading
                  id={titleId}
                  data-i18n-ignore
                  className="min-w-0 break-words text-[clamp(1.45rem,7vw,2.25rem)] font-black uppercase leading-[0.98] tracking-[-0.045em] sm:text-4xl lg:text-[2rem] xl:text-[2.55rem]"
                >
                  {candidate.displayName}
                </Heading>
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-white/55 sm:h-5 sm:w-5" aria-hidden />
              </div>

              <p
                data-i18n-ignore
                className="mt-4 inline-flex max-w-full break-words rounded-full border border-cyan-200/75 px-3.5 py-1.5 text-left text-[10px] font-black uppercase leading-4 tracking-[0.16em] text-cyan-100 sm:px-4 sm:text-xs"
              >
                {candidate.currentPosition || roleFallback}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 border-t border-cyan-100/30 bg-[#020f22]/20">
            <EmployerHeroMetric
              label={copy.experiences}
              value={experienceValue}
            />
            <EmployerHeroMetric
              label={copy.references}
              value={candidate.referenceCount}
              divided
            />
          </dl>
        </div>
      </div>

      <div
        className={`flex min-w-0 flex-col justify-center bg-[linear-gradient(145deg,#ffffff,#f4f9fb)] px-5 py-6 sm:px-8 sm:py-8 lg:min-h-[340px] ${reserveTrailingActionSpace ? "lg:pr-20 xl:px-10 xl:pr-20" : "lg:px-8 xl:px-10"}`}
      >
        <SectionHeading
          icon={<FileText />}
          title={copy.professionalSummary}
          headingLevel={summaryHeadingLevel}
          compact
        />
        <p
          data-i18n-ignore
          className="mt-4 max-w-[68ch] whitespace-pre-line break-words text-sm leading-7 text-slate-600 [overflow-wrap:anywhere] sm:text-[15px]"
        >
          {candidate.professionalSummary || copy.noProfessionalSummary}
        </p>
      </div>
    </section>
  );
}

export function CrewCandidateProfileBody({
  candidate,
  copy,
  children,
  variant = "default",
  sectionHeadingLevel = "h3",
  experienceLanguage = "en",
}: {
  candidate: CrewCandidateProfileDetails;
  copy: CrewCandidateProfileCopy;
  children?: ReactNode;
  variant?: "default" | "employer" | "public";
  sectionHeadingLevel?: "h2" | "h3";
  experienceLanguage?: "en" | "tr";
}) {
  const [activeGalleryPhoto, setActiveGalleryPhoto] = useState<{
    source: string;
    alt: string;
    index: number;
  } | null>(null);

  const compactVariant = variant !== "default";
  const tagGroupHeadingLevel = sectionHeadingLevel === "h2" ? "h3" : "h4";
  const sectionClassName = compactVariant
    ? "overflow-hidden rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_18px_46px_-40px_rgba(7,31,60,0.55)] sm:p-5"
    : "overflow-hidden rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6";

  const gallerySection = (
    <section className={sectionClassName}>
      <SectionHeading
        icon={<Camera />}
        title={copy.gallery}
        text={copy.galleryHelp}
        headingLevel={sectionHeadingLevel}
        compact={compactVariant}
      />
      {candidate.galleryPhotos.length > 0 ? (
        <div
          className={`${compactVariant ? "mt-4" : "mt-5"} grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4`}
        >
          {candidate.galleryPhotos.map((photo, index) => (
            <GalleryPhoto
              key={`${photo}-${index}`}
              source={photo}
              alt={`${candidate.displayName} ${copy.galleryPhoto} ${index + 1} / ${candidate.galleryPhotos.length}`}
              openLabel={`${copy.openGalleryPhoto} ${index + 1} / ${candidate.galleryPhotos.length}`}
              onOpen={() =>
                setActiveGalleryPhoto({
                  source: photo,
                  alt: `${candidate.displayName} ${copy.galleryPhoto} ${index + 1} / ${candidate.galleryPhotos.length}`,
                  index,
                })
              }
            />
          ))}
        </div>
      ) : (
        <div
          className={`${compactVariant ? "mt-4 py-6" : "mt-5 py-10"} rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 text-center text-sm text-slate-500`}
        >
          {copy.noGalleryPhotos}
        </div>
      )}
    </section>
  );

  const galleryLightbox = activeGalleryPhoto ? (
    <AccessibleImageLightbox
      source={candidateMediaSource(activeGalleryPhoto.source, 1600, 1200)}
      imageAlt={activeGalleryPhoto.alt}
      dialogLabel={`${copy.gallery}: ${activeGalleryPhoto.index + 1} / ${candidate.galleryPhotos.length}`}
      closeLabel={copy.closeGalleryPhoto}
      onClose={() => setActiveGalleryPhoto(null)}
    />
  ) : null;

  const personalDetailsSection = (
    <section className={sectionClassName}>
      <SectionHeading
        icon={<UserRound />}
        title={copy.personalDetails}
        headingLevel={sectionHeadingLevel}
        compact={compactVariant}
      />
      <dl
        className={`${compactVariant ? "mt-4 grid-cols-2 sm:grid-cols-4" : "mt-5 sm:grid-cols-2"} grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200`}
      >
        <DetailFact
          label={copy.gender}
          value={candidate.gender}
          fallback={copy.notProvided}
          compact={compactVariant}
        />
        <DetailFact
          label={copy.maritalStatus}
          value={candidate.maritalStatus}
          fallback={copy.notProvided}
          compact={compactVariant}
        />
        <DetailFact
          label={copy.height}
          value={candidate.heightCm ? `${candidate.heightCm} cm` : ""}
          fallback={copy.notProvided}
          compact={compactVariant}
        />
        <DetailFact
          label={copy.weight}
          value={candidate.weightKg ? `${candidate.weightKg} kg` : ""}
          fallback={copy.notProvided}
          compact={compactVariant}
        />
        <DetailFact
          label={copy.smoker}
          value={candidate.smoker}
          fallback={copy.notProvided}
          compact={compactVariant}
        />
        <DetailFact
          label={copy.visibleTattoos}
          value={candidate.visibleTattoos}
          fallback={copy.notProvided}
          compact={compactVariant}
        />
        <DetailFact
          label={copy.nationality}
          value={candidate.nationality}
          fallback={copy.notProvided}
          compact={compactVariant}
        />
        <DetailFact
          label={copy.location}
          value={candidate.location}
          fallback={copy.notProvided}
          compact={compactVariant}
        />
      </dl>
      {candidate.hasTeamCouple &&
      copy.teamCouple &&
      copy.teamCoupleConnected &&
      copy.teamCoupleHelp ? (
        <div
          className={`${compactVariant ? "mt-4" : "mt-5"} flex items-start gap-3 rounded-2xl border border-cyan-200 bg-[linear-gradient(135deg,#ecfeff,#f8fafc)] p-4 shadow-[0_14px_34px_-30px_rgba(8,145,178,0.75)]`}
        >
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-800 text-white shadow-sm">
            <UsersRound className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-800">
              {copy.teamCouple}
            </p>
            <p className="mt-1 text-sm font-black text-[#071631]">
              {copy.teamCoupleConnected}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {copy.teamCoupleHelp}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );

  const professionalSummarySection = (
    <section className={sectionClassName}>
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
  );

  const skillsSection = (
    <section className={sectionClassName}>
      <SectionHeading
        icon={<BadgeCheck />}
        title={copy.skillsCharacteristics}
        text={copy.skillsHelp}
        headingLevel={sectionHeadingLevel}
        compact={compactVariant}
      />
      <div
        className={`${compactVariant ? "mt-4 gap-4 xl:grid-cols-3" : "mt-5 gap-5"} grid md:grid-cols-2`}
      >
        <TagGroup
          label={copy.skills}
          items={candidate.skills}
          empty={copy.notProvided}
          compact={compactVariant}
          headingLevel={tagGroupHeadingLevel}
        />
        <TagGroup
          label={copy.characteristics}
          items={candidate.characteristics}
          empty={copy.notProvided}
          compact={compactVariant}
          headingLevel={tagGroupHeadingLevel}
        />
        <TagGroup
          label={copy.seekingPositions}
          items={candidate.seekingPositions}
          empty={copy.notProvided}
          compact={compactVariant}
          headingLevel={tagGroupHeadingLevel}
        />
        <TagGroup
          label={copy.workPreferences}
          items={candidate.workPreferences}
          empty={copy.notProvided}
          compact={compactVariant}
          headingLevel={tagGroupHeadingLevel}
        />
        <TagGroup
          label={copy.employmentTypes}
          items={candidate.employmentTypes}
          empty={copy.notProvided}
          compact={compactVariant}
          headingLevel={tagGroupHeadingLevel}
        />
        <TagGroup
          label={copy.preferredLocations}
          items={candidate.preferredLocations}
          empty={copy.notProvided}
          compact={compactVariant}
          headingLevel={tagGroupHeadingLevel}
        />
      </div>
    </section>
  );

  const languagesSection = (
    <section className={sectionClassName}>
      <SectionHeading
        icon={<Languages />}
        title={copy.languages}
        headingLevel={sectionHeadingLevel}
        compact={compactVariant}
      />
      {candidate.languages.length > 0 ? (
        <ul
          className={`${compactVariant ? "mt-4 gap-2" : "mt-5 gap-3"} grid sm:grid-cols-2 lg:grid-cols-3`}
        >
          {candidate.languages.map((item, index) => (
            <li
              key={`${item.name}-${item.level}-${index}`}
              data-i18n-ignore
              className={`flex min-w-0 items-center justify-between gap-3 border border-slate-200 bg-slate-50 ${compactVariant ? "rounded-xl px-3 py-2.5" : "rounded-2xl px-4 py-3"}`}
            >
              <span className="min-w-0 break-words font-black text-[#071631]">
                {item.name}
              </span>
              {item.level ? (
                <span className="max-w-[48%] shrink-0 break-words rounded-full bg-cyan-50 px-2.5 py-1 text-right text-[10px] font-black uppercase tracking-[0.1em] text-cyan-800">
                  {item.level}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p
          className={`${compactVariant ? "mt-4" : "mt-5"} text-sm text-slate-500`}
        >
          {copy.noLanguages}
        </p>
      )}
    </section>
  );

  if (compactVariant) {
    return (
      <div className="space-y-4 p-3 sm:p-5 lg:p-6">
        {gallerySection}
        {galleryLightbox}
        {personalDetailsSection}
        {languagesSection}
        {skillsSection}
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-7 lg:p-8">
      {gallerySection}
      {galleryLightbox}

      <section className="grid gap-3 sm:grid-cols-3">
        <ProfileMetric
          icon={<BriefcaseBusiness />}
          value={candidateExperienceValue(
            candidate,
            experienceLanguage,
            profileExperienceLabel(
              candidate.experienceYears,
              copy.years,
              copy.lessThanOneYear,
              copy.noExperience,
            ),
            true,
          )}
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
        {personalDetailsSection}
        {professionalSummarySection}
      </div>

      {skillsSection}
      {languagesSection}

      {children}
    </div>
  );
}

function profileExperienceLabel(
  experienceYears: number,
  yearsLabel: string,
  lessThanOneYearLabel: string,
  noExperienceLabel: string,
) {
  if (experienceYears <= 0) return noExperienceLabel;
  if (experienceYears < 1) return lessThanOneYearLabel;
  return `${Math.floor(experienceYears)}+ ${yearsLabel}`;
}

function candidateExperienceValue(
  candidate: {
    yachtExperienceYears?: number;
    otherExperienceYears?: number;
  },
  language: "en" | "tr",
  fallback: string,
  prominent = false,
) {
  const yachtExperienceYears = isCrewExperienceYears(
    candidate.yachtExperienceYears,
  )
    ? candidate.yachtExperienceYears
    : null;
  const otherExperienceYears = isCrewExperienceYears(
    candidate.otherExperienceYears,
  )
    ? candidate.otherExperienceYears
    : null;
  if (yachtExperienceYears === null && otherExperienceYears === null) {
    return fallback;
  }

  const labels = crewExperienceLabels[language];
  const lines = [
    yachtExperienceYears !== null && yachtExperienceYears > 0
      ? `${labels.yacht} — ${formatCrewExperienceDuration(yachtExperienceYears, language)}`
      : "",
    otherExperienceYears !== null && otherExperienceYears > 0
      ? `${labels.other} — ${formatCrewExperienceDuration(otherExperienceYears, language)}`
      : "",
  ].filter(Boolean);

  if (lines.length === 0) {
    return formatCrewExperienceDuration(0, language);
  }

  return (
    <span
      className={`block space-y-0.5 normal-case tracking-normal ${prominent ? "text-sm font-black leading-5 sm:text-base" : "text-sm font-semibold leading-5"}`}
    >
      {lines.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </span>
  );
}

function isCrewExperienceYears(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function CandidateAvatar({
  profilePhotoUrl,
  displayName,
  initials,
  className,
  textClassName,
  mediaSize = 420,
  decorative = false,
  eager = false,
}: {
  profilePhotoUrl: string;
  displayName: string;
  initials: string;
  className: string;
  textClassName: string;
  mediaSize?: number;
  decorative?: boolean;
  eager?: boolean;
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
          alt={decorative ? "" : `${displayName} profile photo`}
          className="h-full w-full object-cover"
          loading={eager ? "eager" : "lazy"}
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
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : `${displayName} profile placeholder`}
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
  value: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex min-w-0 items-start gap-2 text-[10px] font-black uppercase leading-4 tracking-[0.1em] text-slate-500 sm:text-[11px]">
        <span
          className="mt-px shrink-0 text-cyan-800 [&>svg]:h-4 [&>svg]:w-4"
          aria-hidden
        >
          {icon}
        </span>
        <span className="min-w-0 break-words">
          {label}
        </span>
      </dt>
      <dd
        data-i18n-ignore
        className="mt-1 break-words pl-6 text-sm font-semibold leading-5 text-[#071631]"
      >
        {value}
      </dd>
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
  compact = false,
  headingLevel = "h3",
}: {
  icon: ReactNode;
  title: string;
  text?: string;
  compact?: boolean;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;

  return (
    <div className={`flex items-start ${compact ? "gap-2.5" : "gap-3"}`}>
      <span
        className={`flex shrink-0 items-center justify-center bg-[#071631] text-cyan-100 ${compact ? "h-9 w-9 rounded-[10px] [&>svg]:h-4 [&>svg]:w-4" : "h-10 w-10 rounded-xl [&>svg]:h-5 [&>svg]:w-5"}`}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0">
        <Heading
          className={`${compact ? "text-base" : "text-lg"} break-words font-black text-[#071631] [overflow-wrap:anywhere]`}
        >
          {title}
        </Heading>
        {text ? (
          <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
        ) : null}
      </div>
    </div>
  );
}

function GalleryPhoto({
  source,
  alt,
  openLabel,
  onOpen,
}: {
  source: string;
  alt: string;
  openLabel: string;
  onOpen: () => void;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className="grid aspect-[4/3] place-items-center rounded-2xl bg-slate-100 text-slate-400"
        role="img"
        aria-label={alt}
      >
        <Camera className="h-7 w-7" aria-hidden />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="bd-focus group relative aspect-[4/3] cursor-pointer overflow-hidden rounded-2xl bg-slate-100"
      aria-label={openLabel}
      aria-haspopup="dialog"
    >
      <img
        src={candidateMediaSource(source, 720, 540)}
        alt={alt}
        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </button>
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
  value: ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-800 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <div>
        <div className="text-2xl font-black tabular-nums text-[#071631]">
          {value}
        </div>
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
  compact = false,
}: {
  label: string;
  value: string;
  fallback: string;
  compact?: boolean;
}) {
  return (
    <div className={`min-w-0 bg-white ${compact ? "p-3" : "p-4"}`}>
      <dt className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">
        {label}
      </dt>
      <dd
        data-i18n-ignore
        className={`${compact ? "mt-1 text-sm font-semibold" : "mt-1.5 font-black"} break-words text-[#071631]`}
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
  compact = false,
  headingLevel = "h4",
}: {
  label: string;
  items: string[];
  empty: string;
  compact?: boolean;
  headingLevel?: "h3" | "h4";
}) {
  const Heading = headingLevel;

  return (
    <div>
      <Heading className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-800">
        {label}
      </Heading>
      {items.length > 0 ? (
        <ul
          className={`${compact ? "mt-2 gap-1.5" : "mt-2.5 gap-2"} flex flex-wrap`}
        >
          {items.map((item, index) => (
            <li
              key={`${item}-${index}`}
              data-i18n-ignore
              className={`max-w-full break-words rounded-full border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 ${compact ? "px-2.5 py-1" : "px-3 py-1.5"}`}
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-400">{empty}</p>
      )}
    </div>
  );
}

function EmployerHeroMetric({
  label,
  value,
  divided = false,
}: {
  label: string;
  value: ReactNode;
  divided?: boolean;
}) {
  return (
    <div
      className={`min-w-0 px-5 py-4 sm:px-7 ${divided ? "border-l border-cyan-100/30" : ""}`}
    >
      <dt className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-200 sm:text-[10px]">
        {label}
      </dt>
      <dd
        data-i18n-ignore
        className="mt-1 break-words text-lg font-semibold uppercase tracking-[0.06em] tabular-nums text-white sm:text-xl"
      >
        {value}
      </dd>
    </div>
  );
}

function BlueDeckYachtBlueprint() {
  return (
    <svg
      viewBox="0 0 320 800"
      fill="none"
      className="pointer-events-none absolute -right-[22%] -top-[32%] h-[160%] w-[78%] rotate-[18deg] text-cyan-100 opacity-[0.075]"
      aria-hidden
    >
      <g stroke="currentColor" strokeWidth="2">
        <path d="M160 18C116 43 82 102 70 180L42 610c-5 78 40 142 118 169 78-27 123-91 118-169l-28-430C238 102 204 43 160 18Z" />
        <path d="M160 48c-31 24-54 71-62 131L74 594c-4 64 25 116 86 150 61-34 90-86 86-150l-24-415c-8-60-31-107-62-131Z" />
        <path d="M101 174c38-18 80-18 118 0l-8 111c-32 18-70 18-102 0l-8-111Z" />
        <path d="M104 310h112l7 132c-39 22-87 22-126 0l7-132Z" />
        <path d="M95 468c43 19 87 19 130 0l8 139c-45 28-101 28-146 0l8-139Z" />
        <path d="M112 630c32 16 64 16 96 0l13 55c-38 24-84 24-122 0l13-55Z" />
        <path d="M119 103h82M111 132h98M100 214h120M96 252h128M100 351h120M96 399h128M93 520h134M90 566h140" />
        <path d="M125 187h28v58h-28zM167 187h28v58h-28zM122 329h76v78h-76zM112 489h96v80h-96z" />
        <path d="M160 48v72M160 285v25M160 442v26M160 607v23" />
        <path d="M80 194 58 604M240 194l22 410M89 628l-20 17M231 628l20 17" strokeDasharray="8 10" />
      </g>
    </svg>
  );
}
