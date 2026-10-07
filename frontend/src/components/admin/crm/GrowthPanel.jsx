import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Gift, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { when } from "@/lib/crm";

const inp = "border rounded-lg px-3 py-2 text-sm bg-white";
const err = (e, f) => { const d = e?.response?.data?.detail; return typeof d === "string" ? d : f; };
const LABEL = { plot_documents: "Plot documents", land_report_preview: "Land report preview" };

function FreeChecks({ onOpenLead }) {
  const [d, setD] = useState(null);
  const load = useCallback(() => api.get("/admin/free-checks").then(r => setD(r.data)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  if (!d) return null;
  const setLimit = async (limit) => { try { await api.put("/admin/free-checks/limit", { limit }); load(); } catch (e) { toast.error(err(e, "Could not save")); } };
  const mark = async (id, status) => { await api.patch(`/admin/free-checks/${id}`, { status }).catch(() => toast.error("Could not update")); load(); };
  return (
    <div className="rounded-2xl border bg-white p-5" data-testid="free-checks-admin">
      <div className="flex flex-wrap items-center gap-3"><ShieldCheck className="w-5 h-5 text-urbanex-gold"/><h3 className="font-medium">Free checks this week</h3>
        <span className="text-xs text-gray-500">{d.used} of {d.limit} used, resets {d.resets_on}</span>
        <label className="ml-auto text-xs text-gray-500">Free checks per week <input type="number" min="0" max="500" defaultValue={d.limit} onBlur={(e) => Number(e.target.value) !== d.limit && setLimit(Number(e.target.value) || 0)} className={`${inp} w-20 py-1 ml-1`}/></label></div>
      <div className="mt-3 divide-y text-sm">
        {d.items.map(x => (
          <div key={x.id} className="py-2 flex flex-wrap items-center gap-3">
            <button onClick={() => onOpenLead(x.lead_id)} className="font-medium hover:text-urbanex-gold">{x.name}</button>
            <span className="text-xs bg-gray-100 rounded-full px-2 py-0.5">{LABEL[x.kind]}</span>
            <span className={`text-xs rounded-full px-2 py-0.5 ${x.status === "done" ? "bg-emerald-100 text-emerald-700" : x.status === "waitlist" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-700"}`}>{x.status}</span>
            <span className="text-xs text-gray-500 flex-1 min-w-[160px] truncate">{x.details}</span>
            <span className="text-[11px] text-gray-400">{when(x.created_at)}</span>
            {x.status !== "done" && <button onClick={() => mark(x.id, "done")} className="inline-flex items-center gap-1 text-xs rounded-full border px-2.5 py-1 hover:border-emerald-400"><Check className="w-3 h-3"/> Done</button>}
            {x.status === "waitlist" && <button onClick={() => mark(x.id, "booked")} className="text-xs rounded-full border px-2.5 py-1 hover:border-urbanex-gold">Book it</button>}
          </div>))}
        {!d.items.length && <div className="py-6 text-center text-gray-400">No requests yet. The page is at /free-check.</div>}
      </div>
    </div>
  );
}

function Referrals() {
  const [rows, setRows] = useState(null);
  const [f, setF] = useState({ name: "", phone: "", reward_note: "" });
  const load = useCallback(() => api.get("/admin/referrals").then(r => setRows(r.data)).catch(() => setRows([])), []);
  useEffect(() => { load(); }, [load]);
  const add = async (e) => { e.preventDefault(); try { await api.post("/admin/referrals", f); setF({ name: "", phone: "", reward_note: "" }); load(); toast.success("Link made. Copy it and send it on WhatsApp."); } catch (er) { toast.error(err(er, "Could not make it")); } };
  const copy = async (link) => { try { await navigator.clipboard.writeText(link); toast.success("Copied"); } catch { toast.message(link); } };
  const patch = async (code, body) => { await api.patch(`/admin/referrals/${code}`, body).catch(() => toast.error("Could not save")); load(); };
  return (
    <div className="rounded-2xl border bg-white p-5" data-testid="referrals-admin">
      <div className="flex items-center gap-3"><Gift className="w-5 h-5 text-urbanex-gold"/><h3 className="font-medium">Referral links for past clients</h3></div>
      <p className="mt-1 text-xs text-gray-500">Give each past client their own link. Anyone who enquires through it is tagged to them in the CRM, so you can thank them when a deal closes.</p>
      <form onSubmit={add} className="mt-3 flex flex-wrap gap-2">
        <input required placeholder="Client's name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inp} data-testid="ref-name"/>
        <input placeholder="Phone (optional)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={inp}/>
        <input placeholder="Thank-you you will give (optional)" value={f.reward_note} onChange={(e) => setF({ ...f, reward_note: e.target.value })} className={`${inp} w-64`}/>
        <button className="rounded-full bg-urbanex-navy text-urbanex-ivory px-5 text-sm" data-testid="ref-add">Make link</button>
      </form>
      <div className="mt-3 divide-y text-sm">
        {(rows || []).map(r => (
          <div key={r.code} className="py-2.5 flex flex-wrap items-center gap-3">
            <div className="font-medium">{r.name}</div>
            <button onClick={() => copy(r.link)} className="inline-flex items-center gap-1 text-xs font-mono bg-gray-100 rounded px-2 py-1 hover:bg-gray-200"><Copy className="w-3 h-3"/> {r.link.replace(/^https?:\/\//, "")}</button>
            <span className="text-xs text-gray-500">{r.clicks} opened · {r.leads} enquir{r.leads === 1 ? "y" : "ies"} · {r.closed} closed</span>
            <input defaultValue={r.reward_note || ""} placeholder="Thank-you" onBlur={(e) => e.target.value !== (r.reward_note || "") && patch(r.code, { reward_note: e.target.value })} className={`${inp} py-1 text-xs flex-1 min-w-[140px]`}/>
            <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={!!r.rewarded} onChange={(e) => patch(r.code, { rewarded: e.target.checked })}/> thanked</label>
          </div>))}
        {rows && !rows.length && <div className="py-6 text-center text-gray-400">No referral links yet.</div>}
      </div>
    </div>
  );
}

export default function GrowthPanel({ onOpenLead }) {
  return <div className="mt-4 space-y-4" data-testid="crm-growth"><FreeChecks onOpenLead={onOpenLead}/><Referrals/></div>;
}
