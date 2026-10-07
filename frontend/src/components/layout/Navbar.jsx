import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, LogOut, LayoutDashboard, Heart } from "lucide-react";
import NotificationBell from "@/components/common/NotificationBell";
import { useFavorites } from "@/context/FavoritesContext";
import { useI18n } from "@/context/I18nContext";
import { useAuth } from "@/context/AuthContext";
import UtilitiesMenu from "@/components/layout/UtilitiesMenu";
import { NAV } from "@/constants/testIds";

const LINKS = [
  { to: "/", key: "nav.home", tid: NAV.home },
  { to: "/properties", key: "nav.properties", tid: NAV.properties },
  { to: "/map", key: "nav.map", tid: "nav-map" },
  { to: "/vastu", key: "nav.vastu", tid: "nav-vastu" },
  { to: "/construction", key: "nav.construction", tid: NAV.construction },
  { to: "/blog", key: "nav.blog", tid: "nav-blog" },
  { to: "/about", key: "nav.about", tid: NAV.about },
  { to: "/contact", key: "nav.contact", tid: NAV.contact },
];

// A floating glass dock: it slides away while you read downward and returns the moment you scroll up.
export default function Navbar() {
  const { user, logout, setLoginOpen } = useAuth();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);
  const [hover, setHover] = useState(null);
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { t, lang, setLang } = useI18n();
  const { ids } = useFavorites();

  useEffect(() => {
    let raf = 0, last = window.scrollY;
    const on = () => { if (raf) return; raf = requestAnimationFrame(() => {
      raf = 0; const y = window.scrollY;
      setSolid(y > 40);
      if (Math.abs(y - last) > 8) { setHidden(y > 220 && y > last); last = y; }
    }); };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); if (raf) cancelAnimationFrame(raf); };
  }, []);
  useEffect(() => { setOpen(false); setHidden(false); }, [pathname]);
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);

  const links = LINKS.map(l => ({ ...l, label: t(l.key) }));
  const active = links.find(l => (l.to === "/" ? pathname === "/" : pathname.startsWith(l.to)))?.to;
  const lit = hover ?? active;
  const toggleLang = () => setLang(lang === "en" ? "bn" : "en");

  return (
    <>
      <header className={`fixed top-0 inset-x-0 z-40 pointer-events-none transition-transform duration-500 ease-out ${hidden && !open ? "-translate-y-[120%]" : ""}`}>
        <div className="max-w-[88rem] mx-auto px-3 md:px-6 pt-3">
          <div className={`dock pointer-events-auto rounded-full flex items-center justify-between gap-3 pl-2 pr-2 md:pr-3 transition-all duration-500 ${solid ? "h-14" : "h-[60px] md:h-[68px]"}`}>
            <Link to="/" data-testid={NAV.brand} className="flex items-center gap-3 group shrink-0" aria-label="Urbanex Realty, home">
              <span className="grid place-items-center h-16 w-16 md:h-[88px] md:w-[88px] -my-2 md:-my-3 rounded-full bg-white shadow-[0_0_0_3px_rgba(197,160,89,.45),0_10px_30px_-8px_rgba(0,0,0,.6)] overflow-hidden transition-transform group-hover:scale-105">
                <img src="/brand/urbanex-logo.png" alt="" className="h-[108%] w-[108%] max-w-none object-contain"/>
              </span>
              <span className="hidden lg:block leading-tight">
                <span className="block font-display text-lg text-urbanex-ivory">Urbanex <em className="text-urbanex-gold not-italic">Realty</em></span>
                <span className="block text-[9px] tracking-[0.3em] uppercase text-urbanex-ivory/50">Burdwan · since 2022</span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-0.5 lg:gap-1" onMouseLeave={() => setHover(null)} aria-label="Main">
              {links.map(l => (
                <NavLink key={l.to} to={l.to} data-testid={l.tid} end onMouseEnter={() => setHover(l.to)} onFocus={() => setHover(l.to)}
                  className={`relative px-3 lg:px-3.5 py-2 text-[13px] tracking-wide transition-colors ${lit === l.to ? "text-urbanex-navy" : "text-urbanex-ivory/75"}`}>
                  {lit === l.to && <motion.span layoutId="dock-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-full bg-urbanex-gold" aria-hidden="true"/>}
                  <span className="relative">{l.label}</span>
                </NavLink>
              ))}
              <UtilitiesMenu tone="dark"/>
            </nav>

            <div className="flex items-center gap-1.5 md:gap-2">
              <button type="button" onClick={toggleLang} data-testid="lang-toggle" className="hidden md:inline-flex text-[11px] border border-white/20 hover:border-urbanex-gold rounded-full px-3 py-1.5 text-urbanex-ivory/80">{t("lang.toggle")}</button>
              <Link to="/shortlist" aria-label={t("nav.shortlist")} data-testid="nav-shortlist" className="relative p-2 text-urbanex-ivory hover:text-urbanex-gold">
                <Heart className="w-5 h-5"/>
                {ids.length > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-urbanex-gold text-urbanex-navy text-[10px] flex items-center justify-center">{ids.length}</span>}
              </Link>
              {user && !user.is_admin && <span className="hidden md:inline"><NotificationBell mode="user" dark/></span>}
              {user ? (
                <>
                  {user.is_admin && (
                    <button type="button" data-testid={NAV.admin} onClick={() => nav("/admin/leads")} className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-urbanex-gold/70 text-urbanex-gold hover:bg-urbanex-gold hover:text-urbanex-navy px-3.5 py-1.5 text-xs transition-colors"><LayoutDashboard className="w-3.5 h-3.5"/> {t("nav.crm")}</button>
                  )}
                  <span data-testid={NAV.user} className="hidden xl:inline text-xs text-urbanex-ivory/70 max-w-[110px] truncate">{user.name}</span>
                  <button type="button" data-testid={NAV.logout} onClick={logout} aria-label="Sign out" className="hidden md:inline-flex p-2 text-urbanex-ivory/70 hover:text-urbanex-gold"><LogOut className="w-4 h-4"/></button>
                </>
              ) : (
                <button type="button" data-testid={NAV.login} onClick={() => setLoginOpen(true)} className="hidden md:inline-flex btn-shine rounded-full bg-urbanex-ivory text-urbanex-navy hover:bg-urbanex-gold px-5 py-2 text-xs font-medium transition-colors">{t("nav.signin")}</button>
              )}
              <button type="button" className="md:hidden grid place-items-center h-10 w-10 rounded-full bg-white/10 text-urbanex-ivory" data-testid={NAV.mobileToggle} onClick={() => setOpen(o => !o)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
                {open ? <X className="w-5 h-5"/> : <Menu className="w-5 h-5"/>}
              </button>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div key="menu" initial={{ clipPath: "circle(0% at 92% 4%)" }} animate={{ clipPath: "circle(150% at 92% 4%)" }} exit={{ clipPath: "circle(0% at 92% 4%)" }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            className="md:hidden fixed inset-0 z-[45] sec-dark overflow-y-auto">
            <div className="aurora"/>
            <div className="relative px-7 pt-28 pb-10 min-h-full flex flex-col">
              <nav className="flex flex-col" aria-label="Menu">
                {links.map((l, i) => (
                  <motion.div key={l.to} initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + i * 0.05, duration: 0.5 }}>
                    <NavLink to={l.to} end data-testid={l.tid + "-mobile"} onClick={() => setOpen(false)}
                      className={({ isActive }) => `flex items-baseline gap-4 py-2.5 font-display text-[2.6rem] leading-none ${isActive ? "text-urbanex-gold" : "text-urbanex-ivory"}`}>
                      <span className="font-mono text-[11px] text-urbanex-gold/60">0{i + 1}</span>{l.label}
                    </NavLink>
                  </motion.div>
                ))}
              </nav>
              <div className="mt-6 text-urbanex-ivory"><UtilitiesMenu mobile tone="dark" onNavigate={() => setOpen(false)}/></div>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-urbanex-ivory/80">
                <Link to={user ? "/my-listings" : "/list-your-property"} onClick={() => setOpen(false)} className="rounded-full border border-urbanex-gold/60 px-4 py-2 text-urbanex-gold">{user ? t("nav.myListings") : t("nav.listProperty")}</Link>
                <button type="button" onClick={toggleLang} className="rounded-full border border-white/20 px-4 py-2">{t("lang.toggle")}</button>
              </div>
              <div className="mt-auto pt-10">
                {user ? (
                  <div className="flex items-center justify-between text-sm text-urbanex-ivory/70">
                    <span>{user.name}</span>
                    {user.is_admin && <button onClick={() => { setOpen(false); nav("/admin/leads"); }} className="text-urbanex-gold">CRM →</button>}
                    <button onClick={logout}>Sign out</button>
                  </div>
                ) : (
                  <button type="button" data-testid={NAV.login + "-mobile"} onClick={() => { setOpen(false); setLoginOpen(true); }} className="w-full rounded-full bg-urbanex-gold text-urbanex-navy py-3.5 font-medium">Sign in with Google</button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
