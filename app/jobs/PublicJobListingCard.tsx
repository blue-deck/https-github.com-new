"use client";

import Link from "next/link";
import styles from "./PublicJobListingCard.module.css";
import {
  Anchor,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  MapPin,
  Ruler,
  Ship,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import {
  formatJobEmploymentType,
  formatJobTeamCoupleAnswer,
  formatJobYachtLength,
  formatJobYachtProgram,
  formatJobYachtType,
  isJobTeamCouple,
} from "../lib/jobPosts";
import { formatJobDate, formatJobSalary, type PublicJobCard } from "./job-data";
import { getJobListingAction, type JobListingViewer } from "./JobListingAction";

export function PublicJobListingCard({
  job,
  language,
  viewer,
  compact = false,
}: {
  job: PublicJobCard;
  language: "en" | "tr";
  viewer: JobListingViewer;
  compact?: boolean;
}) {
  const c = cardCopy[language];
  const salary = formatJobSalary(job.salary, language);
  const yachtType = job.yachtType
    ? formatJobYachtType(job.yachtType, language)
    : "";
  const yachtProgram = job.yachtProgram
    ? formatJobYachtProgram(job.yachtProgram, language)
    : "";
  const yachtLength =
    job.yachtLength !== null && job.yachtLengthUnit
      ? formatJobYachtLength(job.yachtLength, job.yachtLengthUnit, language)
      : "";
  const action = getJobListingAction(job.id, viewer, language);
  const titleId = `job-title-${job.id}`;
  const teamCouple = isJobTeamCouple(job.candidateType)
    ? `${c.teamCouple}: ${formatJobTeamCoupleAnswer(job.candidateType, language)}`
    : "";

  return (
    <article
      aria-labelledby={titleId}
      data-job-card-layout="navy-ticket"
      data-compact={compact}
      className={styles.card}
    >
      <div className={styles.header}>
        <div className={styles.headline}>
          <h3 id={titleId} data-i18n-ignore className={styles.title}>
            {job.position}
          </h3>
          <p data-i18n-ignore className={styles.salary}>
            {salary || c.salaryNotSpecified}
          </p>
        </div>

        <div className={styles.meta}>
          <MetaLine
            icon={<BriefcaseBusiness />}
            value={formatJobEmploymentType(job.employmentType, language)}
            variant="employment"
          />
          <MetaLine
            icon={<MapPin />}
            value={job.location}
            variant="location"
          />
          <MetaLine
            icon={<Clock3 />}
            value={`${c.posted}: ${formatJobDate(job.publishedAt, language)}`}
            variant="posted"
          />
        </div>
      </div>

      <div className={styles.details}>
        <InfoLine icon={<Ship />} value={yachtType || c.notSpecified} field="type" />
        <InfoLine icon={<Ruler />} value={yachtLength || c.notSpecified} field="length" />
        {teamCouple ? (
          <InfoLine
            icon={<UsersRound />}
            value={teamCouple}
            field="team"
          />
        ) : null}
        {yachtProgram ? (
          <InfoLine
            icon={<Anchor />}
            value={yachtProgram}
            field="program"
          />
        ) : null}
        <InfoLine
          icon={<CalendarDays />}
          value={`${c.start}: ${
            job.startDate
              ? formatJobDate(job.startDate, language)
              : c.notSpecified
          }`}
          field="start"
        />
      </div>

      <div className={styles.actions} data-single-action={action.intent === "view"}>
        <Link href={action.detailHref} className={`bd-focus ${styles.primaryAction}`}>
          <span>{c.viewRole}</span>
          <ArrowRight aria-hidden />
        </Link>
        {action.intent !== "view" ? (
          <Link href={action.href} className={`bd-focus ${styles.secondaryAction}`}>
            {action.intent === "signup" ? <UserRoundPlus aria-hidden /> : null}
            <span>{action.label}</span>
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function PublicJobListingSkeleton({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className={`${styles.card} ${styles.skeleton}`} data-compact={compact} aria-hidden="true">
      <div className={styles.header}>
        <div className={styles.headline}>
          <div className={styles.titlePlaceholder} />
          <div className={styles.salaryPlaceholder} />
        </div>
        <div className={styles.meta}>
          {["employment", "location", "posted"].map((item) => (
            <div className={styles.metaPlaceholder} key={item} />
          ))}
        </div>
      </div>
      <div className={styles.details}>
        {["type", "length", "team", "program", "start"].map((field) => (
          <div className={styles.info} data-field={field} key={field}>
            <div className={styles.iconPlaceholder} />
            <div className={styles.valuePlaceholder} />
          </div>
        ))}
      </div>
      <div className={styles.actions}>
        <div className={styles.actionPlaceholder} />
        <div className={styles.actionPlaceholder} />
      </div>
    </div>
  );
}

function MetaLine({
  icon,
  value,
  variant,
}: {
  icon: React.ReactNode;
  value: string;
  variant: "employment" | "location" | "posted";
}) {
  return (
    <p data-i18n-ignore className={styles.metaItem} data-variant={variant}>
      <span className={styles.metaIcon}>{icon}</span>
      <span className={styles.metaValue}>{value}</span>
    </p>
  );
}

function InfoLine({
  icon,
  value,
  field,
}: {
  icon: React.ReactNode;
  value: string;
  field: "type" | "length" | "team" | "program" | "start";
}) {
  return (
    <p data-i18n-ignore className={styles.info} data-field={field}>
      <span className={styles.infoIcon}>{icon}</span>
      <span className={styles.infoValue}>{value}</span>
    </p>
  );
}

const cardCopy = {
  en: {
    teamCouple: "Team/Couple",
    start: "Start",
    posted: "Posted",
    notSpecified: "Not specified",
    salaryNotSpecified: "Salary not specified",
    viewRole: "View role details",
  },
  tr: {
    teamCouple: "Team/Couple",
    start: "Başlangıç",
    posted: "Yayınlandı",
    notSpecified: "Belirtilmedi",
    salaryNotSpecified: "Maaş belirtilmedi",
    viewRole: "İlan detaylarını görüntüle",
  },
} as const;
