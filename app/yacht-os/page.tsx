"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { ArrowDown, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, FileText, FolderLock, ListChecks, LockKeyhole, Pause, Play, ShieldCheck, Ship, UsersRound, BellRing, Anchor, Compass } from "lucide-react";
import { PublicFooter } from "../components/PublicSiteChrome";
import { useLanguage } from "../components/LanguageProvider";
import { useJobListingViewer } from "../jobs/JobListingAction";
import ProductScreen, { type ScreenKey } from "./ProductScreen";
import styles from "./yacht-os.module.css";

const icons = [UsersRound, FileText, ClipboardCheck, ListChecks, FolderLock, BellRing];
const moduleNames = ["Crew Command", "Contract Studio", "Checklist System", "IMO Crew List", "Document Vault", "Expiry Alerts"];
const heroScreens: ScreenKey[] = ["fleet", "overview", "checklists"];
const moduleScreens: ScreenKey[] = ["crew", "contracts", "checklists", "imo", "documents", "alerts"];
const copy = {
  tr: {
    eyebrow: "BLUEDECK YACHT-OS", heroA: "Yat operasyonlarını", heroB: "tek yerden yönetin.",
    intro: "Captain Workspace üzerinden mürettebat davetlerini, kontratları, kontrol listelerini ve yat belgelerini yönetin.",
    explore: "Yacht-OS’u keşfet", account: "Çalışma alanınızı oluşturun", dashboard: "Çalışma alanınıza gidin", tour: "Ürün turunu izleyin", private: "Yatınıza özel, yetkilere göre erişim.",
    sceneLabels: ["Eklenen yatlar", "Yatın yönetim paneli", "Kontrol listeleri"],
    sceneTexts: ["Yat bilgileri, fotoğraf ve çalışma alanına giriş", "Tekneye girdiğinizde karşılaştığınız yönetim ekranı", "Kendi görevlerinizi oluşturma ve mürettebata atama"], workspace: "Çalışma alanı", daily: "Yat & panel", access: "Erişim & güven", start: "Başlayın", pause: "Otomatik geçişleri duraklat", play: "Otomatik geçişleri başlat",
    productKicker: "CAPTAIN WORKSPACE / İÇERİYE BİR BAKIŞ", productTitle: "Captain Workspace’te\nneler yönetebilirsiniz?",
    modules: [
      { title: "Mürettebat davetleri\nve pozisyon yönetimi", text: "Mürettebatı yatınıza davet edin, teknedeki pozisyonunu belirleyin ve katılım durumunu takip edin. Kişi kayıtları ve erişim bilgileri aynı alanda görüntülenir.", bullets: ["Crew ID veya e-posta ile mürettebat daveti", "Pozisyona bağlı erişim ve sorumluluklar", "Bekleyen ve kabul edilen davetleri izleme"], note: "CREW ID · E-POSTA · POZİSYON · DAVET DURUMU" },
      { title: "Kontrat hazırlama,\nPDF ve mobil imza", text: "Tarafları, yat bilgilerini ve çalışma şartlarını aynı kontrat içinde hazırlayın. Ekleri düzenleyin, PDF önizlemesini inceleyin ve imza için mürettebata gönderin.", bullets: ["Annex A–D ile düzenli kontrat yapısı", "Kaydetme, PDF önizleme ve indirme", "Mürettebatın mobil imza akışına gönderim"], note: "ANNEX A–D · PDF · MOBİL İMZA" },
      { title: "Görev atama\nve tamamlanma takibi", text: "Mürettebatı, görev kategorisini ve tekrar sıklığını seçin. Görevleri kendiniz ekleyin; kaptan notunu paylaşın, tamamlanma durumunu ve fotoğraf kayıtlarını takip edin.", bullets: ["Kendi kontrol listelerinizi ve görevlerinizi oluşturma", "Yetki sınırlarına göre kişiye görev atama", "Öncesi / sonrası fotoğrafı ve tamamlanma kaydı"], note: "ATAMA · SIKLIK · FOTOĞRAF · ARŞİV" },
      { title: "Kayıtlı profillerden\nIMO mürettebat listesi", text: "Kayıtlı mürettebat profil bilgilerini IMO FAL Form 5 düzenine taşıyın. Seyir bilgilerini ve satırları kontrol edin, düzenleyin ve PDF olarak hazırlayın.", bullets: ["Mevcut mürettebat kayıtlarından liste hazırlama", "Varış, kalkış ve seyir bilgilerini düzenleme", "Satır yönetimi, PDF önizleme ve dışa aktarma"], note: "IMO FAL FORM 5 · DÜZENLEME · PDF" },
      { title: "Yat belgeleri\nve özel dosya arşivi", text: "Yat evraklarını, sigortaları, teknik dosyaları ve kontratları yatınıza özel bir alanda düzenleyin. Belgelerin kategorisi ve geçerlilik tarihi kaydın bir parçası olsun.", bullets: ["Kategori bazlı düzenli belge arşivi", "Belgelere bağlı son geçerlilik tarihleri", "Hesap ve yat yetkileriyle korunan erişim"], note: "KATEGORİ · BELGE · GEÇERLİLİK TARİHİ" },
      { title: "Belge geçerlilik\ntarihleri ve uyarılar", text: "Süresi dolan ve yaklaşan belgeleri önceliğine göre görün. Hangi kaydın önce ilgi istediğini anlayın ve tamamlanan uyarıyı çözüldü olarak işaretleyin.", bullets: ["Süresi dolan kayıtların ayrı görünümü", "14 / 30 gün ve 3 ay için öncelik grupları", "Belge yenileme sonrası uyarı takibi"], note: "SÜRESİ DOLAN · KRİTİK · YAKLAŞAN" }
    ], prev: "Önceki modül", next: "Sonraki modül", automatic: "Otomatik tur", manual: "Turu devam ettir",
    detailKicker: "ÖZEL KONTROL LİSTELERİ", detailTitle: "Kendi kontrol\nlistenizi oluşturun.", detailIntro: "Mürettebatı, görev kategorisini ve tekrar sıklığını seçin. Yatınızın ihtiyaçlarına göre görevler ekleyin ve kaptan notuyla birlikte gönderin.",
    checklistSteps: ["Görev kategorisini seçin ve görevler ekleyin", "Yetkiniz dahilindeki mürettebata atayın", "Tekrar sıklığını seçin ve kaptan notu ekleyin", "Tamamlanmayı, fotoğrafları ve PDF arşivini takip edin"],
    proofTitle: "Her görevin kayıtlı ayrıntıları", proofText: "Atanan kişi, tekrar sıklığı ve kaptan notlarıyla birlikte tamamlanma durumunu ve fotoğraf kayıtlarını inceleyin.",
    accessKicker: "YATINIZA ÖZEL BİR ALAN", accessTitle: "Hesap, pozisyon\nve role göre erişim.", accessIntro: "Profesyonel keşif ile özel operasyon kayıtları farklı erişim kurallarıyla çalışır. Yat bilgileri, mürettebat kayıtları ve belgeler ilgili hesap ve rollerle bağlantılı kalır.",
    roles: [ {title:"Kaptan & yönetim",text:"Yatı, davetleri ve operasyon görevlerini yetkileriniz dahilinde yönetin."},{title:"Departman & pozisyon",text:"Görev atamalarında pozisyon sırası ve departman sınırları geçerlidir."},{title:"Mürettebat",text:"Davetlerinizi ve kontratlarınızı inceleyin; size atanan işleri tamamlayın."}],
    trust: "BlueDeck’te güven ve gizlilik", connection: "Mürettebat keşfi ve yat davetleri", connectionText: "Profesyonel profilleri inceleyin, seçtiğiniz mürettebatı yatınıza davet edin ve katılım durumunu takip edin.", crew: "Mürettebatı keşfedin",
    faqTitle: "Sık sorulan sorular", faqs: [
      ["Yacht-OS’a nereden başlayabilirim?", "BlueDeck hesabınızı oluşturduktan sonra hesabınızın yetkilerine göre paneldeki Captain Workspace alanına geçebilirsiniz. Yatınızı ekleyip mürettebat davetleri ve operasyon kayıtlarıyla başlayabilirsiniz."],
      ["Mürettebatın da hesabı olması gerekiyor mu?", "Mürettebat, kendi hesabıyla yat davetini kabul eder. Kontrat inceleme, mobil imza ve kendisine atanan görevler aynı kişisel akış üzerinden ilerler."],
      ["Birden fazla yatı yönetebilir miyim?", "Captain Workspace, erişebildiğiniz yatları ayrı kartlar halinde gösterir. Her yatın mürettebatı, belgeleri ve operasyon alanı kendi bağlamında tutulur."],
      ["Buradaki ekranlar gerçek yat verisi mi?", "Ekran görüntüleri BlueDeck’in kendi uygulama sayfalarından alınmıştır. Arayüz yeniden tasarlanmamıştır; yat adı, kişiler ve kayıtlar tanıtım için kullanılan örnek verilerdir." ]
    ],
    finalKicker: "BLUEDECK YACHT-OS", finalA: "Captain Workspace’i açın.", finalB: "Yatınızı ve ekibinizi ekleyin.", finalText: "Mürettebat davetlerini, kontratları, belgeleri ve günlük görevleri yönetmeye başlayın.", finalSecondary: "Bizimle iletişime geçin", footerNote: "Captain Workspace · BlueDeck Yacht-OS"
  },
  en: {
    eyebrow: "BLUEDECK YACHT-OS", heroA: "Manage your yacht.", heroB: "Crew, records, operations.", intro: "Manage crew invitations, contracts, custom checklists and yacht documents through Captain Workspace.",
    explore: "Explore Yacht-OS", account: "Create your workspace", dashboard: "Open your workspace", tour: "Take the product tour", private: "Private yacht workspace with role-based access.", sceneLabels: ["Your yachts", "Yacht dashboard", "Custom checklists"], sceneTexts: ["Yacht details, photograph and workspace entry", "The management dashboard inside your yacht", "Create tasks and assign them to your crew"],workspace:"The workspace",daily:"Yacht & dashboard",access:"Access & trust",start:"Get started",pause:"Pause automatic transitions",play:"Start automatic transitions",
    productKicker:"CAPTAIN WORKSPACE / A LOOK INSIDE",productTitle:"What can you manage\nin Captain Workspace?",
    modules:[
      {title:"Crew invitations\nand position management",text:"Invite crew to your yacht, define onboard positions and track invitation status. View crew records and access information in the same workspace.",bullets:["Invite crew by Crew ID or email","Position-based access and responsibilities","Track pending and accepted invitations"],note:"CREW ID · EMAIL · POSITION · INVITATION STATUS"},
      {title:"Contracts, PDFs\nand mobile signatures",text:"Prepare the parties, yacht details and employment terms in one contract. Edit the annexes, review the PDF and send it to your crew for signature.",bullets:["Structured agreements with Annex A–D","Save, preview and download as PDF","Send to the crew’s mobile signing flow"],note:"ANNEX A–D · PDF · MOBILE SIGNATURE"},
      {title:"Task assignment\nand completion tracking",text:"Select the crew member, task category and frequency. Add your tasks and captain’s note, then track completion and photo records.",bullets:["Create your own checklists and tasks","Assign to crew within your permissions","Before / after photos and completion records"],note:"ASSIGNMENT · FREQUENCY · PHOTOS · ARCHIVE"},
      {title:"IMO crew lists\nfrom saved profiles",text:"Bring saved crew profile information into an editable IMO FAL Form 5. Review voyage details and rows, make adjustments and prepare your PDF.",bullets:["Build the list from existing crew profiles","Edit arrival, departure and voyage information","Manage rows, preview and export PDF"],note:"IMO FAL FORM 5 · EDITING · PDF"},
      {title:"Yacht documents\nand a private file archive",text:"Organize yacht papers, insurance, technical files and contracts in a space specific to your yacht. Keep categories and expiry dates attached to each record.",bullets:["A document archive organized by category","Expiry dates attached to documents","Access controlled by account and yacht permissions"],note:"CATEGORY · DOCUMENT · EXPIRY DATE"},
      {title:"Document expiry\ndates and alerts",text:"See expired and upcoming documents by priority. Understand which records need attention first, and mark alerts resolved when they are handled.",bullets:["A separate view of expired records","14-day, 30-day and 3-month priority groups","Track alerts after document renewal"],note:"EXPIRED · CRITICAL · UPCOMING"}
    ],prev:"Previous module",next:"Next module",automatic:"Automatic tour",manual:"Resume tour",
    detailKicker:"CUSTOM CHECKLISTS",detailTitle:"Create your own\nyacht checklist.",detailIntro:"Select the crew member, task category and frequency. Add tasks for your yacht and send them with the captain’s note.",checklistSteps:["Choose a task category and add custom tasks","Assign crew within your permissions","Choose a frequency and add the captain’s note","Track completion, photos and archived PDFs"],proofTitle:"A detailed record for every task",proofText:"Review the assignee, frequency and captain’s notes alongside completion status and photo records.",
    accessKicker:"A SPACE PRIVATE TO YOUR YACHT",accessTitle:"Access by account,\nposition and role.",accessIntro:"Professional discovery and private operational records follow different access rules. Yacht information, crew records and documents stay connected to the relevant accounts and roles.",roles:[{title:"Captain & management",text:"Manage the yacht, invitations and operational tasks within your permissions."},{title:"Department & position",text:"Task assignment follows position rank and department boundaries."},{title:"Crew",text:"Review your invitations and contracts. Complete the work assigned to you."}],trust:"Trust and privacy at BlueDeck",connection:"Crew discovery and yacht invitations",connectionText:"Review professional profiles, invite selected crew to your yacht and track their invitation status.",crew:"Discover professional crew",
    faqTitle:"Frequently asked questions",faqs:[
      ["How do I get started with Yacht-OS?","Create your BlueDeck account, then open Captain Workspace from your dashboard according to your account permissions. Add your yacht and begin with crew invitations and operational records."],
      ["Does each crew member need an account?","Crew accept yacht invitations through their own accounts. Contract review, mobile signing and assigned tasks continue through that personal workflow."],
      ["Can I manage more than one yacht?","Captain Workspace displays the yachts you can access as separate cards. Each yacht’s crew, documents and operational workspace retain their own context."],
      ["Are these screens showing real yacht data?","These screenshots are captured from BlueDeck’s own application pages. The interface is unchanged; yacht names, people and records are sample data used for this introduction."]
    ],finalKicker:"BLUEDECK YACHT-OS",finalA:"Open Captain Workspace.",finalB:"Add your yacht and crew.",finalText:"Start managing crew invitations, contracts, documents and daily tasks.",finalSecondary:"Talk to BlueDeck",footerNote:"Captain Workspace · BlueDeck Yacht-OS"
  }
};

const entryCopy = {
  tr: {
    kicker: "YAT KAYDINDAN YÖNETİM PANELİNE",
    steps: [
      { title: "Yatınızı Captain Workspace’e ekleyin", text: "Yatın adını, türünü, modelini, mürettebat sayısını ve bayrağını kaydedin. Fotoğrafıyla birlikte listelenen yat kartını buradan açın.", note: "Yat ekle · Yatı düzenle · Yat çalışma alanını aç" },
      { title: "Yata girin, yönetim alanını açın", text: "Tekneye girdikten sonra Crew Command, Contract Studio, Checklist System, IMO Crew List, Document Vault ve Expiry Alerts alanlarına bu panelden ulaşın.", note: "Yat paneli · Yönetim modülleri · Son aktiviteler" }
    ]
  },
  en: {
    kicker: "FROM YACHT RECORD TO WORKSPACE",
    steps: [
      { title: "Add your yacht to Captain Workspace", text: "Save its name, type, model, crew size and flag. Add a photograph, then open the yacht from its card.", note: "Add yacht · Edit yacht · Open yacht workspace" },
      { title: "Open the yacht management dashboard", text: "Access Crew Command, Contract Studio, Checklist System, IMO Crew List, Document Vault and Expiry Alerts from the yacht’s own dashboard.", note: "Yacht dashboard · Management modules · Recent activity" }
    ]
  }
};

function useVisibleCycle(ref: RefObject<HTMLElement | null>, count: number, delay: number, paused: boolean) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.15), { threshold: 0.15 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  useEffect(() => {
    const updateVisibility = () => setPageVisible(!document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);
  useEffect(() => {
    if (paused || !visible || !pageVisible) return;
    const timer = window.setInterval(() => setIndex(i => (i + 1) % count), delay);
    return () => window.clearInterval(timer);
  }, [count, delay, paused, visible, pageVisible]);
  return [index, setIndex, visible && pageVisible] as const;
}

export default function YachtOsPage() {
  const { language } = useLanguage();
  const c = copy[language];
  const entry = entryCopy[language];
  const viewer = useJobListingViewer();
  const [heroPaused, setHeroPaused] = useState(false);
  const [tourPaused, setTourPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [entryStep, setEntryStep] = useState(0);
  const heroRef = useRef<HTMLElement>(null);
  const tourRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const [scene, setScene, heroVisible] = useVisibleCycle(heroRef, 3, 6500, heroPaused || reduced);
  const [module, setModule, tourVisible] = useVisibleCycle(tourRef, 6, 10000, tourPaused || reduced);
  const accountHref = viewer.kind === "signed-in" ? "/dashboard" : "/login?mode=signup";
  const accountLabel = viewer.kind === "signed-in" ? c.dashboard : c.account;
  const heroStopped = heroPaused || reduced;
  const tourStopped = tourPaused || reduced;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.setAttribute("data-visible", "true");
          observer.unobserve(e.target);
        }
      });
    }, { threshold: .08 });
    rootRef.current?.querySelectorAll("[data-reveal]").forEach(item => observer.observe(item));
    return () => { media.removeEventListener("change", update); observer.disconnect(); };
  }, []);

  function chooseModule(index: number) {
    setModule((index + 6) % 6);
    setTourPaused(true);
  }
  function moduleKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = event.key === "ArrowRight" ? (index + 1) % 6 : event.key === "ArrowLeft" ? (index + 5) % 6 : event.key === "Home" ? 0 : event.key === "End" ? 5 : -1;
    if (target < 0) return;
    event.preventDefault();
    chooseModule(target);
    document.getElementById(`module-tab-${target}`)?.focus();
  }
  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "instant" : "smooth" });
  }

  return <div className={`bd-site-shell ${styles.page}`}>
    <main id="main-content" ref={rootRef} data-i18n-ignore>
      <section ref={heroRef} id="overview" className={styles.hero}>
        <Image src="/media/bluedeck-yacht-hero-v2.webp" alt="" fill sizes="100vw" className={styles.heroBackdrop} />
        <div className={styles.heroShade} />
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}><span className={styles.smallLine}/>{c.eyebrow}</p>
            <h1>{c.heroA}<br/><em>{c.heroB}</em></h1>
            <p className={styles.heroIntro}>{c.intro}</p>
            <div className={styles.heroActions}>
              <button type="button" onClick={() => jump("workspace")} className={styles.whiteButton}><Play size={15} fill="currentColor"/>{c.tour}</button>
              <Link href={accountHref} className={styles.quietButton}>{accountLabel}<ArrowUpRight size={17}/></Link>
            </div>
            <p className={styles.privateNote}><LockKeyhole size={13}/>{c.private}</p>
          </div>
          <div className={styles.heroProduct} onFocusCapture={() => setHeroPaused(true)}>
            <div className={styles.heroProductHeader}>
              <Image src="/bluedeck-logo-wide-premium-transparent.png" alt="BlueDeck" width={1560} height={300} className={styles.productLogo}/>
              <span>CAPTAIN WORKSPACE</span><small>0{scene + 1} / 03</small>
            </div>
            <div className={styles.heroScreens} data-active-screen={heroScreens[scene]}>
              {heroScreens.map((screen, i) => <div key={screen} className={`${styles.heroSlide} ${i === scene ? styles.heroSlideActive : ""}`} aria-hidden={i !== scene} inert={i !== scene}>
                <ProductScreen screen={screen} language={language} compact priority={i === 0}/>
              </div>)}
            </div>
            <p className={styles.heroScreenCaption} key={scene}><span>0{scene + 1}</span>{c.sceneTexts[scene]}</p>
          </div>
        </div>
        <div className={styles.heroBottom}>
          <div className={styles.scenePicker}>
            {c.sceneLabels.map((label, i) => <button type="button" key={label} aria-pressed={scene === i} onClick={() => { setScene(i); setHeroPaused(true); }} className={scene === i ? styles.sceneSelected : ""}>
              <span className={styles.sceneTrack}><i key={`${scene}-${heroStopped}-${heroVisible}`} style={{ animationPlayState: heroStopped || !heroVisible ? "paused" : "running" }}/></span>
              <small>0{i + 1}</small><span>{label}</span>
            </button>)}
          </div>
          <button type="button" className={styles.roundButton} onClick={() => setHeroPaused(v => !v)} aria-label={heroStopped ? c.play : c.pause} disabled={reduced}>{heroStopped ? <Play size={15}/> : <Pause size={15}/>}</button>
          <button type="button" onClick={() => jump("entry")} className={styles.scrollCue}>{c.explore}<ArrowDown size={16}/></button>
        </div>
      </section>

      <nav className={styles.chapterNav} aria-label={language === "tr" ? "Yacht-OS sayfa bölümleri" : "Yacht-OS page sections"}>
        <a href="#overview" className={styles.chapterBrand}><Ship size={20}/> Yacht-OS <span>/</span></a>
        <div>{[["entry", c.daily], ["workspace", c.workspace], ["access", c.access]].map(([id, label]) => <button key={id} type="button" onClick={() => jump(id)}>{label}</button>)}</div>
        <Link href={accountHref}>{c.start}<ArrowUpRight size={15}/></Link>
      </nav>

      <section className={styles.entrySection} id="entry" aria-labelledby="entry-heading">
        <h2 id="entry-heading" className={`${styles.eyebrow} ${styles.entryHeading}`} data-reveal>{entry.kicker}</h2>
        <div className={styles.entryGrid}>
          <div className={styles.entrySteps}>{entry.steps.map((step, i) => <button type="button" key={step.title} className={entryStep === i ? styles.entrySelected : ""} aria-pressed={entryStep === i} onClick={() => setEntryStep(i)}>
            <span className={styles.entryNumber}>0{i + 1}</span><h3>{step.title}</h3><p>{step.text}</p><small>{step.note}</small><ArrowUpRight size={18}/>
          </button>)}</div>
          <div className={styles.entryImage} key={entryStep}><ProductScreen screen={entryStep === 0 ? "fleet" : "overview"} language={language}/></div>
        </div>
      </section>

      <section className={styles.productSection} id="workspace" ref={tourRef}>
        <div className={styles.sectionHeading} data-reveal><div><p className={styles.eyebrow}>{c.productKicker}</p><h2>{c.productTitle}</h2></div></div>
        <div className={styles.moduleTabs} onFocusCapture={() => setTourPaused(true)} role="tablist" aria-label={language === "tr" ? "Yacht-OS modülleri" : "Yacht-OS modules"}>
          {moduleNames.map((name, i) => { const Icon = icons[i]; return <button type="button" id={`module-tab-${i}`} key={name} role="tab" aria-selected={module === i} aria-controls="module-panel" tabIndex={module === i ? 0 : -1} className={module === i ? styles.activeTab : ""} onClick={() => chooseModule(i)} onKeyDown={e => moduleKey(e, i)}><Icon size={19}/><span>{name}</span><small>0{i + 1}</small></button>; })}
        </div>
        <div id="module-panel" role="tabpanel" aria-labelledby={`module-tab-${module}`} className={styles.modulePanel}>
          <div className={styles.moduleCopy} key={`copy-${module}`}><p className={styles.moduleNumber}>0{module + 1}<span>/ 06</span></p><h3>{c.modules[module].title}</h3><p>{c.modules[module].text}</p><ul>{c.modules[module].bullets.map(b => <li key={b}><Check size={16}/>{b}</li>)}</ul><span className={styles.moduleNote}>{c.modules[module].note}</span></div>
          <div className={styles.demoStage} onFocusCapture={() => setTourPaused(true)}><div className={styles.demoScreen} key={`screen-${module}`}><ProductScreen screen={moduleScreens[module]} language={language}/></div></div>
        </div>
        <div className={styles.tourControls}>
          <div className={styles.progressSegments} aria-hidden="true">{moduleNames.map((_, i) => <span key={i} data-active={module === i} data-completed={i < module}><i key={`${module}-${tourStopped}-${tourVisible}`} style={{ animationPlayState: tourStopped || !tourVisible ? "paused" : "running" }}/></span>)}</div>
          <button type="button" onClick={() => setTourPaused(v => !v)} aria-label={tourStopped ? c.play : c.pause} disabled={reduced}>{tourStopped ? <Play size={14}/> : <Pause size={14}/>} {tourStopped ? c.manual : c.automatic}</button>
          <div className={styles.arrows}><button type="button" onClick={() => chooseModule(module - 1)} aria-label={c.prev}><ChevronLeft size={20}/></button><button type="button" onClick={() => chooseModule(module + 1)} aria-label={c.next}><ChevronRight size={20}/></button></div>
        </div>
      </section>

      <section className={styles.detailSection}>
        <div className={styles.detailIntro} data-reveal><p className={styles.eyebrow}>{c.detailKicker}</p><h2>{c.detailTitle}</h2><p>{c.detailIntro}</p><button className={styles.textButton} type="button" onClick={() => { chooseModule(2); jump("workspace"); }}>{moduleNames[2]}<ArrowUpRight size={18}/></button></div>
        <div className={styles.detailRight}><div className={styles.checklistSteps}>{c.checklistSteps.map((step, i) => <div key={step}><span>0{i + 1}</span><p>{step}</p><Check size={16}/></div>)}</div><div className={styles.proofNote}><ClipboardCheck size={24}/><div><h3>{c.proofTitle}</h3><p>{c.proofText}</p></div></div></div>
      </section>

      <section className={styles.accessSection} id="access">
        <div className={styles.accessTop} data-reveal><div><p className={styles.eyebrow}><ShieldCheck size={15}/>{c.accessKicker}</p><h2>{c.accessTitle}</h2></div><div><p>{c.accessIntro}</p><Link href="/trust" className={styles.trustLink}>{c.trust}<ArrowUpRight size={16}/></Link></div></div>
        <div className={styles.roleGrid}>{c.roles.map((role, i) => { const Icon = [Anchor, Compass, UsersRound][i]; return <article key={role.title}><Icon size={26}/><span>0{i + 1}</span><h3>{role.title}</h3><p>{role.text}</p></article>; })}</div>
        <div className={styles.connection}><div><h3>{c.connection}</h3><p>{c.connectionText}</p></div><Link href="/find-crew">{c.crew}<ArrowUpRight size={18}/></Link></div>
      </section>

      <section className={styles.faq}><div><p className={styles.eyebrow}>YACHT-OS / FAQ</p><h2>{c.faqTitle}</h2></div><div>{c.faqs.map(([q, a]) => <details key={q}><summary>{q}<span><ChevronDown size={18}/></span></summary><p>{a}</p></details>)}</div></section>
      <section className={styles.finalCta}><Image src="/media/bluedeck-yacht-hero-v2.webp" alt="" fill sizes="100vw" className={styles.cover}/><div className={styles.finalShade}/><div className={styles.finalContent} data-reveal><p className={styles.eyebrow}>{c.finalKicker}</p><h2>{c.finalA}<br/><em>{c.finalB}</em></h2><p>{c.finalText}</p><div><Link href={accountHref} className={styles.whiteButton}>{accountLabel}<ArrowUpRight size={18}/></Link><Link href="/contact" className={styles.quietButton}>{c.finalSecondary}</Link></div><small>{c.footerNote}</small></div></section>
    </main>
    <PublicFooter />
  </div>;
}
