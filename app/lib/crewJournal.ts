export type JournalText = { en: string; tr: string };

export type CrewJournalArticle = {
  slug: string;
  image: string;
  imagePosition?: string;
  readingMinutes: number;
  category: JournalText;
  title: JournalText;
  summary: JournalText;
  sections: {
    heading: JournalText;
    paragraphs: { en: string[]; tr: string[] };
  }[];
};

export type CrewJournalPreview = Omit<CrewJournalArticle, "sections">;

export const crewJournalArticles: CrewJournalArticle[] = [
  {
    slug: "first-yacht-role",
    image: "/media/journal-first-role.webp",
    imagePosition: "center 54%",
    readingMinutes: 3,
    category: { en: "Career notes", tr: "Kariyer rehberi" },
    title: {
      en: "Your first yacht role starts with a clear plan.",
      tr: "İlk yat işiniz için yol haritanız.",
    },
    summary: {
      en: "Choose a direction, make your experience count and approach your next application with purpose.",
      tr: "Hedefinizi belirleyin, deneyiminizi doğru anlatın ve bir sonraki başvurunuzu bilinçli hazırlayın.",
    },
    sections: [
      {
        heading: { en: "Start with the work you want to do", tr: "Önce yapmak istediğiniz işi belirleyin" },
        paragraphs: {
          en: [
            "Before sending applications, choose the department and type of role you want to explore. Deck, interior, galley and engineering work call for different strengths. Read several job descriptions in the same area and write down the responsibilities that appear repeatedly. This gives you a practical picture of the work beyond the job title.",
            "Compare those responsibilities with what you can already do. Hospitality, maintenance, cooking, customer service and teamwork may provide useful examples, even when your experience comes from ashore. Be specific about what transfers, and be equally clear about what you still need to learn.",
          ],
          tr: [
            "Başvurulara başlamadan önce hangi departmanda ve nasıl bir rolde çalışmak istediğinizi belirleyin. Güverte, iç hizmetler, mutfak ve makine işleri farklı yetkinlikler gerektirir. Aynı alandaki birkaç ilanı okuyup tekrarlanan sorumlulukları not alın. Böylece unvanın ötesinde, günlük işin ne içerdiğini daha iyi anlarsınız.",
            "Bu sorumlulukları mevcut becerilerinizle karşılaştırın. Konaklama, bakım, aşçılık, müşteri hizmetleri ve ekip çalışması deneyimleriniz karada edinilmiş olsa da somut örnekler sunabilir. Hangi becerilerinizi yeni role taşıyabileceğinizi ve hangi alanlarda öğrenmeye ihtiyaç duyduğunuzu açıkça anlatın.",
          ],
        },
      },
      {
        heading: { en: "Make your experience easy to understand", tr: "Deneyiminizi anlaşılır hale getirin" },
        paragraphs: {
          en: [
            "A useful profile helps someone understand your experience quickly. Include accurate role titles, dates, responsibilities and languages. Instead of describing yourself only as hardworking, explain a task you owned, the setting you worked in and how you contributed to the team.",
            "Keep your BlueDeck profile and availability current before applying. Your professional background can be presented while names, contact details and private documents remain protected in public crew browsing. Put professional context in your summary; keep sensitive details out of public-facing text.",
          ],
          tr: [
            "İyi bir profil, deneyiminizin hızlıca anlaşılmasını sağlar. Unvanlarınızı, çalışma tarihlerinizi, sorumluluklarınızı ve bildiğiniz dilleri doğru girin. Yalnızca çalışkan olduğunuzu söylemek yerine, üstlendiğiniz bir işi, çalışma ortamınızı ve ekibe katkınızı anlatın.",
            "Başvuru yapmadan önce BlueDeck profilinizi ve müsaitlik bilginizi güncelleyin. Herkese açık mürettebat aramasında mesleki geçmiş sunulurken isimler, iletişim bilgileri ve özel belgeler korunur. Profil özetinizde mesleki bilgilere yer verin; hassas bilgilerinizi herkese açık metinlere eklemeyin.",
          ],
        },
      },
      {
        heading: { en: "Read the details before you apply", tr: "Başvurmadan önce ayrıntıları okuyun" },
        paragraphs: {
          en: [
            "Use the Jobs page to explore available roles, then read the full listing. Compare the stated experience, location, start date and working arrangement with your situation. A role that fits your availability and present skills is easier to discuss clearly than one chosen only for its destination.",
            "Prepare a few questions for a conversation with the hiring team. Ask what a typical day includes, who you would report to and how the team introduces new crew to the yacht. If an important detail is missing from the listing, ask about it rather than filling in the gap yourself.",
          ],
          tr: [
            "İş İlanları sayfasında açık pozisyonları inceleyin ve ilanın tamamını okuyun. Belirtilen deneyimi, konumu, başlangıç tarihini ve çalışma şeklini kendi durumunuzla karşılaştırın. Yalnızca gidilecek yere göre seçilmiş bir iş yerine, mevcut becerilerinize ve müsaitliğinize uyan bir rol hakkında daha net konuşabilirsiniz.",
            "İşverenle görüşme için birkaç soru hazırlayın. Günlük iş akışının nasıl olduğunu, kime bağlı çalışacağınızı ve yeni mürettebatın yata nasıl alıştığını sorun. İlanda sizin için önemli bir ayrıntı eksikse kendi varsayımınızı yapmak yerine açıklama isteyin.",
          ],
        },
      },
      {
        heading: { en: "Keep your next step in view", tr: "Sonraki adımınızı takip edin" },
        paragraphs: {
          en: [
            "After applying, use your BlueDeck applications portal to review your applications and their current status. Keep a brief personal note of any conversations and agreed next steps so you can respond with context when the hiring team gets in touch.",
            "Treat each application as a chance to improve your preparation. You may discover that a different role fits better, that one part of your experience needs a clearer explanation or that your availability has changed. Update the relevant details before your next application.",
          ],
          tr: [
            "Başvurudan sonra BlueDeck başvuru portalından başvurularınızı ve güncel durumlarını inceleyin. Görüşmelerinizi ve üzerinde anlaşılan sonraki adımları kendiniz için kısaca not edin. Böylece işveren size ulaştığında önceki konuşmanın ayrıntılarını hatırlayarak yanıt verebilirsiniz.",
            "Her başvuruyu hazırlığınızı geliştirme fırsatı olarak değerlendirin. Farklı bir rolün size daha uygun olduğunu, deneyiminizin bir bölümünü daha net anlatmanız gerektiğini veya müsaitliğinizin değiştiğini fark edebilirsiniz. Sonraki başvurunuzdan önce ilgili bilgileri güncelleyin.",
          ],
        },
      },
    ],
  },
  {
    slug: "crew-profile-guide",
    image: "/media/journal-profile.webp",
    readingMinutes: 3,
    category: { en: "Your profile", tr: "Profiliniz" },
    title: {
      en: "A crew profile that tells your story clearly.",
      tr: "Sizi doğru anlatan bir mürettebat profili.",
    },
    summary: {
      en: "Practical ways to present your experience, availability and strengths without adding unnecessary detail.",
      tr: "Deneyiminizi, müsaitliğinizi ve güçlü yönlerinizi gereksiz ayrıntılara girmeden sunmanın yolları.",
    },
    sections: [
      {
        heading: { en: "Give your profile a clear direction", tr: "Profilinizin odağını belirleyin" },
        paragraphs: {
          en: [
            "Your profile should make three things easy to understand: the work you do, the experience you bring and the opportunity you are looking for. Start with a short professional summary. Two or three focused sentences are more useful than a long introduction that repeats your entire work history.",
            "Use the role you actually hold or are prepared to pursue. If you are changing departments or joining yachting from another industry, explain that transition directly. A clear starting point helps a hiring team judge fit without having to interpret vague titles or a list of unrelated interests.",
          ],
          tr: [
            "Profiliniz üç konuyu kolayca anlatmalı: ne iş yaptığınız, hangi deneyimi sunduğunuz ve nasıl bir fırsat aradığınız. Kısa bir mesleki özetle başlayın. İki ya da üç odaklı cümle, bütün iş geçmişinizi tekrarlayan uzun bir girişten daha yararlıdır.",
            "Gerçekte üstlendiğiniz veya başvurmaya hazır olduğunuz rolü belirtin. Departman değiştiriyor ya da başka bir sektörden yatçılığa geçiyorsanız bunu doğrudan anlatın. Net bir başlangıç, işverenin belirsiz unvanları veya ilgisiz ilgi alanlarını yorumlamak zorunda kalmadan uygunluğu değerlendirmesine yardımcı olur.",
          ],
        },
      },
      {
        heading: { en: "Describe responsibilities with examples", tr: "Sorumluluklarınızı örneklerle anlatın" },
        paragraphs: {
          en: [
            "For each position, check the title, dates and working context. Explain the responsibilities you handled regularly. Preparing a guest cabin, maintaining deck equipment, coordinating provisions or supporting a handover says more than a broad phrase such as excellent team player.",
            "Keep the level of detail consistent across your work history. If you include an outcome, make sure you can explain it in a conversation. Avoid inflating your responsibility or implying that you led work you only assisted with. Accurate detail gives an interviewer something useful to ask about.",
          ],
          tr: [
            "Her görev için unvanı, tarihleri ve çalışma ortamını kontrol edin. Düzenli olarak üstlendiğiniz sorumlulukları açıklayın. Misafir kamarası hazırlamak, güverte ekipmanının bakımını yapmak, kumanya hazırlığına destek vermek veya devir teslimde görev almak; iyi bir takım oyuncusu gibi genel ifadelerden daha fazla şey anlatır.",
            "İş geçmişiniz boyunca benzer düzeyde ayrıntı kullanın. Bir sonuçtan söz ediyorsanız bunu görüşmede açıklayabileceğinizden emin olun. Sorumluluğunuzu büyütmeyin veya yalnızca destek verdiğiniz bir işi yönetmiş gibi sunmayın. Doğru ayrıntılar, görüşmede üzerine konuşulabilecek somut konular oluşturur.",
          ],
        },
      },
      {
        heading: { en: "Keep availability and skills up to date", tr: "Müsaitliğinizi ve becerilerinizi güncel tutun" },
        paragraphs: {
          en: [
            "Review your availability whenever your plans change. Check your current location, the dates you can start and the roles you are considering wherever those fields appear in your profile. A recent profile is easier to act on than one that leaves a hiring team wondering whether you are still looking.",
            "Describe languages and practical skills honestly. Review the information you have entered about training and qualifications, and correct anything that has changed. Your profile is a professional introduction; each individual opportunity may require a separate discussion about suitability and supporting information.",
          ],
          tr: [
            "Planlarınız değiştiğinde müsaitlik bilginizi gözden geçirin. Profilinizde ilgili alanlar varsa mevcut konumunuzu, işe başlayabileceğiniz tarihleri ve değerlendirdiğiniz rolleri kontrol edin. Güncel bir profil, iş arayışınızın sürüp sürmediğini belirsiz bırakan bir profilden daha işlevseldir.",
            "Dil seviyelerinizi ve uygulamalı becerilerinizi dürüstçe anlatın. Eğitim ve yeterlilikleriniz hakkında girdiğiniz bilgileri inceleyip değişen ayrıntıları düzeltin. Profiliniz mesleki bir tanıtımdır; her fırsatta uygunluğunuz ve destekleyici bilgiler için ayrıca görüşme yapılması gerekebilir.",
          ],
        },
      },
      {
        heading: { en: "Be useful without oversharing", tr: "Gereğinden fazla kişisel bilgi paylaşmayın" },
        paragraphs: {
          en: [
            "BlueDeck separates public professional browsing from protected names, contact details and private documents. Support that separation by keeping phone numbers, personal email addresses and document identifiers out of your public-facing summary. Describe your work rather than including information about guests or private yacht arrangements.",
            "Before your next application, read your profile from beginning to end. Remove repeated phrases, check the order of your experience and correct spelling. Ask whether someone reading it for the first time could understand your next professional step. That final edit often adds more clarity than another paragraph.",
          ],
          tr: [
            "BlueDeck, herkese açık mesleki profil incelemesini korunan isimlerden, iletişim bilgilerinden ve özel belgelerden ayırır. Telefon numaranızı, kişisel e-posta adresinizi ve belge numaralarınızı herkese açık profil özetine yazmayarak bu ayrımı destekleyin. Misafir bilgileri veya yatın özel düzenlemeleri yerine yaptığınız işi anlatın.",
            "Bir sonraki başvurunuzdan önce profilinizi baştan sona okuyun. Tekrarlanan ifadeleri çıkarın, deneyimlerinizin sırasını kontrol edin ve yazım hatalarını düzeltin. İlk kez okuyan birinin kariyerinizde atmak istediğiniz adımı anlayıp anlayamayacağını düşünün. Bu son düzenleme, çoğu zaman bir paragraf daha eklemekten daha fazla açıklık sağlar.",
          ],
        },
      },
    ],
  },
  {
    slug: "life-on-board",
    image: "/media/journal-onboard.webp",
    readingMinutes: 3,
    category: { en: "Life on board", tr: "Yatta yaşam" },
    title: {
      en: "Small habits that make life on board better.",
      tr: "Yatta yaşamı kolaylaştıran küçük alışkanlıklar.",
    },
    summary: {
      en: "Clear handovers, shared spaces and thoughtful communication: the everyday foundations of good teamwork.",
      tr: "Net devir teslim, ortak alanlara özen ve düşünceli iletişim: iyi ekip çalışmasının günlük temelleri.",
    },
    sections: [
      {
        heading: { en: "Learn how your team works", tr: "Ekibinizin çalışma düzenini öğrenin" },
        paragraphs: {
          en: [
            "Every yacht has its own routines. When you join a team, ask who sets priorities, how tasks are handed over and where current instructions are kept. Take time to learn the agreed process instead of assuming it matches your previous workplace.",
            "Keep a small set of notes about everyday arrangements: shared equipment, storage, reporting lines and the names of the people you should ask for help. Follow the yacht’s own onboarding and operating instructions. If a task is unfamiliar or an instruction is unclear, ask the responsible person before starting.",
          ],
          tr: [
            "Her yatın kendine ait bir işleyişi vardır. Ekibe katıldığınızda öncelikleri kimin belirlediğini, görevlerin nasıl devredildiğini ve güncel talimatların nerede bulunduğunu öğrenin. Önceki iş yerinizle aynı olduğunu varsaymak yerine ekibin kullandığı yöntemi anlamaya zaman ayırın.",
            "Ortak ekipman, depolama alanları, görev dağılımı ve yardım isteyeceğiniz kişiler gibi günlük konularda kısa notlar tutun. Yatın kendi işe uyum ve çalışma talimatlarını izleyin. Bir görev size yabancıysa veya talimat net değilse başlamadan önce sorumlu kişiye danışın.",
          ],
        },
      },
      {
        heading: { en: "Make handovers easy to pick up", tr: "Devir teslimi anlaşılır yapın" },
        paragraphs: {
          en: [
            "A useful handover tells the next person what is complete, what remains and what needs attention. Keep it short and specific. Include the location of the work or equipment and any agreed next step, using the communication method your team has chosen.",
            "Avoid leaving someone to infer progress from a half-finished task. If a plan changes, tell the person affected and update the relevant record where your team uses one. Before finishing a handover, give the next person a chance to ask questions so both of you leave with the same understanding.",
          ],
          tr: [
            "İyi bir devir teslim, sonraki kişiye neyin tamamlandığını, neyin kaldığını ve hangi konunun dikkat gerektirdiğini anlatır. Kısa ve somut olun. Ekibin belirlediği iletişim yöntemini kullanarak işin veya ekipmanın konumunu ve üzerinde anlaşılan sonraki adımı belirtin.",
            "Bir işi yarım bıraktığınızda, diğer kişinin ne kadar ilerlediğinizi tahmin etmesini beklemeyin. Plan değişirse bundan etkilenen kişiye haber verin ve ekibiniz kayıt tutuyorsa ilgili bilgiyi güncelleyin. Devir teslimi bitirmeden önce karşı tarafın soru sormasına fırsat verin; böylece ikiniz de aynı bilgiyle devam edersiniz.",
          ],
        },
      },
      {
        heading: { en: "Treat shared space with care", tr: "Ortak alanlara özen gösterin" },
        paragraphs: {
          en: [
            "Working and living in the same place makes small habits visible. Return shared items, leave common areas ready for the next person and agree expectations around cabin space and quiet time with your team. Consider that a colleague may be resting while you are between tasks.",
            "Respect personal space and ask before borrowing belongings or taking photographs that include colleagues. Be thoughtful about what you share outside the yacht, especially images or stories involving guests, private areas or another crew member. When unsure, ask the appropriate person instead of assuming permission.",
          ],
          tr: [
            "Aynı yerde çalışıp yaşamak küçük alışkanlıkları görünür kılar. Ortak eşyaları yerine koyun, ortak alanları sonraki kişinin kullanımına hazır bırakın ve kamara düzeniyle sessiz saatler konusundaki beklentileri ekibinizle netleştirin. Siz iki görev arasındayken bir çalışma arkadaşınızın dinleniyor olabileceğini hatırlayın.",
            "Kişisel alana saygı gösterin; eşya ödünç almadan veya çalışma arkadaşlarınızın bulunduğu fotoğraflar çekmeden önce izin isteyin. Özellikle misafirleri, özel alanları veya başka bir mürettebat üyesini içeren görüntü ve hikâyeleri yat dışında paylaşırken özenli olun. Emin değilseniz izin verildiğini varsaymak yerine ilgili kişiye sorun.",
          ],
        },
      },
      {
        heading: { en: "Communicate early and keep learning", tr: "Zamanında iletişim kurun, öğrenmeye devam edin" },
        paragraphs: {
          en: [
            "Raise a practical issue while there is still time to address it. Explain what you have noticed, how it affects the task and what you need clarified. Calm, direct communication gives colleagues something they can act on and avoids a small misunderstanding becoming a larger one.",
            "After a busy period, ask for specific feedback on one part of your work. Make a note of what helped and what you want to practise next. These small adjustments build a more dependable working rhythm and give you concrete experience to describe when you update your professional profile.",
          ],
          tr: [
            "Bir konuyu çözmek için hâlâ zaman varken gündeme getirin. Ne fark ettiğinizi, bunun görevi nasıl etkilediğini ve hangi noktanın açıklığa kavuşmasına ihtiyaç duyduğunuzu anlatın. Sakin ve doğrudan iletişim, çalışma arkadaşlarınıza harekete geçebilecekleri bilgi verir ve küçük bir yanlış anlaşılmanın büyümesini önler.",
            "Yoğun bir dönemin ardından işinizin belirli bir yönü hakkında geri bildirim isteyin. Neyin işe yaradığını ve sonraki sefer neyi geliştirmek istediğinizi not edin. Bu küçük düzenlemeler daha güvenilir bir çalışma ritmi kurar ve mesleki profilinizi güncellerken anlatabileceğiniz somut deneyimler sağlar.",
          ],
        },
      },
    ],
  },
];

export function getCrewJournalArticle(slug: string) {
  return crewJournalArticles.find((article) => article.slug === slug);
}

export const crewJournalPreviews: CrewJournalPreview[] = crewJournalArticles.map(
  ({ slug, image, imagePosition, readingMinutes, category, title, summary }) => ({
    slug,
    image,
    imagePosition,
    readingMinutes,
    category,
    title,
    summary,
  }),
);
