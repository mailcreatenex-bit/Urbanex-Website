import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Menu, X, LogOut, LayoutDashboard, Heart } from "lucide-react";
import NotificationBell from "@/components/common/NotificationBell";
import { useFavorites } from "@/context/FavoritesContext";
import { useI18n } from "@/context/I18nContext";
import { useAuth } from "@/context/AuthContext";
import { NAV } from "@/constants/testIds";
import { Button } from "@/components/ui/button";

const LINKS = [
  { to: "/", key: "nav.home", tid: NAV.home },
  { to: "/properties", key: "nav.properties", tid: NAV.properties },
  { to: "/blog", key: "nav.blog", tid: "nav-blog" },
  { to: "/construction", key: "nav.construction", tid: NAV.construction },
  { to: "/about", key: "nav.about", tid: NAV.about },
  { to: "/contact", key: "nav.contact", tid: NAV.contact },
];

export default function Navbar() {
  const { user, logout, setLoginOpen } = useAuth();
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    let raf = 0;
    const on = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; setCompact(window.scrollY > 48); }); };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); if (raf) cancelAnimationFrame(raf); };
  }, []);
  const nav = useNavigate();
  const { t, lang, setLang } = useI18n();
  const { ids } = useFavorites();
  const links = LINKS.map(l => ({ ...l, label: t(l.key) }));
  const toggleLang = () => setLang(lang === "en" ? "bn" : "en");

  return (
    <header className={`sticky top-0 z-40 backdrop-blur-xl border-b border-urbanex-navy/10 transition-all duration-300 ${compact ? "bg-urbanex-ivory/95 shadow-[0_8px_30px_-18px_rgba(10,18,37,0.35)]" : "bg-urbanex-ivory/80"}`}>
      <div className={`max-w-7xl mx-auto px-5 md:px-10 flex items-center justify-between transition-all duration-300 ${compact ? "h-16 md:h-[72px]" : "h-24 md:h-28"}`}>
        <Link to="/" data-testid={NAV.brand} className="flex items-center gap-3 group">
          <img
            src="/brand/urbanex-logo.png"
            alt="Urbanex Realty"
            className={`${compact ? "h-9 md:h-11" : "h-16 md:h-20 lg:h-24"} w-auto object-contain transition-all duration-300 group-hover:scale-[1.04]`}
          />
          <div className="hidden sm:block leading-tight border-l border-urbanex-navy/15 pl-3">
            <div className="text-[10px] tracking-[0.28em] uppercase text-urbanex-gold font-semibold">Since 2022</div>
            <div className="text-xs text-urbanex-navy/60">Burdwan · West Bengal</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <NavLink key={l.to} to={l.to} data-testid={l.tid} end
              className={({isActive}) => `text-sm tracking-wide transition-colors ${isActive ? "text-urbanex-navy" : "text-urbanex-navy/60 hover:text-urbanex-navy"}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button type="button" onClick={toggleLang} data-testid="lang-toggle" className="text-xs border border-urbanex-navy/20 hover:border-urbanex-gold rounded-full px-3 py-1.5 text-urbanex-navy/80">{t("lang.toggle")}</button>
          <Link to="/shortlist" aria-label={t("nav.shortlist")} data-testid="nav-shortlist" className="relative p-2 text-urbanex-navy hover:text-urbanex-gold">
            <Heart className="w-5 h-5"/>
            {ids.length > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-urbanex-gold text-urbanex-navy text-[10px] flex items-center justify-center">{ids.length}</span>}
          </Link>
          <Link to={user ? "/my-listings" : "/list-your-property"} data-testid="nav-list-property" className="text-xs border border-urbanex-gold text-urbanex-navy hover:bg-urbanex-gold/10 rounded-full px-4 py-1.5 whitespace-nowrap">{user ? t("nav.myListings") : t("nav.listProperty")}</Link>
          {user && !user.is_admin && <NotificationBell mode="user"/>}
          {user ? (
            <>
              <span data-testid={NAV.user} className="text-sm text-urbanex-navy/70 max-w-[140px] truncate">{user.name}</span>
              {user.is_admin && (
                <Button variant="outline" size="sm" data-testid={NAV.admin} onClick={() => nav("/admin/leads")} className="border-urbanex-gold text-urbanex-navy hover:bg-urbanex-gold/10">
                  <LayoutDashboard className="w-4 h-4 mr-1"/> {t("nav.crm")}
                </Button>
              )}
              <Button variant="ghost" size="sm" data-testid={NAV.logout} onClick={logout} className="text-urbanex-navy hover:bg-urbanex-navy/5">
                <LogOut className="w-4 h-4"/>
              </Button>
            </>
          ) : (
            <Button data-testid={NAV.login} onClick={() => setLoginOpen(true)}
              className="bg-urbanex-navy hover:bg-urbanex-navyLight text-urbanex-ivory rounded-full px-5">
              {t("nav.signin")}
            </Button>
          )}
        </div>

        <button className="md:hidden text-urbanex-navy" data-testid={NAV.mobileToggle} onClick={() => setOpen(!open)}>
          {open ? <X/> : <Menu/>}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-urbanex-ivory border-t border-urbanex-navy/10 px-5 py-4 flex flex-col gap-3">
          {links.map(l => (
            <NavLink key={l.to} to={l.to} data-testid={l.tid + "-mobile"} onClick={() => setOpen(false)}
              className={({isActive}) => `text-base py-2 ${isActive ? "text-urbanex-gold" : "text-urbanex-navy/80"}`}>
              {l.label}
            </NavLink>
          ))}
          <div className="flex items-center gap-4 text-sm">
            <Link to="/shortlist" onClick={() => setOpen(false)} className="inline-flex items-center gap-1.5 text-urbanex-navy/80"><Heart className="w-4 h-4"/> {t("nav.shortlist")} ({ids.length})</Link>
            <Link to={user ? "/my-listings" : "/list-your-property"} onClick={() => setOpen(false)} className="text-urbanex-gold">{user ? t("nav.myListings") : t("nav.listProperty")}</Link>
            <button type="button" onClick={toggleLang} className="text-urbanex-navy/80 underline">{t("lang.toggle")}</button>
          </div>
          <div className="pt-3 border-t border-urbanex-navy/10">
            {user ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-urbanex-navy/70">{user.name}</span>
                {user.is_admin && <button onClick={() => { setOpen(false); nav("/admin/leads"); }} className="text-sm text-urbanex-gold">CRM →</button>}
                <button onClick={logout} className="text-sm text-urbanex-navy/60">Sign out</button>
              </div>
            ) : (
              <Button data-testid={NAV.login + "-mobile"} onClick={() => { setOpen(false); setLoginOpen(true); }} className="w-full bg-urbanex-navy text-urbanex-ivory rounded-full">Sign in with Google</Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
