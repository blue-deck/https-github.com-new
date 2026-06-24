import { generatedPhraseTranslations } from "./phraseTranslations.generated";

export const languages = [
  { code: "en", label: "EN", flag: "🇬🇧", name: "English" },
  { code: "tr", label: "TR", flag: "🇹🇷", name: "Türkçe" },
] as const;

export type Language = (typeof languages)[number]["code"];

export const defaultLanguage: Language = "en";
export const languageStorageKey = "bluedeck.language";

const en = {
  "language.select": "Language",
  "topbar.dashboard": "Dashboard",
  "topbar.settings": "Settings",
  "topbar.profile": "Profile",
  "topbar.logout": "Logout",
  "nav.yachts": "Yachts",
  "nav.services": "Services",
  "nav.management": "Management",
  "nav.trust": "Trust",
  "nav.about": "About",
  "nav.contact": "Contact",
  "auth.login": "Login",
  "auth.signUp": "Sign up",
  "footer.description":
    "BlueDeck is a private yacht management platform for owners, captains, crew operations, documents, contracts and readiness workflows.",
  "footer.company": "Company",
  "footer.platform": "Platform",
  "footer.contact": "Contact",
  "footer.vision": "Vision",
  "footer.clientLogin": "Client login",
  "footer.operations": "Private yacht operations",
  "footer.secureAccess": "Account-based secure access",
  "footer.rights": "All rights reserved.",
  "footer.privacy": "Privacy Policy",
  "footer.terms": "Terms",
  "home.eyebrow": "Own the experience",
  "home.title1": "Manage Your Yacht.",
  "home.title2": "Live Your Freedom.",
  "home.intro":
    "BlueDeck brings yacht management, crew workflows, documents, contracts and operational readiness into one elegant private website.",
  "home.createAccount": "Create Account",
  "home.exploreServices": "Explore Services",
  "home.platformEyebrow": "BlueDeck Platform",
  "home.platformTitle": "A yacht website that works like a private operations office.",
  "home.platformIntro":
    "BlueDeck is designed for the real structure of a yacht: owner, captain, officers, departments and crew. The public site stays calm and premium; secure areas open only after login.",
  "home.pillar1.title": "Yacht Management",
  "home.pillar1.text":
    "A private workspace for vessel data, documents, readiness, crew status and operational records.",
  "home.pillar2.title": "Crew Operations",
  "home.pillar2.text":
    "Crew profiles, invitations, contracts, document expiry alerts and onboard checklist workflows.",
  "home.pillar3.title": "Owner Experience",
  "home.pillar3.text":
    "A calm owner view focused on privacy, guest comfort, readiness, location and high-level confidence.",
  "home.pillar4.title": "Operational Readiness",
  "home.pillar4.text":
    "Departure, arrival, daily readiness and onboard workflow records structured for captain-grade oversight.",
  "home.deepEyebrow": "Private YachtOS",
  "home.deepTitle": "Built for traceable operations without losing the luxury feeling.",
  "home.section1": "Private account and role-based access",
  "home.section2": "Crew CV, document vault and expiry monitoring",
  "home.section3": "Captain invitations, yacht contracts and mobile signing",
  "home.section4": "Checklist System with crew progress and proof records",
  "home.section5": "IMO crew list, yacht documents and operational history",
  "home.section6": "Owner, captain and crew areas connected under one brand",
  "home.feature1.title": "Checklist System",
  "home.feature1.text":
    "Assign duties, track completion, inspect before/after proof and keep records clear.",
  "home.feature2.title": "Document Control",
  "home.feature2.text":
    "Crew documents, yacht papers, contracts and expiry alerts organized in one secure flow.",
  "home.feature3.title": "Trust & Privacy",
  "home.feature3.text":
    "Account-based access, privacy-focused structure and professional legal pages.",
  "home.viewDetails": "View details",
  "home.startEyebrow": "Start BlueDeck",
  "home.startTitle": "Open a private account and build your yacht workspace.",
  "about.eyebrow": "About BlueDeck",
  "about.title": "A private yacht platform shaped around elegance, hierarchy and trust.",
  "about.intro":
    "BlueDeck exists to make yacht operations feel less scattered. It brings crew profiles, yacht records, documents, contracts, checklist systems and owner-facing readiness into one polished website.",
  "about.vision": "Vision",
  "about.visionTitle": "To make every private yacht feel organized before anyone has to ask.",
  "about.visionText":
    "A yacht runs on timing, people, documents and quiet confidence. BlueDeck’s vision is to keep those parts connected through a premium interface that does not feel noisy or amateur.",
  "about.mission": "Mission",
  "about.missionText":
    "Give owners, captains and crew a secure place to manage the work behind a luxury yacht without losing the luxury feeling.",
  "services.eyebrow": "Services",
  "services.title": "Everything a private yacht team needs, without operational noise.",
  "services.intro":
    "BlueDeck separates each workflow into a professional website structure: public brand pages, secure account access and private role-based yacht workspaces.",
  "services.item1.title": "Private Yacht Workspace",
  "services.item1.text":
    "Centralize yacht profile, flag, operating details, readiness, documents and connected crew records.",
  "services.item2.title": "Crew Profile & CV",
  "services.item2.text":
    "Crew members can create professional profiles, upload documents, manage expiry dates and build a clean CV.",
  "services.item3.title": "Checklist System",
  "services.item3.text":
    "Captains and authorized crew assign structured yacht checklists through the onboard hierarchy.",
  "services.item4.title": "Contracts & Crew Lists",
  "services.item4.text":
    "Assign yacht contracts, collect acceptance and generate operational crew information from saved profile data.",
  "services.item5.title": "Yacht Operations",
  "services.item5.text":
    "Organize departure, arrival, daily readiness and yacht operational records in a dedicated workspace.",
  "services.item6.title": "Compliance Alerts",
  "services.item6.text":
    "Track document expiry windows and keep personal and yacht records visible before they become critical.",
  "services.secureAccount": "Secure account",
  "services.ctaTitle": "Build the workflow inside your own BlueDeck profile.",
  "management.eyebrow": "Management",
  "management.title": "A calmer way to manage crew, documents and vessel operations.",
  "management.intro":
    "BlueDeck is built around real yacht hierarchy and daily operations. It keeps the public brand experience elegant while giving secure users the tools they need behind login.",
  "management.model": "Operating Model",
  "management.modelTitle": "From crew profile to captain command, the flow stays connected.",
  "management.modelText":
    "The platform avoids scattered files and chat-based follow-up by keeping each action connected to an account, yacht, role and date.",
  "management.workflow1": "Owner, captain, management and crew accounts are separated by role.",
  "management.workflow2": "Crew members maintain their own profile, documents, photo gallery and CV.",
  "management.workflow3": "Captains invite crew into a yacht workspace and assign contracts or checklist duties.",
  "management.workflow4": "Checklist progress, timestamps and proof images stay attached to the yacht record.",
  "management.workflow5": "Document expiry alerts keep operational risk visible before it becomes urgent.",
  "management.workspace": "Captain Workspace",
  "management.workspaceTitle":
    "Invite crew, manage contracts and open the Checklist System from one yacht workspace.",
  "management.loginWorkspace": "Login to workspace",
  "trust.eyebrow": "Trust",
  "trust.title": "Private yacht data deserves a calm, controlled structure.",
  "trust.intro":
    "BlueDeck is designed around account ownership, yacht membership, document visibility and traceable operational activity.",
  "trust.item1.title": "Real Accounts",
  "trust.item1.text":
    "Users create accounts with their own email, phone number, name, role and yacht position.",
  "trust.item2.title": "Secure Login",
  "trust.item2.text":
    "Authentication, email confirmation and password reset are handled through the configured secure provider.",
  "trust.item3.title": "Role-Based Access",
  "trust.item3.text":
    "Yacht operations are separated between owner, captain, management and crew responsibilities.",
  "trust.item4.title": "Brand Email Flow",
  "trust.item4.text":
    "Account emails can be sent through the configured BlueDeck sender and authenticated domain.",
  "contact.eyebrow": "Contact",
  "contact.title": "Speak with BlueDeck about your yacht workspace.",
  "contact.intro":
    "For account, privacy, onboarding or yacht workspace questions, contact BlueDeck directly. The secure platform remains available through login.",
  "contact.direct": "Direct contact",
  "contact.directTitle": "A premium system should be easy to reach.",
  "contact.emailBlueDeck": "Email BlueDeck",
  "contact.email": "Email",
  "contact.operationsTitle": "Operations",
  "contact.operationsText": "Private yacht management and crew workflows",
  "contact.accessTitle": "Account Access",
  "contact.accessText":
    "Existing users can manage profile, settings and yacht modules after login.",
  "contact.haveAccount": "Already have an account?",
  "contact.loginBlueDeck": "Login to BlueDeck",
  "login.heroEyebrow": "BlueDeck YachtOS",
  "login.heroTitle": "Secure yacht profiles, documents and crew operations.",
  "login.bullet1": "Private crew ID and dashboard",
  "login.bullet2": "Professional CV and document vault",
  "login.bullet3": "Captain invitations, contracts and checklists",
  "login.secureAccess": "Secure account access",
  "login.tabLogin": "Login",
  "login.tabSignup": "Create account",
  "login.backToLogin": "Back to login",
  "login.welcomeBack": "Welcome back",
  "login.newPasswordTitle": "Set a new password",
  "login.createTitle": "Create your BlueDeck account",
  "login.loginIntro": "Login to continue to My Dashboard.",
  "login.recoveryIntro":
    "Enter a new password for your BlueDeck account. After saving, login again with your new password.",
  "login.signupIntro": "Use your real email and phone. BlueDeck will send a secure confirmation email.",
  "login.fullName": "Name and surname",
  "login.mobile": "Mobile number",
  "login.accountType": "Account type",
  "login.selectAccountType": "Select account type",
  "login.roleCrew": "Crew",
  "login.roleCaptain": "Captain",
  "login.roleOwner": "Owner",
  "login.roleManagement": "Management",
  "login.position": "Yacht position",
  "login.selectPosition": "Select yacht position",
  "login.email": "Email",
  "login.password": "Password",
  "login.newPassword": "New password",
  "login.repeatPassword": "Repeat password",
  "login.minimumPassword": "Minimum 6 characters",
  "login.minimumSignupPassword": "Minimum 8 characters",
  "login.samePassword": "Enter the same password again",
  "login.passwordRequirements":
    "Use uppercase and lowercase letters, a number and at least 1 special character.",
  "login.privacyAgree": "I agree to the BlueDeck",
  "login.privacyPolicy": "Privacy Policy",
  "login.wait": "Please wait...",
  "login.loginButton": "Login to My Dashboard",
  "login.savePassword": "Save new password",
  "login.createButton": "Create secure account",
  "login.forgot": "Forgot password?",
  "login.resend": "Resend confirmation email",
  "login.protection":
    "BlueDeck protects new accounts with email confirmation. If the email does not arrive, check spam or resend the confirmation email.",
  "login.notice.newPasswordTwice": "Please enter your new password twice.",
  "login.notice.minPassword": "Password must be at least 6 characters.",
  "login.notice.signupPassword":
    "Password must be at least 8 characters and include uppercase, lowercase, a number and at least 1 special character.",
  "login.notice.passwordMismatch": "Passwords do not match.",
  "login.notice.passwordUpdated": "Your password has been updated. Please login with your new password.",
  "login.notice.resetFailed":
    "BlueDeck could not complete the password reset. Please request a new reset email.",
  "login.notice.emailPassword": "Please enter your email and password.",
  "login.notice.required":
    "Name, email, password, phone, account type and yacht position are required.",
  "login.notice.phone": "Please select a country code and enter a valid mobile number.",
  "login.notice.privacy": "Please accept the Privacy Policy to create your account.",
  "login.notice.loginService":
    "BlueDeck could not reach the login service. Please try again in a moment.",
  "login.notice.accountFailed": "Account could not be created. Please try again.",
  "login.notice.confirmEmail":
    "Account created. Please check your email and confirm your BlueDeck account, then login.",
  "login.notice.accountCreated": "Account created. Please login to continue to My Dashboard.",
  "login.notice.createFailed":
    "Create account request failed. Please check your internet connection and try again.",
  "login.notice.enterEmail": "Enter your email first.",
  "login.notice.confirmationSent": "Confirmation email sent again. Please check your inbox.",
  "login.notice.resendFailed":
    "BlueDeck could not resend the confirmation email. Please try again in a moment.",
  "password.strength": "Password strength",
  "password.weak": "Weak",
  "password.medium": "Medium",
  "password.strong": "Strong",
  "forgot.eyebrow": "BlueDeck account recovery",
  "forgot.title": "Reset your password",
  "forgot.intro":
    "Enter your email address below and we will send you a secure link to reset your password.",
  "forgot.email": "Email address",
  "forgot.security": "Security verification",
  "forgot.invalidEmail": "Please enter a valid email address.",
  "forgot.completeSecurity": "Please complete the security check.",
  "forgot.securityError": "Security verification could not load. Please refresh and try again.",
  "forgot.needsKeys":
    "BlueDeck security verification needs Cloudflare Turnstile keys before password reset can be used.",
  "forgot.sendFailed": "BlueDeck could not send the reset email. Please try again.",
  "forgot.sendFailedMoment": "BlueDeck could not send the reset email. Please try again in a moment.",
  "forgot.sent": "If this email belongs to a BlueDeck account, a secure reset link has been sent.",
  "forgot.sending": "Sending reset link...",
  "forgot.send": "Send reset link",
  "reset.checking": "Checking your secure BlueDeck reset link...",
  "reset.incomplete":
    "This reset link is incomplete or expired. Please request a new BlueDeck password reset email.",
  "reset.ready": "Choose a new password for your BlueDeck account.",
  "reset.verifyFailed": "BlueDeck could not verify this reset link.",
  "reset.privateAccess": "Private account access",
  "reset.leftTitle": "Set a fresh password securely.",
  "reset.leftIntro":
    "This page only works from the secure reset link in your email. After saving, BlueDeck signs you out so your next login starts cleanly.",
  "reset.secureReset": "BlueDeck secure reset",
  "reset.updatedTitle": "Password updated",
  "reset.expiredTitle": "Reset link expired",
  "reset.createTitle": "Create new password",
  "reset.newPassword": "New password",
  "reset.repeatPassword": "Repeat new password",
  "reset.saving": "Saving new password...",
  "reset.save": "Save new password",
  "reset.requestNew": "Request a new reset link",
  "reset.updateFailed": "BlueDeck could not update your password. Please request a new reset link.",
  "dashboard.loading": "Loading dashboard...",
  "dashboard.myDashboard": "My Dashboard",
  "dashboard.welcome": "Welcome",
  "dashboard.role": "Role",
  "dashboard.profilePhoto": "Profile photo",
  "dashboard.updatingPhoto": "Updating photo...",
  "settings.languageTitle": "Language options",
  "settings.languageDescription":
    "Choose the interface language used across BlueDeck on this device.",
  "settings.languageAvailable": "Available languages: English and Turkish.",
  "offline.title": "BlueDeck Offline",
  "offline.text": "Connection is unavailable. Your yacht system shell is still accessible.",
} as const;

type TranslationKey = keyof typeof en;

const tr: Record<TranslationKey, string> = {
  "language.select": "Dil",
  "topbar.dashboard": "Panel",
  "topbar.settings": "Ayarlar",
  "topbar.profile": "Profil",
  "topbar.logout": "Çıkış",
  "nav.yachts": "Yatlar",
  "nav.services": "Hizmetler",
  "nav.management": "Yönetim",
  "nav.trust": "Güven",
  "nav.about": "Hakkımızda",
  "nav.contact": "İletişim",
  "auth.login": "Giriş",
  "auth.signUp": "Kayıt ol",
  "footer.description":
    "BlueDeck; sahipler, kaptanlar, mürettebat operasyonları, belgeler, kontratlar ve hazırlık iş akışları için özel bir yat yönetim platformudur.",
  "footer.company": "Şirket",
  "footer.platform": "Platform",
  "footer.contact": "İletişim",
  "footer.vision": "Vizyon",
  "footer.clientLogin": "Kullanıcı girişi",
  "footer.operations": "Özel yat operasyonları",
  "footer.secureAccess": "Hesap tabanlı güvenli erişim",
  "footer.rights": "Tüm hakları saklıdır.",
  "footer.privacy": "Gizlilik Politikası",
  "footer.terms": "Şartlar",
  "home.eyebrow": "Deneyimin sahibi olun",
  "home.title1": "Yatınızı Yönetin.",
  "home.title2": "Özgürlüğünüzü Yaşayın.",
  "home.intro":
    "BlueDeck yat yönetimi, mürettebat iş akışları, belgeler, kontratlar ve operasyonel hazırlığı tek bir zarif özel web sitesinde toplar.",
  "home.createAccount": "Hesap Oluştur",
  "home.exploreServices": "Hizmetleri İncele",
  "home.platformEyebrow": "BlueDeck Platform",
  "home.platformTitle": "Özel operasyon ofisi gibi çalışan bir yat web sitesi.",
  "home.platformIntro":
    "BlueDeck bir yatın gerçek yapısına göre tasarlandı: sahip, kaptan, zabitler, departmanlar ve mürettebat. Public site sakin ve premium kalır; güvenli alanlar yalnızca girişten sonra açılır.",
  "home.pillar1.title": "Yat Yönetimi",
  "home.pillar1.text": "Tekne verileri, belgeler, hazırlık, mürettebat durumu ve operasyon kayıtları için özel çalışma alanı.",
  "home.pillar2.title": "Mürettebat Operasyonları",
  "home.pillar2.text": "Mürettebat profilleri, davetler, kontratlar, belge bitiş uyarıları ve onboard checklist akışları.",
  "home.pillar3.title": "Sahip Deneyimi",
  "home.pillar3.text": "Gizlilik, misafir konforu, hazırlık, lokasyon ve üst düzey güvene odaklanan sakin sahip görünümü.",
  "home.pillar4.title": "Köprüüstü Hazırlığı",
  "home.pillar4.text": "Navigasyon, vardiya, seyir, varış ve ayrılış akışları kaptan seviyesinde kontrol için yapılandırılır.",
  "home.deepEyebrow": "Private YachtOS",
  "home.deepTitle": "Lüks hissi kaybetmeden izlenebilir operasyonlar için tasarlandı.",
  "home.section1": "Özel hesap ve rol tabanlı erişim",
  "home.section2": "Mürettebat CV, belge kasası ve bitiş tarihi takibi",
  "home.section3": "Kaptan davetleri, yat kontratları ve mobil imza",
  "home.section4": "Mürettebat ilerleme ve kanıt kayıtlarıyla Checklist System",
  "home.section5": "IMO crew list, yat belgeleri ve operasyon geçmişi",
  "home.section6": "Sahip, kaptan ve mürettebat alanları tek marka altında bağlı",
  "home.feature1.title": "Checklist System",
  "home.feature1.text": "Görev ata, tamamlanmayı takip et, before/after kanıtlarını incele ve kayıtları net tut.",
  "home.feature2.title": "Belge Kontrolü",
  "home.feature2.text": "Mürettebat belgeleri, yat evrakları, kontratlar ve bitiş uyarıları tek güvenli akışta düzenlenir.",
  "home.feature3.title": "Güven ve Gizlilik",
  "home.feature3.text": "Hesap tabanlı erişim, gizlilik odaklı yapı ve profesyonel yasal sayfalar.",
  "home.viewDetails": "Detayları gör",
  "home.startEyebrow": "BlueDeck’e Başla",
  "home.startTitle": "Özel hesap açın ve yat çalışma alanınızı oluşturun.",
  "about.eyebrow": "BlueDeck Hakkında",
  "about.title": "Zarafet, hiyerarşi ve güven etrafında şekillenen özel yat platformu.",
  "about.intro": "BlueDeck, yat operasyonlarının dağınık hissettirmemesi için var. Mürettebat profilleri, yat kayıtları, belgeler, kontratlar, checklist sistemleri ve sahip odaklı hazırlığı tek şık web sitesinde toplar.",
  "about.vision": "Vizyon",
  "about.visionTitle": "Her özel yatı, kimse sormadan önce düzenli hissettirmek.",
  "about.visionText": "Bir yat; zamanlama, insanlar, belgeler ve sessiz güvenle çalışır. BlueDeck’in vizyonu, bu parçaları gürültülü ya da amatör hissettirmeyen premium bir arayüzle bağlı tutmaktır.",
  "about.mission": "Misyon",
  "about.missionText": "Sahiplere, kaptanlara ve mürettebata, lüks hissi kaybetmeden bir yatın arkasındaki işi yönetebilecekleri güvenli bir alan vermek.",
  "services.eyebrow": "Hizmetler",
  "services.title": "Özel yat ekibinin ihtiyaç duyduğu her şey, operasyon kalabalığı olmadan.",
  "services.intro": "BlueDeck her iş akışını profesyonel web sitesi yapısına ayırır: public marka sayfaları, güvenli hesap erişimi ve role göre özel yat çalışma alanları.",
  "services.item1.title": "Özel Yat Çalışma Alanı",
  "services.item1.text": "Yat profili, bayrak, operasyon detayları, hazırlık, belgeler ve bağlı mürettebat kayıtlarını merkezileştirir.",
  "services.item2.title": "Mürettebat Profil & CV",
  "services.item2.text": "Mürettebat profesyonel profil oluşturabilir, belge yükleyebilir, bitiş tarihlerini yönetebilir ve temiz bir CV hazırlayabilir.",
  "services.item3.title": "Checklist System",
  "services.item3.text": "Kaptanlar ve yetkili mürettebat, onboard hiyerarşi üzerinden yapılandırılmış checklist atar.",
  "services.item4.title": "Kontratlar & Crew List",
  "services.item4.text": "Yat kontratı atayın, kabul alın ve kayıtlı profil verisinden operasyonel mürettebat bilgisi üretin.",
  "services.item5.title": "Köprüüstü & Operasyon",
  "services.item5.text": "Köprüüstü, ayrılış, varış, vardiya ve günlük operasyon hazırlığını özel bir alanda düzenleyin.",
  "services.item6.title": "Uyum Uyarıları",
  "services.item6.text": "Belge bitiş pencerelerini takip edin ve kişisel/yat kayıtlarını kritik olmadan görünür tutun.",
  "services.secureAccount": "Güvenli hesap",
  "services.ctaTitle": "İş akışını kendi BlueDeck profiliniz içinde oluşturun.",
  "management.eyebrow": "Yönetim",
  "management.title": "Mürettebat, belge ve tekne operasyonlarını yönetmenin daha sakin yolu.",
  "management.intro": "BlueDeck gerçek yat hiyerarşisi ve günlük operasyonlar üzerine kuruldu. Public marka deneyimi zarif kalırken, güvenli kullanıcılar giriş sonrası ihtiyaç duyduğu araçlara erişir.",
  "management.model": "Operasyon Modeli",
  "management.modelTitle": "Mürettebat profilinden kaptan komutasına kadar akış bağlı kalır.",
  "management.modelText": "Platform, her aksiyonu hesap, yat, rol ve tarih ile bağlayarak dağınık dosya ve mesaj takibini azaltır.",
  "management.workflow1": "Sahip, kaptan, yönetim ve mürettebat hesapları role göre ayrılır.",
  "management.workflow2": "Mürettebat kendi profilini, belgelerini, fotoğraf galerisini ve CV’sini yönetir.",
  "management.workflow3": "Kaptanlar mürettebatı yat çalışma alanına davet eder, kontrat veya checklist görevleri atar.",
  "management.workflow4": "Checklist ilerlemesi, zaman damgaları ve kanıt fotoğrafları yat kaydına bağlı kalır.",
  "management.workflow5": "Belge bitiş uyarıları operasyon riskini acil olmadan görünür tutar.",
  "management.workspace": "Kaptan Çalışma Alanı",
  "management.workspaceTitle": "Tek bir yat çalışma alanından mürettebat davet edin, kontratları yönetin ve Checklist System’i açın.",
  "management.loginWorkspace": "Çalışma alanına giriş",
  "trust.eyebrow": "Güven",
  "trust.title": "Özel yat verisi sakin ve kontrollü bir yapıyı hak eder.",
  "trust.intro": "BlueDeck hesap sahipliği, yat üyeliği, belge görünürlüğü ve izlenebilir operasyon aktivitesi etrafında tasarlanmıştır.",
  "trust.item1.title": "Gerçek Hesaplar",
  "trust.item1.text": "Kullanıcılar kendi e-posta, telefon, isim, rol ve yat pozisyonlarıyla hesap oluşturur.",
  "trust.item2.title": "Güvenli Giriş",
  "trust.item2.text": "Kimlik doğrulama, e-posta onayı ve şifre sıfırlama yapılandırılmış güvenli sağlayıcı üzerinden yapılır.",
  "trust.item3.title": "Rol Tabanlı Erişim",
  "trust.item3.text": "Yat operasyonları sahip, kaptan, yönetim ve mürettebat sorumlulukları arasında ayrılır.",
  "trust.item4.title": "Markalı E-posta Akışı",
  "trust.item4.text": "Hesap e-postaları yapılandırılmış BlueDeck göndereni ve doğrulanmış domain üzerinden gönderilebilir.",
  "contact.eyebrow": "İletişim",
  "contact.title": "Yat çalışma alanınız hakkında BlueDeck ile görüşün.",
  "contact.intro": "Hesap, gizlilik, onboarding veya yat çalışma alanı soruları için BlueDeck ile doğrudan iletişime geçin. Güvenli platform giriş üzerinden kullanılabilir.",
  "contact.direct": "Direkt iletişim",
  "contact.directTitle": "Premium bir sisteme ulaşmak kolay olmalı.",
  "contact.emailBlueDeck": "BlueDeck’e e-posta gönder",
  "contact.email": "E-posta",
  "contact.operationsTitle": "Operasyonlar",
  "contact.operationsText": "Özel yat yönetimi ve mürettebat iş akışları",
  "contact.accessTitle": "Hesap Erişimi",
  "contact.accessText": "Mevcut kullanıcılar girişten sonra profil, ayarlar ve yat modüllerini yönetebilir.",
  "contact.haveAccount": "Zaten hesabınız var mı?",
  "contact.loginBlueDeck": "BlueDeck’e giriş",
  "login.heroEyebrow": "BlueDeck YachtOS",
  "login.heroTitle": "Güvenli yat profilleri, belgeler ve mürettebat operasyonları.",
  "login.bullet1": "Özel crew ID ve dashboard",
  "login.bullet2": "Profesyonel CV ve belge kasası",
  "login.bullet3": "Kaptan davetleri, kontratlar ve checklistler",
  "login.secureAccess": "Güvenli hesap erişimi",
  "login.tabLogin": "Giriş",
  "login.tabSignup": "Hesap oluştur",
  "login.backToLogin": "Girişe dön",
  "login.welcomeBack": "Tekrar hoş geldiniz",
  "login.newPasswordTitle": "Yeni şifre belirle",
  "login.createTitle": "BlueDeck hesabınızı oluşturun",
  "login.loginIntro": "My Dashboard’a devam etmek için giriş yapın.",
  "login.recoveryIntro": "BlueDeck hesabınız için yeni şifre girin. Kaydettikten sonra yeni şifrenizle tekrar giriş yapın.",
  "login.signupIntro": "Gerçek e-posta ve telefonunuzu kullanın. BlueDeck güvenli onay e-postası gönderecek.",
  "login.fullName": "İsim ve soyisim",
  "login.mobile": "Telefon numarası",
  "login.accountType": "Hesap tipi",
  "login.selectAccountType": "Hesap tipi seçin",
  "login.roleCrew": "Mürettebat",
  "login.roleCaptain": "Kaptan",
  "login.roleOwner": "Sahip",
  "login.roleManagement": "Yönetim",
  "login.position": "Yat pozisyonu",
  "login.selectPosition": "Yat pozisyonu seçin",
  "login.email": "E-posta",
  "login.password": "Şifre",
  "login.newPassword": "Yeni şifre",
  "login.repeatPassword": "Şifreyi tekrar girin",
  "login.minimumPassword": "Minimum 6 karakter",
  "login.minimumSignupPassword": "Minimum 8 karakter",
  "login.samePassword": "Aynı şifreyi tekrar girin",
  "login.passwordRequirements": "Büyük ve küçük harf, sayı ve en az 1 özel karakter kullanın.",
  "login.privacyAgree": "BlueDeck",
  "login.privacyPolicy": "Gizlilik Politikası’nı kabul ediyorum",
  "login.wait": "Lütfen bekleyin...",
  "login.loginButton": "My Dashboard’a giriş",
  "login.savePassword": "Yeni şifreyi kaydet",
  "login.createButton": "Güvenli hesap oluştur",
  "login.forgot": "Şifremi unuttum",
  "login.resend": "Onay e-postasını tekrar gönder",
  "login.protection": "BlueDeck yeni hesapları e-posta onayıyla korur. E-posta gelmezse spam klasörünü kontrol edin veya onayı tekrar gönderin.",
  "login.notice.newPasswordTwice": "Lütfen yeni şifrenizi iki kez girin.",
  "login.notice.minPassword": "Şifre en az 6 karakter olmalı.",
  "login.notice.signupPassword":
    "Şifre en az 8 karakter olmalı; büyük harf, küçük harf, sayı ve en az 1 özel karakter içermelidir.",
  "login.notice.passwordMismatch": "Şifreler eşleşmiyor.",
  "login.notice.passwordUpdated": "Şifreniz güncellendi. Lütfen yeni şifrenizle giriş yapın.",
  "login.notice.resetFailed": "BlueDeck şifre sıfırlamayı tamamlayamadı. Lütfen yeni sıfırlama e-postası isteyin.",
  "login.notice.emailPassword": "Lütfen e-posta ve şifrenizi girin.",
  "login.notice.required": "İsim, e-posta, şifre, telefon, hesap tipi ve yat pozisyonu zorunludur.",
  "login.notice.phone": "Lütfen ülke kodu seçin ve geçerli telefon numarası girin.",
  "login.notice.privacy": "Hesap oluşturmak için Gizlilik Politikası’nı kabul edin.",
  "login.notice.loginService": "BlueDeck giriş servisine ulaşamadı. Lütfen biraz sonra tekrar deneyin.",
  "login.notice.accountFailed": "Hesap oluşturulamadı. Lütfen tekrar deneyin.",
  "login.notice.confirmEmail": "Hesap oluşturuldu. Lütfen e-postanızı onaylayın, ardından giriş yapın.",
  "login.notice.accountCreated": "Hesap oluşturuldu. My Dashboard’a devam etmek için giriş yapın.",
  "login.notice.createFailed": "Hesap oluşturma isteği başarısız oldu. İnternet bağlantınızı kontrol edip tekrar deneyin.",
  "login.notice.enterEmail": "Önce e-postanızı girin.",
  "login.notice.confirmationSent": "Onay e-postası tekrar gönderildi. Lütfen gelen kutunuzu kontrol edin.",
  "login.notice.resendFailed": "BlueDeck onay e-postasını tekrar gönderemedi. Lütfen biraz sonra tekrar deneyin.",
  "password.strength": "Şifre gücü",
  "password.weak": "Zayıf",
  "password.medium": "Orta",
  "password.strong": "Güçlü",
  "forgot.eyebrow": "BlueDeck hesap kurtarma",
  "forgot.title": "Şifrenizi sıfırlayın",
  "forgot.intro": "E-posta adresinizi girin, şifrenizi sıfırlamak için güvenli bağlantı gönderelim.",
  "forgot.email": "E-posta adresi",
  "forgot.security": "Güvenlik doğrulaması",
  "forgot.invalidEmail": "Lütfen geçerli bir e-posta adresi girin.",
  "forgot.completeSecurity": "Lütfen güvenlik doğrulamasını tamamlayın.",
  "forgot.securityError": "Güvenlik doğrulaması yüklenemedi. Lütfen yenileyip tekrar deneyin.",
  "forgot.needsKeys": "Şifre sıfırlama için BlueDeck güvenlik doğrulamasında Cloudflare Turnstile anahtarları gerekir.",
  "forgot.sendFailed": "BlueDeck sıfırlama e-postasını gönderemedi. Lütfen tekrar deneyin.",
  "forgot.sendFailedMoment": "BlueDeck sıfırlama e-postasını gönderemedi. Lütfen biraz sonra tekrar deneyin.",
  "forgot.sent": "Bu e-posta BlueDeck hesabına aitse güvenli sıfırlama bağlantısı gönderildi.",
  "forgot.sending": "Sıfırlama bağlantısı gönderiliyor...",
  "forgot.send": "Sıfırlama bağlantısı gönder",
  "reset.checking": "Güvenli BlueDeck sıfırlama bağlantınız kontrol ediliyor...",
  "reset.incomplete": "Bu sıfırlama bağlantısı eksik veya süresi dolmuş. Lütfen yeni BlueDeck şifre sıfırlama e-postası isteyin.",
  "reset.ready": "BlueDeck hesabınız için yeni şifre seçin.",
  "reset.verifyFailed": "BlueDeck bu sıfırlama bağlantısını doğrulayamadı.",
  "reset.privateAccess": "Özel hesap erişimi",
  "reset.leftTitle": "Yeni şifrenizi güvenle belirleyin.",
  "reset.leftIntro": "Bu sayfa yalnızca e-postanızdaki güvenli sıfırlama bağlantısıyla çalışır. Kaydettikten sonra BlueDeck oturumu kapatır ve yeni girişiniz temiz başlar.",
  "reset.secureReset": "BlueDeck güvenli sıfırlama",
  "reset.updatedTitle": "Şifre güncellendi",
  "reset.expiredTitle": "Sıfırlama bağlantısı süresi doldu",
  "reset.createTitle": "Yeni şifre oluştur",
  "reset.newPassword": "Yeni şifre",
  "reset.repeatPassword": "Yeni şifreyi tekrar girin",
  "reset.saving": "Yeni şifre kaydediliyor...",
  "reset.save": "Yeni şifreyi kaydet",
  "reset.requestNew": "Yeni sıfırlama bağlantısı iste",
  "reset.updateFailed": "BlueDeck şifrenizi güncelleyemedi. Lütfen yeni sıfırlama bağlantısı isteyin.",
  "dashboard.loading": "Dashboard yükleniyor...",
  "dashboard.myDashboard": "My Dashboard",
  "dashboard.welcome": "Hoş geldiniz",
  "dashboard.role": "Rol",
  "dashboard.profilePhoto": "Profil fotoğrafı",
  "dashboard.updatingPhoto": "Fotoğraf güncelleniyor...",
  "settings.languageTitle": "Dil seçenekleri",
  "settings.languageDescription": "Bu cihazda BlueDeck arayüzünde kullanılacak dili seçin.",
  "settings.languageAvailable": "Mevcut diller: İngilizce ve Türkçe.",
  "offline.title": "BlueDeck Çevrimdışı",
  "offline.text": "Bağlantı yok. Yat sistem kabuğunuz hâlâ erişilebilir.",
};




export const translations: Record<Language, Record<TranslationKey, string>> = {
  en,
  tr,
};

const manualPhraseTranslations: Record<string, Partial<Record<Language, string>>> = {
  "Overview": { tr: "Genel Bakış" },
  "Checklist": { tr: "Kontrol Listesi" },
  "Checklists": { tr: "Kontrol Listeleri" },
  "Crew": { tr: "Mürettebat" },
  "Owner": { tr: "Sahip" },
  "Back to yacht": { tr: "Yata dön" },
  "← Back to yacht": { tr: "← Yata dön" },
  "BlueDeck Secure Access": { tr: "BlueDeck Güvenli Erişim" },
  "Opening private yacht workspace...": { tr: "Özel yat çalışma alanı açılıyor..." },
  "Private Yacht Command": { tr: "Özel Yat Komutası" },
  "Captain dashboard for crew invitations, duty proof, compliance documents, IMO crew list and owner-ready yacht operations.": {
    tr: "Mürettebat davetleri, görev kanıtları, uyum belgeleri, IMO mürettebat listesi ve sahip görünümüne hazır yat operasyonları için kaptan paneli.",
  },
  "Readiness": { tr: "Hazırlık" },
  "Invite / Manage Crew": { tr: "Mürettebat Davet / Yönet" },
  "Open Alerts": { tr: "Uyarıları Aç" },
  "Refresh": { tr: "Yenile" },
  "Reference": { tr: "Referans" },
  "Related yacht / vessel": { tr: "İlgili yat / tekne" },
  "Personal Details": { tr: "Kişisel Bilgiler" },
  "Personal details": { tr: "Kişisel Bilgiler" },
  "Identity, contact, photo and summary.": { tr: "Kimlik, iletişim, fotoğraf ve özet." },
  "Yacht Experience": { tr: "Yat Deneyimi" },
  "Yacht experience": { tr: "Yat Deneyimi" },
  "Yachts, duties, photos and references.": { tr: "Yatlar, görevler, fotoğraflar ve referanslar." },
  "Skills & Characteristics": { tr: "Beceriler ve Özellikler" },
  "Skills & characteristics": { tr: "Beceriler ve Özellikler" },
  "Skills, traits, preferences and seeking roles.": {
    tr: "Beceriler, özellikler, tercihler ve aranan roller.",
  },
  "Documents & Certificates": { tr: "Belgeler & Sertifikalar" },
  "Certificates and CV visibility.": { tr: "Sertifikalar ve CV görünürlüğü." },
  "Photo Gallery": { tr: "Fotoğraf Galerisi" },
  "Yacht and work photos.": { tr: "Yat ve iş fotoğrafları." },
  "Manage your crew ID, documents, expiry dates, photo gallery and CV.": {
    tr: "Crew ID'nizi, belgelerinizi, bitiş tarihlerini, fotoğraf galerinizi ve CV'nizi yönetin.",
  },
  "BlueDeck may collect name, email address, phone number, account type, yacht position, profile details, maritime documents, expiry dates, yacht experience, references, photo gallery images, invitations, contracts and checklist activity.": {
    tr: "BlueDeck ad, e-posta adresi, telefon numarası, hesap türü, yat pozisyonu, profil detayları, denizcilik belgeleri, bitiş tarihleri, yat deneyimi, referanslar, fotoğraf galerisi görselleri, davetler, kontratlar ve kontrol listesi aktivitelerini toplayabilir.",
  },
  "Documents and images uploaded by users are used for profile, CV, photo gallery, yacht record, checklist proof and operational history purposes inside the BlueDeck account experience.": {
    tr: "Kullanıcıların yüklediği belgeler ve görseller BlueDeck hesap deneyimi içinde profil, CV, fotoğraf galerisi, yat kaydı, kontrol listesi kanıtı ve operasyon geçmişi amaçlarıyla kullanılır.",
  },
  "Professional photo gallery": { tr: "Profesyonel fotoğraf galerisi" },
  "Add professional photos from your yacht work, service moments, onboard projects or maritime experience. They will appear as a clean photo grid on your BlueDeck CV.": {
    tr: "Bu bölümde yat çalışmalarınızdan, servis anlarından, tekne üzerindeki projelerden veya denizcilik deneyiminizden profesyonel fotoğraflar ekleyebilirsiniz. Fotoğraflar BlueDeck CV'nizde temiz bir grid olarak görünür.",
  },
  "Add a gallery photo": { tr: "Galeri fotoğrafı ekle" },
  "Photos are saved automatically after upload.": {
    tr: "Fotoğraflar yüklendikten sonra otomatik kaydedilir.",
  },
  "No gallery photos yet. Add another photo whenever you are ready.": {
    tr: "Henüz galeri fotoğrafı yok. Hazır olduğunuzda yeni bir fotoğraf ekleyebilirsiniz.",
  },
  "Show on CV": { tr: "CV'de göster" },
  "Languages": { tr: "Diller" },
  "Language level profile.": { tr: "Dil seviyesi profili." },
  "Preview / Download": { tr: "Önizleme / İndir" },
  "Review the final CV and save PDF.": { tr: "Final CV'yi gözden geçir ve PDF olarak kaydet." },
  "Review the final CV and download PDF.": { tr: "Final CV'yi gözden geçir ve PDF olarak indir." },
  "PDF ready": { tr: "PDF hazır" },
  "BlueDeck Profile": { tr: "BlueDeck Profili" },
  "Professional Crew Profile": { tr: "Profesyonel Mürettebat Profili" },
  "Build a clean yachting CV from verified profile data, documents, work preferences, skills, references and photo gallery.": {
    tr: "Doğrulanmış profil verileri, belgeler, çalışma tercihleri, beceriler, referanslar ve fotoğraf galerisinden temiz bir yatçılık CV'si oluştur.",
  },
  "Experience": { tr: "Deneyim" },
  "Alerts": { tr: "Uyarılar" },
  "Actions": { tr: "Aksiyonlar" },
  "Save profile": { tr: "Profili kaydet" },
  "Saving...": { tr: "Kaydediliyor..." },
  "Saved": { tr: "Kaydedildi" },
  "Unsaved": { tr: "Kaydedilmedi" },
  "Contracts": { tr: "Kontratlar" },
  "My checklists": { tr: "Kontrol listelerim" },
  "Final BlueDeck CV": { tr: "Final BlueDeck CV" },
  "Review the generated CV below. Use the Save as PDF button inside the preview to download the exact CV layout.": {
    tr: "Oluşturulan CV'yi aşağıda gözden geçir. Birebir CV tasarımını indirmek için önizleme içindeki PDF olarak kaydet butonunu kullan.",
  },
  "Review the generated CV below. Use the Download button inside the preview to save the exact CV layout.": {
    tr: "Oluşturulan CV'yi aşağıda gözden geçir. Birebir CV tasarımını kaydetmek için önizleme içindeki İndir butonunu kullan.",
  },
  "Download": { tr: "İndir" },
  "Gender": { tr: "Cinsiyet" },
  "Male": { tr: "Erkek" },
  "Female": { tr: "Kadın" },
  "Date of Birth": { tr: "Doğum tarihi" },
  "Date of birth": { tr: "Doğum tarihi" },
  "Nationality": { tr: "Uyruk" },
  "Height": { tr: "Boy" },
  "Height cm": { tr: "Boy cm" },
  "Weight": { tr: "Kilo" },
  "Weight kg": { tr: "Kilo kg" },
  "Smoker": { tr: "Sigara" },
  "Visible tattoos": { tr: "Görünür dövme" },
  "Mobile number": { tr: "Telefon numarası" },
  "Name and surname": { tr: "İsim ve soyisim" },
  "CV docs": { tr: "CV belgeleri" },
  "Verified Crew Profile": { tr: "Doğrulanmış Mürettebat Profili" },
  "BlueDeck Verified CV": { tr: "BlueDeck Doğrulanmış CV" },
  "Verified crew profile prepared by BlueDeck.app": {
    tr: "BlueDeck.app tarafından hazırlanmış doğrulanmış mürettebat profili",
  },
  "Crew profile / Yacht recruitment": { tr: "Mürettebat profili / Yat işe alımı" },
  "About Me": { tr: "Hakkımda" },
  "Yacht name": { tr: "Yat adı" },
  "Yacht type": { tr: "Yat tipi" },
  "Yacht program": { tr: "Yat programı" },
  "Yacht size": { tr: "Yat boyu" },
  "Size": { tr: "Boy" },
  "Motor yacht": { tr: "Motor yat" },
  "Sailing yacht": { tr: "Yelkenli yat" },
  "Catamaran": { tr: "Katamaran" },
  "Motor catamaran": { tr: "Motor katamaran" },
  "Gulet": { tr: "Gulet" },
  "Expedition yacht": { tr: "Expedition yat" },
  "Classic yacht": { tr: "Klasik yat" },
  "Support vessel": { tr: "Destek teknesi" },
  "Chase boat": { tr: "Takip botu" },
  "Commercial vessel": { tr: "Ticari tekne" },
  "Private": { tr: "Özel" },
  "Charter": { tr: "Charter" },
  "Private / Charter": { tr: "Özel / Charter" },
  "New build": { tr: "Yeni inşa" },
  "Refit": { tr: "Refit" },
  "Delivery": { tr: "Teslim seyri" },
  "Yard period": { tr: "Tersane dönemi" },
  "Race / Regatta": { tr: "Yarış / Regatta" },
  "Captain-grade maritime CV prepared from BlueDeck profile data for private yacht recruitment and management review.": {
    tr: "Özel yat işe alımı ve yönetim incelemesi için BlueDeck profil verilerinden hazırlanmış kaptan seviyesinde denizcilik CV'si.",
  },
  "Mode": { tr: "Mod" },
  "Flag": { tr: "Bayrak" },
  "Voyage": { tr: "Seyir" },
  "Privacy": { tr: "Gizlilik" },
  "Standby": { tr: "Beklemede" },
  "Active": { tr: "Aktif" },
  "Today": { tr: "Bugün" },
  "Yacht Readiness": { tr: "Yat Hazırlığı" },
  "Loading live yacht data": { tr: "Canlı yat verisi yükleniyor" },
  "Crew portal connected": { tr: "Mürettebat portalı bağlı" },
  "Crew portal ready": { tr: "Mürettebat portalı hazır" },
  "No active expiry pressure": { tr: "Aktif bitiş tarihi baskısı yok" },
  "Captain, crew and owner modules are connected": { tr: "Kaptan, mürettebat ve sahip modülleri bağlı" },
  "Connected Workspaces": { tr: "Bağlı Çalışma Alanları" },
  "Notification Center": { tr: "Bildirim Merkezi" },
  "Recent Activity": { tr: "Son Aktivite" },
  "Yacht Log": { tr: "Yat Günlüğü" },
  "No activity yet. Start by inviting crew or assigning a checklist.": {
    tr: "Henüz aktivite yok. Mürettebat davet ederek veya kontrol listesi atayarak başlayın.",
  },
  "Crew Command": { tr: "Mürettebat Komutası" },
  "Checklist System": { tr: "Kontrol Listesi Sistemi" },
  "Crew My YachtOS": { tr: "Mürettebat My YachtOS" },
  "IMO Crew List": { tr: "IMO Mürettebat Listesi" },
  "Document Vault": { tr: "Belge Kasası" },
  "Expiry Alerts": { tr: "Bitiş Uyarıları" },
  "Engineering": { tr: "Mühendislik" },
  "Safety Center": { tr: "Güvenlik Merkezi" },
  "Operations": { tr: "Operasyonlar" },
  "Owner View": { tr: "Sahip Görünümü" },
  "Open module": { tr: "Modülü aç" },
  "Course": { tr: "Rota" },
  "Speed": { tr: "Hız" },
  "Provider Required": { tr: "Sağlayıcı Gerekli" },
  "Fuel": { tr: "Yakıt" },
  "Sea": { tr: "Deniz" },
  "Operational": { tr: "Operasyonel" },
  "Monitoring": { tr: "İzleniyor" },
  "Browser Active": { tr: "Tarayıcı Aktif" },
  "BlueDeck Expiry Monitoring": { tr: "BlueDeck Bitiş Takibi" },
  "Track expiring yacht papers, insurance, crew documents, certificates and compliance items.": {
    tr: "Bitişi yaklaşan yat evraklarını, sigortayı, mürettebat belgelerini, sertifikaları ve uyum kalemlerini takip edin.",
  },
  "Sync Document Alerts": { tr: "Belge Uyarılarını Eşitle" },
  "Go to Documents": { tr: "Belgelere Git" },
  "Documents with expiry dates found:": { tr: "Bitiş tarihi olan belgeler:" },
  "Expired": { tr: "Süresi Dolmuş" },
  "Critical": { tr: "Kritik" },
  "Warning": { tr: "Uyarı" },
  "Warnings": { tr: "Uyarılar" },
  "Normal": { tr: "Normal" },
  "Active Alerts": { tr: "Aktif Uyarılar" },
  "No active expiry alerts. Click sync after uploading documents with expiry dates.": {
    tr: "Aktif bitiş uyarısı yok. Bitiş tarihli belgeleri yükledikten sonra eşitlemeye tıklayın.",
  },
  "BlueDeck Documents": { tr: "BlueDeck Belgeleri" },
  "Yacht Documents": { tr: "Yat Belgeleri" },
  "Store certificates, licenses, manuals, insurance, contracts and crew files.": {
    tr: "Sertifikaları, lisansları, kılavuzları, sigortayı, kontratları ve mürettebat dosyalarını saklayın.",
  },
  "Upload Document": { tr: "Belge Yükle" },
  "Document title": { tr: "Belge başlığı" },
  "License": { tr: "Lisans" },
  "Technical": { tr: "Teknik" },
  "Insurance": { tr: "Sigorta" },
  "Manual": { tr: "Kılavuz" },
  "Contract": { tr: "Kontrat" },
  "Yacht Papers": { tr: "Yat Evrakları" },
  "Invoice": { tr: "Fatura" },
  "Other": { tr: "Diğer" },
  "Uploading...": { tr: "Yükleniyor..." },
  "Documents": { tr: "Belgeler" },
  "Total:": { tr: "Toplam:" },
  "Loading documents...": { tr: "Belgeler yükleniyor..." },
  "No documents uploaded yet.": { tr: "Henüz belge yüklenmedi." },
  "Selected file:": { tr: "Seçilen dosya:" },
  "Selected file": { tr: "Seçilen dosya" },
  "Open": { tr: "Aç" },
  "Delete": { tr: "Sil" },
  "BlueDeck Realtime System": { tr: "BlueDeck Gerçek Zamanlı Sistem" },
  "Realtime operational notifications from crew tasks, engineering, expiry alerts, voyage risk and yacht events.": {
    tr: "Mürettebat görevleri, mühendislik, bitiş uyarıları, seyir riski ve yat olaylarından gerçek zamanlı operasyon bildirimleri.",
  },
  "Generate Smart Notifications": { tr: "Akıllı Bildirim Oluştur" },
  "Generating...": { tr: "Oluşturuluyor..." },
  "Total": { tr: "Toplam" },
  "Unread": { tr: "Okunmamış" },
  "Live Feed": { tr: "Canlı Akış" },
  "Realtime": { tr: "Gerçek Zamanlı" },
  "Connected": { tr: "Bağlı" },
  "This page listens for new notifications and updates automatically.": {
    tr: "Bu sayfa yeni bildirimleri dinler ve otomatik güncellenir.",
  },
  "Mark Read": { tr: "Okundu Yap" },
  "Resolve": { tr: "Çöz" },
  "No notifications yet. Click Generate Smart Notifications.": {
    tr: "Henüz bildirim yok. Akıllı Bildirim Oluştur'a tıklayın.",
  },
  "MMSI number (9 digits)": {
    tr: "MMSI numarası (9 hane)",
  },
  "MMSI must be 9 digits.": {
    tr: "MMSI 9 haneli olmalıdır.",
  },
  "MarineTraffic Voyage Sync": {
    tr: "MarineTraffic Seyir Eşitleme",
  },
  "Enter a yacht MMSI once and BlueDeck pulls the live AIS record into voyage, position and captain command screens automatically.": {
    tr: "Yat MMSI numarasını bir kez girin; BlueDeck canlı AIS kaydını otomatik olarak seyir, konum ve kaptan komuta ekranlarına çeker.",
  },
  "Refresh MarineTraffic": {
    tr: "MarineTraffic'i Yenile",
  },
  "Syncing MarineTraffic voyage...": {
    tr: "MarineTraffic seyri eşitleniyor...",
  },
  "MarineTraffic voyage is waiting": {
    tr: "MarineTraffic seyri bekliyor",
  },
  "Add a 9-digit MMSI number to this yacht and configure the MarineTraffic API key to activate automatic voyage sync.": {
    tr: "Otomatik seyir eşitlemesini etkinleştirmek için bu yata 9 haneli MMSI numarası ekleyin ve MarineTraffic API anahtarını yapılandırın.",
  },
  "No demo route is shown here.": {
    tr: "Burada demo rota gösterilmez.",
  },
  "Active AIS Voyage": {
    tr: "Aktif AIS Seyri",
  },
  "MarineTraffic MMSI sync pulls AIS destination, ETA and live voyage into BlueDeck.": {
    tr: "MarineTraffic MMSI eşitlemesi AIS varış noktası, ETA ve canlı seyri BlueDeck'e çeker.",
  },
  "Voyage Sync": {
    tr: "Seyir Eşitleme",
  },
  "Save MMSI": {
    tr: "MMSI Kaydet",
  },
  "Maritime Voyage Sync": {
    tr: "Denizcilik Seyir Eşitleme",
  },
  "Refresh AIS Provider": {
    tr: "AIS Sağlayıcısını Yenile",
  },
  "Syncing maritime voyage...": {
    tr: "Denizcilik seyri eşitleniyor...",
  },
  "Maritime voyage is waiting": {
    tr: "Denizcilik seyri bekliyor",
  },
  "Add a 9-digit MMSI number to this yacht and configure a maritime AIS API key to activate automatic voyage sync.": {
    tr: "Otomatik seyir eşitlemesini etkinleştirmek için bu yata 9 haneli MMSI numarası ekleyin ve bir denizcilik AIS API anahtarı yapılandırın.",
  },
  "Maritime MMSI sync pulls AIS destination, ETA and live voyage into BlueDeck.": {
    tr: "Denizcilik MMSI eşitlemesi AIS varış noktası, ETA ve canlı seyri BlueDeck'e çeker.",
  },
};

export const phraseTranslations: Record<string, Partial<Record<Language, string>>> = {
  ...generatedPhraseTranslations,
  ...manualPhraseTranslations,
};

function normalizeTranslationPhrase(phrase: string) {
  return phrase.replace(/\s+/g, " ").trim();
}

const normalizedPhraseTranslations = Object.entries(phraseTranslations).reduce<
  Record<string, Partial<Record<Language, string>>>
>((lookup, [phrase, value]) => {
  const normalized = normalizeTranslationPhrase(phrase).toLocaleLowerCase("en-US");
  lookup[normalized] = value;
  return lookup;
}, {});

function translateDynamicPhrase(phrase: string, language: Language) {
  if (language !== "tr") return phrase;

  const countMatch = phrase.match(/^(\d+)\s+(added|saved|selected|docs|photos)$/i);
  if (countMatch) {
    const [, count, label] = countMatch;
    const labels: Record<string, string> = {
      added: "eklendi",
      docs: "belge",
      photos: "fotoğraf",
      saved: "kaydedildi",
      selected: "seçildi",
    };
    return `${count} ${labels[label.toLocaleLowerCase("en-US")]}`;
  }

  const alertMatch = phrase.match(/^(\d+)\s+(alert|alerts)$/i);
  if (alertMatch) return `${alertMatch[1]} uyarı`;

  const cvDocsMatch = phrase.match(/^(\d+)\s+CV docs$/i);
  if (cvDocsMatch) return `${cvDocsMatch[1]} CV belgesi`;

  const yearsMatch = phrase.match(/^(\d+\+?)\s*(yrs|years)$/i);
  if (yearsMatch) return `${yearsMatch[1]} yıl`;

  return phrase;
}

export function translatePhrase(phrase: string, language: Language) {
  if (language === "en") return phrase;

  const direct = phraseTranslations[phrase]?.[language];
  if (direct) return direct;

  const normalized = normalizeTranslationPhrase(phrase);
  const normalizedDirect = phraseTranslations[normalized]?.[language];
  if (normalizedDirect) return normalizedDirect;

  const dynamic = translateDynamicPhrase(normalized, language);
  if (dynamic !== normalized) return dynamic;

  return (
    normalizedPhraseTranslations[normalized.toLocaleLowerCase("en-US")]?.[language] ||
    phrase
  );
}

export function isLanguage(value: string | null | undefined): value is Language {
  return Boolean(value && languages.some((language) => language.code === value));
}

export type { TranslationKey };
