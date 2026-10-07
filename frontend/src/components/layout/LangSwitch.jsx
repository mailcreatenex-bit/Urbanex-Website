import { useI18n, LANGS } from "@/context/I18nContext";

// English, Bengali, Hindi: three small buttons, the current one filled.
export default function LangSwitch({ tone = "light" }) {
  const { lang, setLang } = useI18n();
  const dark = tone === "dark";
  return (
    <div role="group" aria-label="Language" data-testid="lang-toggle" className={`inline-flex rounded-full border overflow-hidden text-[11px] ${dark ? "border-white/25" : "border-urbanex-navy/20"}`}>
      {LANGS.map(([k, short, full]) => (
        <button key={k} type="button" onClick={() => setLang(k)} aria-pressed={lang === k} aria-label={full} title={full} data-testid={`lang-${k}`}
          className={`px-2.5 py-1.5 transition-colors ${lang === k ? "bg-urbanex-gold text-urbanex-navy font-medium" : dark ? "text-urbanex-ivory/75 hover:text-urbanex-ivory" : "text-urbanex-navy/70 hover:text-urbanex-navy"}`}>{short}</button>
      ))}
    </div>
  );
}
