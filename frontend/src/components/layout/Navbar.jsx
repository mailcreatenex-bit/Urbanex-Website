import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Menu, X, LogOut, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { NAV } from "@/constants/testIds";
import { Button } from "@/components/ui/button";

const links = [
  { to: "/", label: "Home", tid: NAV.home },
  { to: "/properties", label: "Properties", tid: NAV.properties },
  { to: "/construction", label: "Construction", tid: NAV.construction },
  { to: "/about", label: "About", tid: NAV.about },
  { to: "/contact", label: "Contact", tid: NAV.contact },
];

export default function Navbar() {
  const { user, logout, setLoginOpen } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  return (
    <header className="sticky top-0 z-40 bg-urbanex-ivory/85 backdrop-blur-xl border-b border-urbanex-navy/10">
      <div className="max-w-7xl mx-auto px-5 md:px-10 flex items-center justify-between h-20">
        <Link to="/" data-testid={NAV.brand} className="flex items-center gap-3 group">
          <span className="w-9 h-9 rounded-full border border-urbanex-gold flex items-center justify-center bg-urbanex-navy text-urbanex-gold font-display text-xl leading-none">U</span>
          <div className="leading-tight">
            <div className="font-display text-xl text-urbanex-navy tracking-tight">Urbanex</div>
            <div className="text-[10px] tracking-[0.28em] uppercase text-urbanex-gold font-medium">Realty · Burdwan</div>
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
          {user ? (
            <>
              <span data-testid={NAV.user} className="text-sm text-urbanex-navy/70 max-w-[140px] truncate">{user.name}</span>
              {user.is_admin && (
                <Button variant="outline" size="sm" data-testid={NAV.admin} onClick={() => nav("/admin/leads")} className="border-urbanex-gold text-urbanex-navy hover:bg-urbanex-gold/10">
                  <LayoutDashboard className="w-4 h-4 mr-1"/> CRM
                </Button>
              )}
              <Button variant="ghost" size="sm" data-testid={NAV.logout} onClick={logout} className="text-urbanex-navy hover:bg-urbanex-navy/5">
                <LogOut className="w-4 h-4"/>
              </Button>
            </>
          ) : (
            <Button data-testid={NAV.login} onClick={() => setLoginOpen(true)}
              className="bg-urbanex-navy hover:bg-urbanex-navyLight text-urbanex-ivory rounded-full px-5">
              Sign in
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
