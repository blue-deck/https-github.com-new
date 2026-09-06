"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./PublicJobListingCard.module.css";
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
  appearance = "default",
}: {
  job: PublicJobCard;
  language: "en" | "tr";
  viewer: JobListingViewer;
  compact?: boolean;
  appearance?: "default" | "homepage";
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
    ? formatJobTeamCoupleAnswer(job.candidateType, language)
    : "";

  return (
    <article
      aria-labelledby={titleId}
      data-job-card-layout="compact-porcelain"
      data-compact={compact}
      data-appearance={appearance}
      className={styles.card}
    >
      <div className={styles.layout}>
        <div className={styles.header}>
          <h3 id={titleId} data-i18n-ignore className={styles.title}>
            {job.position}
          </h3>
          <p data-i18n-ignore className={styles.salary}>
            {salary || c.salaryNotSpecified}
          </p>
          <p data-i18n-ignore className={styles.meta}>
            <span>{job.location}</span>
            <span aria-hidden className={styles.metaSeparator}>·</span>
            <span>{formatJobEmploymentType(job.employmentType, language)}</span>
          </p>
        </div>

        <dl className={styles.details}>
          <InfoLine
            label={c.vessel}
            value={`${yachtType || c.notSpecified} · ${yachtLength || c.notSpecified}`}
            field="vessel"
          />
          {yachtProgram ? (
            <InfoLine label={c.program} value={yachtProgram} field="program" />
          ) : null}
          <InfoLine
            label={c.start}
            value={job.startDate ? formatJobDate(job.startDate, language) : c.notSpecified}
            field="start"
          />
          {teamCouple ? (
            <InfoLine label={c.teamCouple} value={teamCouple} field="team" />
          ) : null}
        </dl>

        <div className={styles.actions} data-single-action={action.intent === "view"}>
          <Link href={action.detailHref} className={`bd-focus ${styles.primaryAction}`}>
            <span>{c.viewRole}</span>
            <ArrowRight aria-hidden />
          </Link>
          {action.intent !== "view" ? (
            <Link href={action.href} className={`bd-focus ${styles.secondaryAction}`}>
              {action.label}
            </Link>
          ) : null}
          <p data-i18n-ignore className={styles.posted}>
            {c.posted}: {formatJobDate(job.publishedAt, language)}
          </p>
        </div>
      </div>
    </article>
  );
}

export function PublicJobListingSkeleton({
  compact = false,
  appearance = "default",
}: {
  compact?: boolean;
  appearance?: "default" | "homepage";
}) {
  return (
    <div className={`${styles.card} ${styles.skeleton}`} data-compact={compact} data-appearance={appearance} aria-hidden="true">
      <div className={styles.layout}>
        <div className={styles.header}>
          <div className={styles.titlePlaceholder} />
          <div className={styles.salaryPlaceholder} />
          <div className={styles.metaPlaceholder} />
        </div>
        <div className={styles.details}>
          {["vessel", "program", "start", "team"].map((field) => (
            <div className={styles.info} data-field={field} key={field}>
              <div className={styles.labelPlaceholder} />
              <div className={styles.valuePlaceholder} />
            </div>
          ))}
        </div>
        <div className={styles.actions}>
          <div className={styles.actionPlaceholder} />
          <div className={styles.secondaryPlaceholder} />
          <div className={styles.postedPlaceholder} />
        </div>
      </div>
    </div>
  );
}

function InfoLine({
  label,
  value,
  field,
}: {
  label: string;
  value: string;
  field: "vessel" | "team" | "program" | "start";
}) {
  return (
    <div data-i18n-ignore className={styles.info} data-field={field}>
      <dt className={styles.infoLabel}>{label}</dt>
      <dd className={styles.infoValue}>{value}</dd>
    </div>
  );
}

const cardCopy = {
  en: {
    vessel: "Vessel",
    program: "Use",
    teamCouple: "Team/Couple",
    start: "Start",
    posted: "Posted",
    notSpecified: "Not specified",
    salaryNotSpecified: "Salary not specified",
    viewRole: "View role details",
  },
  tr: {
    vessel: "Tekne",
    program: "Kullanım",
    teamCouple: "Team/Couple",
    start: "Başlangıç",
    posted: "Yayınlandı",
    notSpecified: "Belirtilmedi",
    salaryNotSpecified: "Maaş belirtilmedi",
    viewRole: "İlan detaylarını görüntüle",
  },
} as const;
