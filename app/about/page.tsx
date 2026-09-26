"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "../components/LanguageProvider";
import { PublicFooter, PublicHeader } from "../components/PublicSiteChrome";
import { aboutContent } from "./about-content";
import styles from "./about.module.css";

export default function AboutPage() {
  const { language } = useLanguage();
  const content = aboutContent[language];

  return (
    <div className={`bd-site-shell ${styles.page}`}>
      <PublicHeader />
      <main id="main-content" className={styles.main} data-i18n-ignore tabIndex={-1}>
        <div className={styles.container}>
          <section className={styles.hero} aria-labelledby="about-title">
            <p className={styles.eyebrow}>{content.eyebrow}</p>
            <h1 id="about-title" className={styles.title}>
              <span>{content.title[0]}</span>
              <span>{content.title[1]}</span>
            </h1>
            <p className={styles.intro}>{content.intro}</p>
          </section>
          <div className={styles.photo}>
            <Image
              src="/media/about-yacht-hero-v1.webp"
              alt={content.photoAlt}
              fill
              quality={90}
              sizes="(max-width: 640px) calc(100vw - 40px), (max-width: 1360px) calc(100vw - 96px), 1264px"
              preload
              className={styles.image}
            />
          </div>
          <div className={styles.details}>
            <section className={styles.row} aria-labelledby="who-we-are">
              <h2 id="who-we-are" className={styles.sectionTitle}>{content.who.title}</h2>
              <p className={styles.copy}>{content.who.text}</p>
            </section>
            <section className={styles.row} aria-labelledby="what-we-do">
              <h2 id="what-we-do" className={styles.sectionTitle}>{content.servicesTitle}</h2>
              <div className={styles.services}>
                {content.services.map((service) => (
                  <article className={styles.service} key={service.href}>
                    <h3 className={styles.serviceTitle}>{service.title}</h3>
                    <p className={styles.copy}>{service.text}</p>
                    <Link href={service.href} className={styles.textLink}>
                      {service.link}<span aria-hidden="true">→</span>
                    </Link>
                  </article>
                ))}
              </div>
            </section>
            <section id="mission" className={styles.row} aria-labelledby="mission-title">
              <h2 id="mission-title" className={styles.sectionTitle}>{content.mission.title}</h2>
              <p className={styles.copy}>{content.mission.text}</p>
            </section>
            <section id="vision" className={styles.row} aria-labelledby="vision-title">
              <h2 id="vision-title" className={styles.sectionTitle}>{content.vision.title}</h2>
              <p className={styles.copy}>{content.vision.text}</p>
            </section>
            <section className={styles.contact} aria-labelledby="contact-title">
              <h2 id="contact-title" className={styles.contactTitle}>{content.contact.title}</h2>
              <Link className={styles.button} href="/contact">{content.contact.link}</Link>
            </section>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
