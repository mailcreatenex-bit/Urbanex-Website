import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { UTILITIES } from "@/pages/utilities/UtilityShell";
import { useI18n } from "@/context/I18nContext";

// "Utilities" menu: a dropdown on desktop, an expandable list inside the mobile menu.
export default function UtilitiesMenu({ mobile = false, onNavigate }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const { pathname } = useLocation();
  const active = pathname.startsWith("/utilities");
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (mobile) {
    return (
      <div>
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} data-testid="nav-utilities-mobile" className={`flex items-center gap-1 text-base py-2 ${active ? "text-urbanex-gold" : "text-urbanex-navy/80"}`}>
          {t("nav.utilities")} <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}/>
        </button>
        {open && <div className="ml-3 pl-3 border-l border-urbanex-gold/40 flex flex-col">{UTILITIES.map(u => (
          <Link key={u.to} to={u.to} onClick={onNavigate} className="py-2 text-sm text-urbanex-navy/75 flex items-center gap-2"><u.icon className="w-4 h-4 text-urbanex-gold"/>{t(u.key)}</Link>
        ))}</div>}
      </div>
    );
  }
  return (
    <div className="relative" ref={box} onMouseEnter={() => window.matchMedia("(hover: hover)").matches && setOpen(true)} onMouseLeave={() => window.matchMedia("(hover: hover)").matches && setOpen(false)}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} data-testid="nav-utilities"
        className={`inline-flex items-center gap-1 text-sm tracking-wide transition-colors ${active ? "text-urbanex-navy" : "text-urbanex-navy/60 hover:text-urbanex-navy"}`}>
        {t("nav.utilities")} <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}/>
      </button>
      {open && (
        <div role="menu" className="absolute left-1/2 -translate-x-1/2 top-full pt-3 z-50">
          <div className="w-64 rounded-2xl bg-white border border-urbanex-navy/10 shadow-xl p-2">
            {UTILITIES.map(u => (
              <Link key={u.to} to={u.to} role="menuitem" data-testid={`util-${u.to.split("/").pop()}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-urbanex-navy hover:bg-urbanex-cream">
                <u.icon className="w-4 h-4 text-urbanex-gold"/>{t(u.key)}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
