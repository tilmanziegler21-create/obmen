import { useI18n, type Language } from '../i18n';

const AVAILABLE_LANGUAGES: Language[] = ['ru', 'en', 'uk', 'de'];
const LANGUAGE_LABELS: Record<Language, string> = {
  ru: 'RU',
  en: 'EN',
  uk: 'UA',
  de: 'DE',
};

export default function LanguageSwitcher() {
  const { language, setLanguage } = useI18n();

  return (
    <div className="flex max-w-full items-center gap-[2px] rounded-[12px] border border-border bg-bg2/80 p-[3px] backdrop-blur-sm">
      {AVAILABLE_LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLanguage(code)}
          aria-label={code.toUpperCase()}
          className={`min-w-[34px] rounded-[8px] px-[6px] py-[6px] text-[12px] font-[700] leading-none transition-colors ${
            language === code
              ? 'bg-[#00CC66] text-[#000000]'
              : 'text-muted hover:text-text'
          }`}
        >
          {LANGUAGE_LABELS[code]}
        </button>
      ))}
    </div>
  );
}
