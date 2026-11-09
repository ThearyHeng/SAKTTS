export type Locale = "en" | "km";

export const DEFAULT_HERO_TEXT =
  "សូមស្វាគមន៍មកកាន់ SAKTTS។ សូមរីករាយជាមួយសំឡេង AI ដែលស្តាប់ទៅដូចធម្មជាតិ។ បច្ចេកវិទ្យារបស់យើងចាប់យកគ្រប់ភាពខុសប្លែកគ្នានៃការនិយាយរបស់មនុស្ស។";

export const TRANSLATIONS: Record<Locale, Record<string, string>> = {
  en: {
    brand: "SAKTTS",
    "nav.products": "Products",
    "nav.features": "Features",
    "nav.demo": "Demo",
    "nav.pricing": "Pricing",
    "nav.api": "API",
    "nav.mcp": "MCP",
    "nav.download": "Download",
    "nav.login": "Log In",
    "nav.tryFree": "Try for Free",
    "hero.title": "Transform Text into Speech and Speech into Text.",
    "hero.subtitle":
      "SAKTTS is an AI voice platform that speaks your words naturally and transcribes your recordings accurately, in Khmer, English, and more languages.",
    "hero.cta": "Get Started",
    "hero.watchDemo": "Watch Demo",
    "hero.tab.tts": "Text to Speech",
    "hero.tab.stt": "Speech to Text",
    "hero.generate": "Generate Speech",
    "hero.generating": "Generating…",
    "marquee.title": "Trusted by global content creators and enterprises",
    "features.title": "Everything you need to build great audio products.",
    "features.subtitle":
      "Comprehensive tools designed for creators, developers, and enterprises. Scale your audio production with our robust infrastructure.",
    "tts.badge": "Text to Speech",
    "tts.title": "Experience the power of next-gen synthesis.",
    "tts.subtitle":
      "Try our most popular voices below and hear the difference for yourself.",
    "tts.start": "Start generating",
    "tts.clone": "Clone a voice",
    "tts.explore": "Explore all voices",
    "stt.badge": "Speech to Text",
    "stt.title": "Turn any recording into accurate, editable text.",
    "stt.subtitle":
      "SAKTTS goes both ways. Upload a file or record in the browser, and get back a timestamped transcript you can edit, label by speaker, and export as subtitles.",
    "stt.try": "Try it live — no account needed.",
    "stt.start": "Start transcribing",
    "stt.explore": "Explore Speech to Text",
    "stt.note":
      "Included on every plan, free included — transcription uses the same credits as speech generation.",
    "ext.badge": "Chrome Extension",
    "ext.title": "Take SAKTTS with you, onto every page.",
    "ext.subtitle":
      "SAKTTS Voice & Translate is now on the Chrome Web Store. Highlight a sentence to translate it, catch spelling and grammar mistakes as you type, hear it in any of your voices, dictate into a text field, or transcribe a recording — all on the account you already have.",
    "ext.add": "Add to Chrome",
    "ext.about": "About the extension",
    "pricing.title": "Simple, transparent pricing",
    "pricing.subtitle":
      "Choose the perfect plan for your needs. Start for free, upgrade when you're ready.",
    "pricing.note":
      "One credit pool covers everything — speech generation, transcription and voice cloning.",
    "pricing.personal": "Personal",
    "pricing.teams": "Teams",
    "cta.title": "Ready to build the future of audio experiences?",
    "cta.primary": "Start Building Now",
    "cta.secondary": "Contact Sales",
  },
  km: {
    brand: "SAKTTS",
    "nav.products": "ផលិតផល",
    "nav.features": "មុខងារ",
    "nav.demo": "សាកល្បង",
    "nav.pricing": "តម្លៃ",
    "nav.api": "API",
    "nav.mcp": "MCP",
    "nav.download": "ទាញយក",
    "nav.login": "ចូលគណនី",
    "nav.tryFree": "សាកល្បងឥតគិតថ្លៃ",
    "hero.title": "បំលែងអត្ថបទទៅជាសំឡេង និងសំឡេងទៅជាអត្ថបទ។",
    "hero.subtitle":
      "SAKTTS គឺជាវេទិកាសំឡេង AI ដែលនិយាយពាក្យរបស់អ្នកដោយធម្មជាតិ និងបម្លែងសំឡេងថតទៅជាអត្ថបទយ៉ាងត្រឹមត្រូវ ជាភាសាខ្មែរ អង់គ្លេស និងភាសាជាច្រើនទៀត។",
    "hero.cta": "ចាប់ផ្តើម",
    "hero.watchDemo": "មើលវីដេអូណែនាំ",
    "hero.tab.tts": "អត្ថបទទៅជាសំឡេង",
    "hero.tab.stt": "សំឡេងទៅជាអត្ថបទ",
    "hero.generate": "បង្កើតសំឡេង",
    "hero.generating": "កំពុងបង្កើត…",
    "marquee.title": "ទទួលបានការទុកចិត្តពីអ្នកបង្កើតមាតិកា និងសហគ្រាសទូទាំងពិភពលោក",
    "features.title": "អ្វីគ្រប់យ៉ាងដែលអ្នកត្រូវការដើម្បីបង្កើតផលិតផលសំឡេងដ៏អស្ចារ្យ។",
    "features.subtitle":
      "ឧបករណ៍ពេញលេញដែលរចនាឡើងសម្រាប់អ្នកបង្កើតមាតិកា អ្នកអភិវឌ្ឍន៍ និងសហគ្រាស។",
    "tts.badge": "អត្ថបទទៅជាសំឡេង",
    "tts.title": "ទទួលយកបទពិសោធន៍សំឡេង AI ជំនាន់ថ្មី។",
    "tts.subtitle": "សាកល្បងសំឡេងពេញនិយមបំផុតរបស់យើងខាងក្រោម ហើយស្តាប់ភាពខុសប្លែកដោយខ្លួនឯង។",
    "tts.start": "ចាប់ផ្តើមបង្កើត",
    "tts.clone": "ក្លូនសំឡេង",
    "tts.explore": "មើលសំឡេងទាំងអស់",
    "stt.badge": "សំឡេងទៅជាអត្ថបទ",
    "stt.title": "បំលែងសំឡេងថតទៅជាអត្ថបទត្រឹមត្រូវ និងអាចកែសម្រួលបាន។",
    "stt.subtitle":
      "បង្ហោះឯកសារ ឬថតសំឡេងក្នុងកម្មវិធីរុករក ហើយទទួលបានអត្ថបទដែលមានកំណត់ពេលវេលា បែងចែកអ្នកនិយាយ និងនាំចេញជាអក្សររត់។",
    "stt.try": "សាកល្បងផ្ទាល់ — មិនចាំបាច់មានគណនី។",
    "stt.start": "ចាប់ផ្តើមបំលែង",
    "stt.explore": "ស្វែងយល់ពី Speech to Text",
    "stt.note": "រួមបញ្ចូលលើគ្រប់គម្រោងទាំងអស់ — ប្រើក្រេឌីតដូចគ្នានឹងការបង្កើតសំឡេង។",
    "ext.badge": "ផ្នែកបន្ថែម Chrome",
    "ext.title": "យក SAKTTS ទៅជាមួយអ្នកលើគ្រប់ទំព័រ។",
    "ext.subtitle":
      "SAKTTS Voice & Translate មាននៅលើ Chrome Web Store ហើយ។ គូសបញ្ជាក់ប្រយោគដើម្បីបកប្រែ ពិនិត្យអក្ខរាវិរុទ្ធ ស្តាប់សំឡេង ឬថតបំលែងជាអត្ថបទ។",
    "ext.add": "បន្ថែមទៅ Chrome",
    "ext.about": "អំពីផ្នែកបន្ថែម",
    "pricing.title": "តម្លៃសាមញ្ញ និងតម្លាភាព",
    "pricing.subtitle": "ជ្រើសរើសគម្រោងដែលស័ក្តិសមបំផុតសម្រាប់អ្នក។ ចាប់ផ្តើមដោយឥតគិតថ្លៃ។",
    "pricing.note": "ក្រេឌីតមួយគ្របដណ្តប់អ្វីៗទាំងអស់ — ការបង្កើតសំឡេង ការបំលែង និងការក្លូនសំឡេង។",
    "pricing.personal": "ផ្ទាល់ខ្លួន",
    "pricing.teams": "ក្រុមការងារ",
    "cta.title": "ត្រៀមខ្លួនបង្កើតបទពិសោធន៍សំឡេងនាពេលអនាគតហើយឬនៅ?",
    "cta.primary": "ចាប់ផ្តើមបង្កើតឥឡូវនេះ",
    "cta.secondary": "ទាក់ទងផ្នែកលក់",
  },
};

export function t(locale: Locale, key: string): string {
  return TRANSLATIONS[locale]?.[key] ?? TRANSLATIONS.en[key] ?? key;
}
