import { useI18n, type Language } from '../i18n';

const AVAILABLE_LANGUAGES: Language[] = ['ru', 'en', 'uk', 'de'];

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className="flex max-w-full items-center gap-[2px] rounded-[12px] border border-border bg-bg2/80 p-[3px] backdrop-blur-sm">
      {AVAILABLE_LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLanguage(code)}
          className={`min-w-[30px] rounded-[8px] px-[6px] py-[6px] text-[10px] font-[700] tracking-[0.04em] transition-colors ${
            language === code
              ? 'bg-green text-[#0A0B0F]'
              : 'text-muted hover:text-text'
          }`}
        >
          {t(`languages.${code}`)}
        </button>
      ))}
    </div>
  );
}
