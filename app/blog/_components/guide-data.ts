import "server-only";
import { getGuideSummary, legacyGuideSlugs, type GuideLanguage, type GuideSummary } from "./guide-index";

// Preserve server consumers while public components import guide-index directly.
export { guideBase, guideHref } from "./guide-index";

export type GuideSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type Guide = GuideSummary & {
  takeaway: string;
  sections: GuideSection[];
  checklist: string[];
  ctaTitle: string;
  ctaDescription: string;
  ctaLabel: string;
  ctaHref: string;
};

const turkishGuides: Guide[] = [
  {
    ...getGuideSummary("first-yacht-job", "tr"),
    takeaway:
      "İyi bir başlangıç, her ilana başvurmakla değil; ne yapabildiğini, ne öğrenmek istediğini ve ne zaman hazır olduğunu açıkça anlatmakla başlar.",
    sections: [
      {
        id: "sana-uygun-rol",
        title: "Önce sana uygun rolü belirle",
        paragraphs: [
          "Yat sektörüne girmeye karar verdiğinde ilk adım, çalışmak istediğin bölümün günlük işini anlamaktır. Güverte, iç hizmetler, mutfak ve teknik ekip farklı beceriler kullanır. İlanlardaki görev tanımlarını yan yana oku; yalnızca unvana değil, bir gün içinde senden beklenen işlere bak. Hareketli bir dış ortam mı, detaylı servis hazırlığı mı, yoksa teknik sorunları çözmek mi seni daha çok motive ediyor?",
          "Daha önce yat üzerinde çalışmamış olman, aktarabileceğin bir deneyimin olmadığı anlamına gelmez. Otelcilik, restoran, bakım, organizasyon veya müşteri ilişkilerindeki görevlerinden somut örnekler çıkar. Örneğin yoğun bir serviste öncelik belirlemen ya da bir ekiple düzenli vardiya devretmen, yeni rolünü anlatırken kullanabileceğin gerçek bir deneyimdir.",
        ],
      },
      {
        id: "basvuru-dosyasi",
        title: "Küçük ama eksiksiz bir başvuru dosyası hazırla",
        paragraphs: [
          "CV, kısa bir tanıtım metni ve güncel iletişim bilgilerin birbiriyle tutarlı olsun. Hedeflediğin rolü, bulunduğun şehri, işe başlayabileceğin tarihi ve kullanabildiğin dilleri kolayca görülecek şekilde yaz. Deneyimini olduğundan büyük göstermeden, yaptığın işi ve aldığın sorumluluğu açıklayan kısa cümleler kur. Okuyan kişinin önce kim olduğunu, sonra neden bu role başvurduğunu anlamasını sağla.",
          "İlanın istediği belgeleri tek tek kontrol et ve yalnızca gerçekten sahip olduğun eğitimleri belirt. Hangi belgenin gerekli olduğu konusunda belirsizlik varsa işverenden açıklama iste. İlk iletişimde istenmeyen kişisel belgeleri topluca göndermek yerine, paylaşılacak dosyayı ve başvuru kanalını netleştir. Dosyana anlaşılır bir isim ver ve bağlantıların açıldığını başka bir cihazda kontrol et.",
        ],
      },
      {
        id: "ilan-secimi",
        title: "Başvurunu ilandaki ihtiyaçla ilişkilendir",
        paragraphs: [
          "Kendine kısa bir ilan değerlendirme listesi oluştur: görevler, deneyim beklentisi, çalışma dönemi, konum ve başlangıç tarihi. Her maddeyi mevcut durumunla karşılaştır. Sana uyan ilanları seçtikten sonra başvuru mesajının ilk iki cümlesini o role göre yaz. Hangi pozisyon için iletişim kurduğunu ve hangi deneyiminin ilgili olduğunu açıkça belirtmen, uzun bir genel tanıtımdan daha kullanışlıdır.",
          "Başvurularını basit bir tabloda takip et. İlan bağlantısı, başvuru tarihi, iletişim kişisi ve bir sonraki adımı kaydet. Böylece aynı ilana farklı mesajlar göndermez, görüşme geldiğinde hangi ekipten haber aldığını kolayca hatırlarsın. Yanıt beklerken profilindeki eksikleri tamamlamak ve benzer görevleri incelemek, süreci daha planlı yürütmeni sağlar.",
        ],
      },
      {
        id: "ilk-gorusme",
        title: "Görüşmeye örneklerle hazırlan",
        paragraphs: [
          "Kendini bir dakikada tanıtabileceğin doğal bir anlatım hazırla: bugüne kadar ne yaptın, hangi role yöneliyorsun ve bu ekibe ne katabilirsin? Ardından üç gerçek örnek seç. Yoğunlukla başa çıktığın bir anı, ekip içinde çözdüğün bir sorunu ve yeni bir işi nasıl öğrendiğini anlat. Henüz yapmadığın bir görev sorulursa bunu açıkça söyle ve öğrenme yaklaşımını paylaş.",
          "Senin soruların da görüşmenin parçası olsun. İlk haftadaki sorumlulukları, kime rapor vereceğini, ekip düzenini ve değerlendirme sürecini sor. Görüşme sonunda bir sonraki adımı ve yaklaşık zamanlamayı öğren. Konuşma biter bitmez önemli noktaları not almak, farklı fırsatları sakin biçimde karşılaştırmana yardımcı olur.",
        ],
      },
      {
        id: "harekete-gec",
        title: "Bir sonraki adımı somutlaştır",
        paragraphs: [
          "Hazırlığını bitirmek için belirsiz bir hedef yerine küçük bir plan yap. Bugün hedef rolünü seç; ardından CV ve profilindeki bilgileri eşleştir. Başvurmadan önce ilanı bir kez daha oku ve mesajında karşılık vermediğin bir beklenti kalıp kalmadığını kontrol et. İlk başvurun kusursuz olmak zorunda değil, ama seni doğru ve anlaşılır biçimde temsil etmeli.",
        ],
      },
    ],
    checklist: [
      "Hedeflediğim rolü ve başlangıç tarihimi belirledim.",
      "CV ve profil bilgilerimi güncelledim.",
      "İlandaki beklentileri tek tek kontrol ettim.",
      "Görüşme için üç gerçek deneyim örneği hazırladım.",
    ],
    ctaTitle: "İlk adımını profilinle at.",
    ctaDescription:
      "Deneyimini, becerilerini ve kariyer hedefini aynı yerde bir araya getir.",
    ctaLabel: "Crew profilini oluştur",
    ctaHref: "/login?mode=signup&role=crew",
  },
  {
    ...getGuideSummary("yacht-crew-cv", "tr"),
    takeaway:
      "CV’nin görevi bütün hayatını anlatmak değil; başvurduğun işi yapabilmeni sağlayan deneyim ve becerileri kolayca görünür kılmaktır.",
    sections: [
      {
        id: "ilk-bakis",
        title: "İlk bakışta temel soruları yanıtla",
        paragraphs: [
          "CV’nin üst kısmında adın, hedeflediğin pozisyon, iletişim bilgilerin, bulunduğun şehir ve uygunluk tarihin yer alsın. Bu alanı uzun bir kişisel tanıtımla doldurmak yerine, başvuruyu değerlendiren kişinin ilk sorularını yanıtla. E-posta adresinin doğru yazıldığını, telefon numaranda ülke kodu bulunduğunu ve paylaştığın profil bağlantısının çalıştığını kontrol et. Küçük ayrıntılar, seninle iletişim kurulmasını kolaylaştırır.",
          "Kısa profil paragrafını başvurduğun role göre düzenle. Kaç farklı sıfatla kendini övebildiğinden çok, hangi deneyimi getirdiğin ve nerede gelişmek istediğin anlaşılsın. Örneğin otelcilikten iç hizmetlere geçiyorsan servis düzeni, misafir iletişimi ve ekip çalışmasındaki deneyimini birbirine bağla. Henüz yat deneyimin yoksa bunu saklamak yerine güçlü olduğun alanları açıkça tarif et.",
        ],
      },
      {
        id: "somut-deneyim",
        title: "Görev listesini somut deneyime dönüştür",
        paragraphs: [
          "Deneyimlerini en güncel olandan başlayarak sırala. Her pozisyon için tarih aralığı, görev adı ve çalıştığın ortamı belirt. Ardından birkaç kısa maddeyle hangi işleri üstlendiğini anlat. Sadece “servisten sorumluydum” demek yerine, servis öncesi hazırlığı, malzeme takibini ve vardiya devrini nasıl yürüttüğünü yaz. Sayı kullanıyorsan gerçek ve açıklayabileceğin bir bilgi olduğundan emin ol.",
          "Gizlilik gerektiren işlerde tekne ya da misafir adı paylaşmadan da deneyimini anlatabilirsin. Rolünü ve sorumluluklarını anlaşılır kılman yeterli. Kariyerine yeni başlıyorsan staj, proje ve sezonluk işlerini değerlendirebilirsin; ancak bunları profesyonel yat deneyimi gibi sunma. CV ile görüşmede anlattıklarının birbiriyle tutarlı olması, kendini rahat ifade etmeni de sağlar.",
        ],
      },
      {
        id: "beceriler",
        title: "Becerileri işin diliyle yaz",
        paragraphs: [
          "Beceri bölümünü ilandaki görevlerle birlikte düşün. Kullanabildiğin araçları, servis veya bakım deneyimini, dil seviyelerini ve ilgili eğitimlerini ayrı başlıklarda topla. “İletişimi kuvvetli” gibi tek başına belirsiz kalan ifadeleri çoğaltmak yerine, bu beceriyi nerede kullandığını deneyim bölümünde göster. Aynı bilgiyi üç farklı yerde tekrar etmek CV’yi uzatır ve önemli noktaları gizler.",
          "Dil bilgin için günlük konuşma, misafir iletişimi veya iş ortamındaki kullanımını gerçekçi biçimde değerlendir. Eğitim ve sertifikaların adlarını belgelerinde yazdığı şekliyle ekle; henüz tamamlanmamış bir programı bitmiş gibi gösterme. Başvurduğun pozisyon açısından ilgisiz kalan uzun listeleri kısalt. Amaç, değerlendirmenin ilk aşamasında gereken bilgilere kolay erişim sağlamaktır.",
        ],
      },
      {
        id: "duzen-ve-kontrol",
        title: "Okunabilir bir dosya oluştur",
        paragraphs: [
          "Sade başlıklar, tutarlı tarih biçimi ve rahat okunan bir yazı boyutu kullan. Bölümler arasında boşluk bırak; deneyimini küçücük metinlerle tek sayfaya sıkıştırma. Özellikle ilk iş başvurularında kısa ve odaklı bir içerik işini kolaylaştırır. Belgeyi PDF olarak dışa aktardıktan sonra bilgisayarda ve telefonda aç. Satır taşması, kesilen metin veya kopuk bağlantı olup olmadığını kontrol et.",
          "Dosya adında adını ve hedef rolünü kullanarak farklı sürümleri düzenli tut. Eski bir başvuru için yazdığın rol adının yeni dosyada kalmadığından emin ol. Referans bilgilerini paylaşmadan önce ilgili kişiye haber ver. Son kontrolü mümkünse metni yüksek sesle okuyarak yap; bu yöntem uzun cümleleri, tekrarlanan kelimeleri ve tarih tutarsızlıklarını fark etmeyi kolaylaştırır.",
        ],
      },
      {
        id: "profil-uyumu",
        title: "CV ve profilini birlikte güncel tut",
        paragraphs: [
          "CV’ni güncellediğinde dijital profilini de gözden geçir. Pozisyon adları, tarihler, konum ve uygunluk bilgilerinin birbiriyle eşleşmesi gerekir. Yeni bir görev veya eğitim ekledikten sonra eski bilgileri de kontrol et. Her başvuru için belgeyi baştan yazmak yerine, doğru bilgileri içeren ana bir sürüm tut ve ilgili deneyimleri başvuracağın role göre öne çıkar.",
        ],
      },
    ],
    checklist: [
      "Hedef rolüm ve iletişim bilgilerim ilk bakışta görünüyor.",
      "Deneyimlerimi somut görevlerle açıkladım.",
      "PDF dosyamı telefonda da kontrol ettim.",
      "CV ve dijital profilimdeki bilgiler eşleşiyor.",
    ],
    ctaTitle: "Profilin de CV’n kadar hazır olsun.",
    ctaDescription:
      "Deneyim, beceri ve uygunluk bilgilerini güncelleyerek kendini tutarlı biçimde anlat.",
    ctaLabel: "Profilini düzenle",
    ctaHref: "/profile",
  },
  {
    ...getGuideSummary("first-week-onboard", "tr"),
    takeaway:
      "İlk hafta her şeyi bilmek zorunda değilsin. Dikkatle dinlemek, doğru kişiye soru sormak ve öğrendiklerini düzenli uygulamak iyi bir başlangıç sağlar.",
    sections: [
      {
        id: "gelmeden-once",
        title: "Gelmeden önce beklentileri netleştir",
        paragraphs: [
          "Tekneye katılmadan önce buluşma yerini, saatini ve iletişim kuracağın kişiyi teyit et. Yanında getirmen beklenen eşyaları, kıyafetleri ve kişisel kullanım alanlarının koşullarını sor. Gereksiz hazırlık yapmak yerine ekibin verdiği listeyi temel al. Yolculuk veya varış planın değişirse ilgili kişiye zamanında bilgi ver. İlk günün daha sakin geçmesi, çoğu zaman bu küçük organizasyon adımlarıyla başlar.",
          "Bir not defteri ya da düzenli kullanabileceğin bir not uygulaması hazır bulundur. İlk gün çok sayıda isim, yer ve görev duyacaksın. Her şeyi aklında tutmaya çalışmak yerine önemli bilgileri kısa notlarla kaydetmek daha rahat ilerlemeni sağlar. Başlamadan önce konuşulan rol ile sahada açıklanan sorumluluklar arasında belirsizlik varsa bunu erkenden ve açık bir dille sor.",
        ],
      },
      {
        id: "ekip-duzeni",
        title: "Kimden ne öğrenebileceğini bil",
        paragraphs: [
          "İlk tanışmalarda ekipteki kişilerin isimlerini ve görevlerini öğrenmeye odaklan. Kime rapor vereceğini, günlük planı nereden takip edeceğini ve bir iş tamamlandığında nasıl bilgi vereceğini netleştir. Birden fazla kişiden farklı öncelikler duyduğunda kendi başına tahmin etmek yerine sorumlunla sıralamayı teyit et. Bu yaklaşım, özellikle yoğun saatlerde hem senin hem ekibin işini kolaylaştırır.",
          "Tanıtım ve işe alışma sürecinde anlatılan tekneye özgü uygulamaları dikkatle dinle. Daha önce başka bir yerde öğrendiğin yöntemin burada da aynı olduğunu varsayma. Tanımadığın bir ekipman veya görevle karşılaştığında kullanımını bilen kişiden açıklama iste. Not aldığın bir bilgiyi uygulamadan önce anlamadığın kısmı yeniden sormak, yanlış bir alışkanlık geliştirmekten daha faydalıdır.",
        ],
      },
      {
        id: "ortak-yasam",
        title: "Ortak alanlarda küçük alışkanlıklar fark yaratır",
        paragraphs: [
          "Teknede çalışma düzeni ile ortak yaşam birbirine yakındır. Eşyalarını belirlenen alanlarda tutmak, kullandığın yeri düzenli bırakmak ve ortak malzemeyi yerine koymak günlük akışı destekler. Kabin, yemek alanı ve çamaşır kullanımıyla ilgili ekibin alışkanlıklarını öğren. Sana küçük görünen bir dağınıklığın başkasının işini veya dinlenmesini etkileyebileceğini düşünerek hareket et.",
          "İletişimde kısa, saygılı ve açık ol. Bir malzemenin azaldığını ya da bir görevin beklediğinden uzun süreceğini fark ettiğinde ilgili kişiyi haberdar et. Misafirler ve ekip arkadaşlarıyla ilgili bilgileri paylaşırken teknenin iletişim kurallarını öğren; fotoğraf çekmek veya sosyal medyada içerik yayımlamak için uygun süreci sor. Ortak yaşamda güven, tekrar eden küçük davranışlarla gelişir.",
        ],
      },
      {
        id: "is-takibi",
        title: "Görevi almak kadar devretmek de önemli",
        paragraphs: [
          "Yeni bir görev aldığında beklenen sonucu, önceliği ve zamanlamayı anladığından emin ol. Gerekiyorsa duyduğunu kendi cümlenle kısaca tekrar et. İşi bitirdiğinde yalnızca tamamlandığını söylemek yerine, kontrol edilmesi gereken bir ayrıntı veya eksik kalan bir adım varsa belirt. Böylece sonraki işi devralan kişi aynı bilgiyi yeniden aramak zorunda kalmaz.",
          "Günün sonunda kısa bir değerlendirme yap: bugün ne öğrendin, hangi konuda hâlâ yardıma ihtiyacın var ve yarın neyi daha düzenli yapabilirsin? Notlarını görev türlerine göre ayırmak zamanla kişisel bir çalışma rehberi oluşturur. Ekip tarafından paylaşılan güncel talimatları esas al; kendi notlarını bir başkasına resmi süreç gibi aktarmadan önce doğruluğunu kontrol et.",
        ],
      },
      {
        id: "geri-bildirim",
        title: "İlk haftayı kısa bir geri bildirimle tamamla",
        paragraphs: [
          "Uygun bir zamanda sorumlundan ilk haftanla ilgili kısa bir değerlendirme iste. “Neyi daha iyi yapabilirim?” sorusuna ek olarak belirli bir görevi de konuşabilirsin. Aldığın önerilerden bir veya ikisini seçip sonraki hafta uygulamaya odaklan. Ekibin düzenine alışmak zaman alır; ilerlemeyi her işi tek başına yapmakla değil, görevlerini daha net anlayıp daha tutarlı yerine getirmekle değerlendir.",
        ],
      },
    ],
    checklist: [
      "Varış planımı ve iletişim kişimi teyit ettim.",
      "Günlük planı ve raporlama düzenini öğrendim.",
      "Ortak alanların kullanım kurallarını not aldım.",
      "İlk haftam için kısa bir geri bildirim istedim.",
    ],
    ctaTitle: "Sana uygun ekibi bul.",
    ctaDescription:
      "Bir sonraki adımın için rollerin beklentilerini incele ve sana uygun fırsatları keşfet.",
    ctaLabel: "Açık pozisyonları incele",
    ctaHref: "/jobs",
  },
];

const englishGuides: Guide[] = [
  {
    ...getGuideSummary("first-yacht-job"),
    takeaway:
      "A strong start comes from explaining what you can do, what you want to learn and when you are available, rather than applying to every vacancy.",
    sections: [
      {
        id: "sana-uygun-rol",
        title: "Start by finding the right role for you",
        paragraphs: [
          "Once you decide to enter the yachting industry, your first step is to understand the day-to-day work of each department. Deck, interior, galley and engineering roles call for different skills. Compare job descriptions side by side and look beyond the title to the tasks you would actually do. Are you most motivated by an active outdoor environment, detailed service preparation or solving technical problems?",
          "You do not need previous yacht experience to have something valuable to offer. Look for specific examples from hospitality, restaurants, maintenance, event planning or customer service. Prioritising tasks during a busy service or handing over a shift clearly to your team are real experiences you can draw on when explaining why you would suit a new role.",
        ],
      },
      {
        id: "basvuru-dosyasi",
        title: "Prepare a concise, complete application",
        paragraphs: [
          "Keep your CV, short introduction and current contact details consistent. Make your target role, current location, availability and languages easy to find. Describe the work you have done and the responsibilities you have held in short, specific sentences without overstating your experience. Help the reader understand who you are before explaining why you are applying for this particular role.",
          "Check each document the vacancy asks for and list only the training you actually hold. If you are unsure which documents are required, ask the employer to clarify. Before sending personal documents that have not been requested, confirm what to share and which application channel to use. Give your file a clear name and check that its links open on another device.",
        ],
      },
      {
        id: "ilan-secimi",
        title: "Connect your application to the role",
        paragraphs: [
          "Create a short checklist for assessing vacancies: duties, experience required, contract period, location and start date. Compare each point with your own circumstances. Once you have found suitable roles, tailor the first two sentences of your application message to each one. Clearly naming the position and explaining which part of your experience is relevant is more useful than a long, general introduction.",
          "Track your applications in a simple table. Record the vacancy link, application date, contact person and next step. This helps you avoid sending different messages for the same role and remember which team has contacted you when an interview comes through. While you wait, fill any gaps in your profile and review similar roles to keep your search organised.",
        ],
      },
      {
        id: "ilk-gorusme",
        title: "Prepare real examples for your interview",
        paragraphs: [
          "Practise a natural, one-minute introduction: what you have done so far, the role you are looking for and what you could contribute to the crew. Then choose three real examples. Describe a time you handled pressure, solved a problem with a team and learned a new task. If you are asked about something you have not done, say so clearly and explain how you approach learning.",
          "Your questions matter too. Ask about your responsibilities in the first week, who you would report to, how the crew works together and how your progress would be reviewed. Before the interview ends, clarify the next step and the likely timing. Write down the key points afterwards so you can compare opportunities thoughtfully.",
        ],
      },
      {
        id: "harekete-gec",
        title: "Make your next step specific",
        paragraphs: [
          "Replace an open-ended goal with a small, practical plan. Choose your target role today, then make sure the information in your CV and profile matches. Before applying, read the vacancy again and check whether there is an expectation your message has not addressed. Your first application does not have to be perfect, but it should represent you clearly and accurately.",
        ],
      },
    ],
    checklist: [
      "I have chosen my target role and availability date.",
      "My CV and profile are up to date.",
      "I have checked each requirement in the vacancy.",
      "I have prepared three real examples for my interview.",
    ],
    ctaTitle: "Start with your crew profile.",
    ctaDescription:
      "Bring your experience, skills and career ambitions together in one place.",
    ctaLabel: "Create your crew profile",
    ctaHref: "/login?mode=signup&role=crew",
  },
  {
    ...getGuideSummary("yacht-crew-cv"),
    takeaway:
      "Your CV does not need to tell your entire life story. It should make the experience and skills that matter for the role easy to find.",
    sections: [
      {
        id: "ilk-bakis",
        title: "Answer the essentials at a glance",
        paragraphs: [
          "Place your name, target position, contact details, current location and availability at the top of your CV. Use this space to answer the reader’s first questions instead of filling it with a lengthy personal introduction. Check that your email address is correct, your phone number includes a country code and your profile link works. These small details make it easier for someone to get in touch.",
          "Tailor your short profile paragraph to the role you are applying for. Focus on the experience you bring and where you want to develop, rather than a string of flattering adjectives. If you are moving from hospitality into interior work, connect your experience in service preparation, guest communication and teamwork. If you are new to yachting, be open about that and describe your strengths clearly.",
        ],
      },
      {
        id: "somut-deneyim",
        title: "Turn a list of duties into specific experience",
        paragraphs: [
          "List your experience with the most recent role first. For each position, include the dates, job title and the setting you worked in. Then use a few short points to explain what you actually did. Instead of simply writing “responsible for service”, describe how you prepared for service, tracked supplies and handled shift handovers. Any figures you include should be accurate and something you can explain.",
          "You can describe confidential work without naming a yacht or its guests. What matters is making your role and responsibilities clear. If you are just starting out, include relevant internships, projects and seasonal jobs, but do not present them as professional yacht experience. Keeping your CV consistent with what you say in an interview will also help you speak with confidence.",
        ],
      },
      {
        id: "beceriler",
        title: "Describe skills in terms of the work",
        paragraphs: [
          "Build your skills section around the duties in the vacancy. Group the tools you can use, your service or maintenance experience, language abilities and relevant training under clear headings. Rather than relying on vague claims such as “strong communicator”, show where you have used that skill in your experience section. Repeating the same information in several places adds length and makes the important points harder to find.",
          "Be realistic about how you use each language in everyday conversation, with guests or at work. Write the names of courses and certificates as they appear on your documents, and make it clear when a programme is still in progress. Shorten long lists that are not relevant to the position. The aim is to give the reader easy access to the information they need for an initial assessment.",
        ],
      },
      {
        id: "duzen-ve-kontrol",
        title: "Create a document that is easy to read",
        paragraphs: [
          "Use simple headings, consistent date formatting and a comfortable text size. Leave space between sections instead of squeezing your experience onto one page in tiny type. For early-career applications in particular, concise and focused content helps. After exporting your CV as a PDF, open it on both a computer and a phone. Check for text that overflows, gets cut off or contains broken links.",
          "Use your name and target role in the file name to keep different versions organised. Make sure a position title from an earlier application has not been left in the new document. Let your referees know before sharing their contact details. If possible, read the text aloud for your final check; this can help you spot long sentences, repeated words and inconsistent dates.",
        ],
      },
      {
        id: "profil-uyumu",
        title: "Keep your CV and profile in step",
        paragraphs: [
          "Whenever you update your CV, review your digital profile too. Position titles, dates, location and availability should match. After adding a new role or course, check the older information as well. Instead of rewriting the whole document for every application, maintain an accurate master version and highlight the experience most relevant to each role.",
        ],
      },
    ],
    checklist: [
      "My target role and contact details are easy to find.",
      "I have explained my experience through specific responsibilities.",
      "I have checked my PDF on a phone as well.",
      "The information in my CV and digital profile matches.",
    ],
    ctaTitle: "Make your profile as ready as your CV.",
    ctaDescription:
      "Keep your experience, skills and availability up to date for a consistent introduction.",
    ctaLabel: "Edit your profile",
    ctaHref: "/profile",
  },
  {
    ...getGuideSummary("first-week-onboard"),
    takeaway:
      "You do not have to know everything in your first week. Listening carefully, asking the right person and putting what you learn into practice will help you make a strong start.",
    sections: [
      {
        id: "gelmeden-once",
        title: "Clarify expectations before you arrive",
        paragraphs: [
          "Before joining the yacht, confirm the meeting place, arrival time and person you should contact. Ask what to bring, what to wear and what to expect from your personal space on board. Use the crew’s packing list as your starting point instead of guessing. If your travel or arrival plans change, let the relevant person know in good time. A calmer first day often starts with these small arrangements.",
          "Have a notebook or a notes app ready to use. You will hear many names, locations and instructions on your first day. Brief notes can make it easier to settle in than trying to remember everything at once. If there is any uncertainty between the role discussed before you joined and the responsibilities explained on board, ask about it early and clearly.",
        ],
      },
      {
        id: "ekip-duzeni",
        title: "Learn who to turn to",
        paragraphs: [
          "When meeting the crew, focus on learning people’s names and roles. Clarify who you report to, where to find the daily plan and how to let someone know a task is complete. If different people give you competing priorities, check the order with your supervisor instead of guessing. This makes work easier for you and the crew, especially during busy periods.",
          "Listen carefully to the yacht’s own procedures during your induction. Do not assume that a method you learned elsewhere will be the same here. If you encounter unfamiliar equipment or a task you have not done, ask someone who knows it to explain. Clarifying something in your notes before acting on it is better than developing the wrong habit.",
        ],
      },
      {
        id: "ortak-yasam",
        title: "Small habits matter in shared spaces",
        paragraphs: [
          "On board, work and shared living are closely connected. Keeping belongings in the right places, leaving spaces tidy and returning shared equipment all support the daily routine. Learn how the crew manages cabins, meals and laundry. Be mindful that something which seems like a small mess to you may affect someone else’s work or rest.",
          "Keep communication brief, respectful and clear. If you notice supplies running low or a task taking longer than expected, tell the relevant person. Learn the yacht’s rules for sharing information about guests and crew, and ask about the process for taking photographs or posting on social media. Trust in a shared living environment grows through small, consistent actions.",
        ],
      },
      {
        id: "is-takibi",
        title: "A clear handover matters as much as the task",
        paragraphs: [
          "When you receive a new task, make sure you understand the expected result, its priority and the timing. If helpful, briefly repeat the instructions in your own words. When you finish, mention any detail that still needs checking or any step that remains, rather than simply saying the job is done. This gives the next person the information they need without having to find it again.",
          "At the end of the day, take a moment to reflect: what did you learn, where do you still need help and what could you organise better tomorrow? Grouping your notes by task can gradually give you a useful personal reference. Always follow the crew’s current instructions, and check the accuracy of your own notes before passing them on as an official procedure.",
        ],
      },
      {
        id: "geri-bildirim",
        title: "Finish your first week with feedback",
        paragraphs: [
          "At a suitable moment, ask your supervisor for a brief review of your first week. As well as asking what you could do better, bring up a specific task you would like feedback on. Choose one or two suggestions to focus on during the following week. Settling into a crew takes time; measure progress by how clearly you understand your responsibilities and how consistently you carry them out.",
        ],
      },
    ],
    checklist: [
      "I have confirmed my arrival plan and contact person.",
      "I know where to find the daily plan and who to report to.",
      "I have noted the rules for shared spaces.",
      "I have asked for a short review of my first week.",
    ],
    ctaTitle: "Find the right crew for you.",
    ctaDescription:
      "Explore what different roles involve and discover opportunities that fit your next step.",
    ctaLabel: "Explore open positions",
    ctaHref: "/jobs",
  },
];

export function getGuides(language: GuideLanguage = "en"): Guide[] {
  return language === "tr" ? turkishGuides : englishGuides;
}

export function getGuide(slug: string, language: GuideLanguage = "en"): Guide | undefined {
  const canonicalSlug = legacyGuideSlugs[slug] ?? slug;
  return getGuides(language).find((guide) => guide.slug === canonicalSlug);
}

export const guides = getGuides();
