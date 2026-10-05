import { createContext, useCallback, useContext, useEffect, useState } from "react";
import en from "@/i18n/en";
import bn from "@/i18n/bn";
import { en as enMore, bn as bnMore } from "@/i18n/more";

const DICTS = { en: { ...en, ...enMore }, bn: { ...bn, ...bnMore } };
const Ctx = createContext(null);

const initial = () => {
  try { const v = localStorage.getItem("urbanex_lang"); if (v === "bn" || v === "en") return v; } catch { /* ignore */ }
  return "en";
};

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initial);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = useCallback((l) => {
    setLangState(l);
    try { localStorage.setItem("urbanex_lang", l); } catch { /* ignore */ }
  }, []);
  // Missing Bengali keys fall back to English, then to the key itself.
  const t = useCallback((key, vars) => {
    let s = DICTS[lang][key] ?? DICTS.en[key] ?? key;
    if (vars) Object.entries(vars).forEach(([k, v]) => { s = s.replace(`{${k}}`, v); });
    return s;
  }, [lang]);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}
export const useI18n = () => useContext(Ctx);
