import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, UserPlus } from "lucide-react";
import { api } from "@/lib/api";

const inp = "border rounded-lg px-3 py-2 text-sm bg-white";
const err = (e, f) => { const d = e?.response?.data?.detail; return typeof d === "string" ? d : Array.isArray(d) ? d.map(x => x.msg).join("; ") : f; };

export default function TeamPage() {
  const [d, setD] = useState({ members: [], settings: {}, unassigned: 0 });
  const [f, setF] = useState({ name: "", email: "", capacity: 40 });
  const load = useCallback(() => api.get("/admin/crm/team").then(r => setD(r.data)).catch(() => toast.error("Could not load")), []);
  useEffect(() => { load(); }, [load]);
  const add = async (e) => { e.preventDefault(); try { await api.post("/admin/crm/team", { ...f, capacity: Number(f.capacity) || 40 }); setF({ name: "", email: "", capacity: 40 }); load(); toast.success("Added. They can sign in with Google and open the CRM."); } catch (er) { toast.error(err(er, "Could not add")); } };
  const toggle = async (m) => { await api.patch(`/admin/crm/team/${encodeURIComponent(m.email)}`, { email: m.email, name: m.name, active: !m.active, capacity: m.capacity }).catch(() => toast.error("Could not update")); load(); };
  const remove = async (m) => { if (!window.confirm(`Remove ${m.name}? Their open leads are given to the others.`)) return; await api.delete(`/admin/crm/team/${encodeURIComponent(m.email)}`).catch(() => toast.error("Could not remove")); load(); };
  const setting = async (patch) => { await api.put("/admin/crm/team/settings", patch).catch(() => toast.error("Could not save")); load(); };
  const s = d.settings || {};
  return (
    <div className="p-6 md:p-10 space-y-6" data-testid="team-page">
      <div><div className="text-xs tracking-[0.28em] uppercase text-urbanex-gold">CRM</div><h1 className="font-display text-4xl text-urbanex-navy mt-1">Your team</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">People you add here can sign in with their Google account and open the CRM. They see and work only on the leads given to them. Prices, payments, listings and settings stay yours.</p></div>
      <div className="rounded-2xl border bg-white p-4 flex flex-wrap items-center gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!s.auto_assign} onChange={(e) => setting({ auto_assign: e.target.checked })}/> Give each new lead to the person with the most room</label>
        <label className="flex items-center gap-2">Move a lead nobody answered after <input type="number" min="5" max="1440" value={s.rebalance_minutes || 30} onChange={(e) => setting({ rebalance_minutes: Number(e.target.value) || 30 })} className={`${inp} w-20 py-1`}/> minutes</label>
        <span className="text-xs text-gray-500">{d.unassigned} open lead{d.unassigned === 1 ? "" : "s"} kept for you</span>
      </div>
      <form onSubmit={add} className="flex flex-wrap gap-2 items-end">
        <label className="text-xs text-gray-500">Name<input required className={`${inp} block mt-1`} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="team-name"/></label>
        <label className="text-xs text-gray-500">Google e-mail<input required type="email" className={`${inp} block mt-1 w-64`} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="team-email"/></label>
        <label className="text-xs text-gray-500">Most open leads<input type="number" min="1" className={`${inp} block mt-1 w-24`} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })}/></label>
        <button className="inline-flex items-center gap-1.5 rounded-full bg-urbanex-navy text-urbanex-ivory px-5 py-2.5 text-sm" data-testid="team-add"><UserPlus className="w-4 h-4"/> Add</button>
      </form>
      <div className="grid md:grid-cols-2 gap-3">
        {d.members.map(m => (
          <div key={m.email} className={`rounded-2xl border bg-white p-4 ${m.active ? "" : "opacity-60"}`} data-testid={`member-${m.email}`}>
            <div className="flex items-center gap-2"><div className="font-medium">{m.name}</div><div className="text-xs text-gray-500">{m.email}</div>
              <button onClick={() => toggle(m)} className={`ml-auto text-xs rounded-full px-3 py-1 border ${m.active ? "border-emerald-300 text-emerald-700" : "text-gray-500"}`}>{m.active ? "Active" : "Paused"}</button>
              <button onClick={() => remove(m)} aria-label="Remove" className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button></div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
              {[["Open", m.open], ["Not answered", m.untouched], ["Closed this month", m.closed_this_month], ["First reply", m.avg_first_reply_minutes == null ? "—" : m.avg_first_reply_minutes < 90 ? `${m.avg_first_reply_minutes} m` : `${(m.avg_first_reply_minutes / 60).toFixed(1)} h`]].map(([k, v]) => <div key={k} className="rounded-lg bg-gray-50 p-2"><div className="font-display text-lg">{v}</div><div className="text-gray-500">{k}</div></div>)}
            </div>
          </div>
        ))}
        {!d.members.length && <div className="md:col-span-2 rounded-2xl border bg-white p-12 text-center text-gray-400">No team members yet. Add someone and new leads start going to them.</div>}
      </div>
    </div>
  );
}
