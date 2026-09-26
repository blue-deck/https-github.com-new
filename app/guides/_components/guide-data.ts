import "server-only";
import { getGuideSummary, type GuideSummary } from "./guide-index";

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

export const guides: Guide[] = [
  {
    ...getGuideSummary("ilk-yat-isine-hazirlik"),
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
    ...getGuideSummary("crew-cv-hazirlama"),
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
    ...getGuideSummary("teknede-ilk-hafta"),
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
