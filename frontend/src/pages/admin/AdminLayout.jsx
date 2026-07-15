import { Outlet, NavLink, useNavigate, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, Users, BarChart3, FileText, LogOut, ArrowLeft } from "lucide-react";
import { ADMIN } from "@/constants/testIds";

export default function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const nav = useNavigate();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-urbanex-navy/50">Verifying…</div>;
  if (!user) return <Navigate to="/" replace/>;
  if (!user.is_admin) return <Navigate to="/" replace/>;

  const items = [
    { to: "/admin/leads", label: "Leads", icon: Users, tid: ADMIN.navLeads },
    { to: "/admin/reports", label: "Reports", icon: BarChart3, tid: ADMIN.navReports },
    { to: "/admin/invoices", label: "Invoices", icon: FileText, tid: ADMIN.navInvoices },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] grid grid-cols-1 lg:grid-cols-[260px_1fr]">
      <aside className="hidden lg:flex flex-col bg-urbanex-navy text-urbanex-ivory p-6">
        <button onClick={() => nav("/")} className="flex items-center gap-3 mb-10 group text-left">
          <span className="w-9 h-9 rounded-full border border-urbanex-gold flex items-center justify-center text-urbanex-gold font-display text-xl">U</span>
          <div>
            <div className="font-display text-lg">Urbanex CRM</div>
            <div className="text-[10px] tracking-[0.28em] uppercase text-urbanex-gold">Ayan Dey</div>
          </div>
        </button>

        <nav className="flex-1 space-y-1">
          {items.map(it => (
            <NavLink key={it.to} to={it.to} data-testid={it.tid}
              className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${isActive ? "bg-urbanex-gold/15 text-urbanex-gold" : "text-urbanex-ivory/70 hover:bg-white/5 hover:text-urbanex-ivory"}`}>
              <it.icon className="w-4 h-4"/> {it.label}
            </NavLink>
          ))}
        </nav>

        <div className="pt-6 border-t border-white/10 space-y-3">
          <button onClick={() => nav("/")} className="flex items-center gap-2 text-xs text-urbanex-ivory/50 hover:text-urbanex-ivory">
            <ArrowLeft className="w-3.5 h-3.5"/> Back to site
          </button>
          <div className="flex items-center gap-3">
            {user.picture ? <img src={user.picture} alt="" className="w-8 h-8 rounded-full"/> : <div className="w-8 h-8 rounded-full bg-urbanex-gold/20"/>}
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{user.name}</div>
              <div className="text-[10px] text-urbanex-ivory/50 truncate">{user.email}</div>
            </div>
            <button onClick={logout} className="text-urbanex-ivory/60 hover:text-urbanex-gold" title="Sign out"><LogOut className="w-4 h-4"/></button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden bg-urbanex-navy text-urbanex-ivory p-4 flex items-center justify-between">
        <div className="font-display text-lg">Urbanex CRM</div>
        <div className="flex gap-3 text-xs">
          {items.map(it => (
            <NavLink key={it.to} to={it.to} className={({isActive}) => `px-3 py-1.5 rounded-full ${isActive ? "bg-urbanex-gold text-urbanex-navy" : "bg-white/5"}`}>{it.label}</NavLink>
          ))}
        </div>
      </div>

      <main className="p-6 md:p-10 overflow-y-auto"><Outlet/></main>
    </div>
  );
}
