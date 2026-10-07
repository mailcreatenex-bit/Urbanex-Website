import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Inbox, Mail, MessageCircle, Send, Settings2, SkipForward } from "lucide-react";
import { api } from "@/lib/api";
import { ago, telLink, waLink } from "@/lib/crm";

const err = (e, f) => { const d = e?.response?.data?.detail; return typeof d === "string" ? d : f; };
const inp = "border rounded-lg px-3 py-2 text-sm bg-white";
const KIND = {
  follow_up_nudge: ["Follow-up nudge", "After a few quiet days"], revival: ["Revival", "After a month of silence"], missed_call: ["Missed-call reply", "Right after a missed call"],
  wish: ["Festival wishes", "To past customers on festival days"], price_drop: ["Price-drop alert", "To people who liked the listing"], reawaken: ["Cold-lead wake-up", "A new listing that fits an old lead"],
  digest: ["Daily “new for you”", "Only to leads who agreed"], visit_reminder: ["Visit reminder", "A day and two hours before"], doc_reminder: ["Document reminder", "When papers are late"], reply: ["Replies", ""],
};

// ---- everything that came in, from every channel
export function InboxPanel({ onOpenLead }) {
  const [d, setD] = useState({ items: [], channels: {} });
  const load = useCallback(() => api.get("/admin/crm/inbox").then(r => setD(r.data)).catch(() => {}), []);
  useEffect(() => { load(); const h = setInterval(load, 30000); return () => clearInterval(h); }, [load]);
  const ch = d.channels || {};
  const chips = [["Website", ch.website], ["Portal e-mails", ch.imap || ch.email_webhook], ["Facebook / Instagram", ch.meta], ["WhatsApp", ch.whatsapp], ["Missed calls", ch.missed_calls]];
  const done = async (i) => { await api.post(`/admin/crm/inbox/${i.id}/handled`).catch(() => {}); load(); };
  const ICON = { email: Mail, whatsapp: MessageCircle };
  return (
    <div className="mt-4 space-y-4" data-testid="crm-inbox">
      <div className="rounded-2xl border bg-white p-4 flex flex-wrap gap-2 items-center text-sm">
        <Inbox className="w-5 h-5 text-urbanex-gold"/><span className="font-medium mr-2">Channels</span>
        {chips.map(([l, on]) => <span key={l} className={`text-xs rounded-full px-3 py-1 ${on ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{l}: {on ? "connected" : "not connected"}</span>)}
        {ch.imap_error && <span className="text-xs text-red-600">{ch.imap_error}</span>}
        <span className="w-full text-xs text-gray-500">Setup steps for each channel are in docs/LEAD_SOURCES.md. Leads from a channel that is not connected can still be added by hand or imported.</span>
      </div>
      <div className="space-y-2">
        {d.items.map(i => { const Icon = ICON[i.channel] || Inbox; return (
          <div key={i.id} className="rounded-xl border bg-white p-3 flex items-center gap-3" data-testid={`inbox-${i.id}`}>
            <Icon className="w-4 h-4 text-gray-400 shrink-0"/>
            <div className="flex-1 min-w-0">
              <div className="text-sm"><button onClick={() => i.lead_id && onOpenLead(i.lead_id)} className="font-medium hover:text-urbanex-gold">{i.lead_name || i.name || i.phone || "Unknown"}</button> <span className="text-xs text-gray-400">· {i.channel.replace("_", " ")}{i.created === false ? " · again" : ""}{i.spam ? " · spam" : ""}</span></div>
              <div className="text-xs text-gray-500 truncate">{i.snippet}</div>
            </div>
            {i.phone && <div className="flex gap-1.5 text-xs"><a href={telLink(i.phone)} className="rounded-full bg-urbanex-navy text-urbanex-ivory px-3 py-1">Call</a><a target="_blank" rel="noopener noreferrer" href={waLink(i.phone)} className="rounded-full bg-[#25D366] text-white px-3 py-1">WhatsApp</a></div>}
            <span className="text-[11px] text-gray-400 w-16 text-right">{ago(i.at)}</span>
            {i.status !== "handled" ? <button onClick={() => done(i)} aria-label="Mark as dealt with" className="text-gray-300 hover:text-emerald-600"><CheckCircle2 className="w-5 h-5"/></button> : <CheckCircle2 className="w-5 h-5 text-emerald-500"/>}
          </div>); })}
        {!d.items.length && <div className="rounded-2xl border bg-white p-12 text-center text-gray-400">Nothing has come in yet through the connected channels.</div>}
      </div>
    </div>
  );
}

// ---- messages waiting for your tap, and the rules that make them
export function OutboxPanel({ onOpenLead }) {
  const [d, setD] = useState({ items: [], counts: {}, api_connected: false });
  const [status, setStatus] = useState("queued");
  const [edit, setEdit] = useState({});
  const load = useCallback(() => api.get("/admin/crm/outbox", { params: { status } }).then(r => setD(r.data)).catch(() => {}), [status]);
  useEffect(() => { load(); }, [load]);
  const send = async (m, via) => { try { await api.post(`/admin/crm/outbox/${m.id}/send`, { via }); toast.success(via === "api" ? "Sent" : "Marked as sent"); load(); } catch (e) { toast.error(err(e, "Could not send")); } };
  const skip = async (m) => { await api.post(`/admin/crm/outbox/${m.id}/skip`).catch(() => {}); load(); };
  const save = async (m) => { await api.patch(`/admin/crm/outbox/${m.id}`, { text: edit[m.id] }).catch(() => toast.error("Could not save")); setEdit(e => { const n = { ...e }; delete n[m.id]; return n; }); load(); };
  const first = d.items.filter(m => m.status === "queued");
  const sendAll = async () => { for (const m of first) { window.open(waLink(m.phone, edit[m.id] ?? m.text), "_blank", "noopener"); await api.post(`/admin/crm/outbox/${m.id}/send`, { via: "manual" }).catch(() => {}); await new Promise(r => setTimeout(r, 700)); } load(); };
  return (
    <div className="mt-4 space-y-4" data-testid="crm-outbox">
      <div className="flex flex-wrap gap-2 items-center">
        {[["queued", "Ready to send"], ["sent", "Sent"], ["skipped", "Skipped"], ["failed", "Failed"]].map(([k, l]) => <button key={k} onClick={() => setStatus(k)} className={`px-4 py-1.5 rounded-full border text-sm ${status === k ? "bg-urbanex-navy text-urbanex-ivory border-urbanex-navy" : "bg-white hover:border-urbanex-gold"}`}>{l} {d.counts?.[k] ? `(${d.counts[k]})` : ""}</button>)}
        {status === "queued" && first.length > 1 && !d.api_connected && <button onClick={sendAll} className="ml-auto text-sm rounded-full border border-[#25D366] text-[#128C7E] px-4 py-1.5">Open all in WhatsApp, one by one</button>}
      </div>
      {!d.api_connected && status === "queued" && <div className="text-xs rounded-lg bg-amber-50 text-amber-800 px-3 py-2">The WhatsApp Business API is not connected, so each message opens in your WhatsApp and you press send. Connect it (docs/LEAD_SOURCES.md) and messages set to “automatic” go out by themselves.</div>}
      <div className="space-y-2">
        {d.items.map(m => (
          <div key={m.id} className="rounded-xl border bg-white p-3" data-testid={`outbox-${m.id}`}>
            <div className="flex items-center gap-2 text-sm"><button onClick={() => onOpenLead(m.lead_id)} className="font-medium hover:text-urbanex-gold">{m.lead_name}</button><span className="text-[10px] uppercase tracking-widest bg-urbanex-gold/15 rounded-full px-2 py-0.5">{(KIND[m.kind] || [m.kind])[0]}</span><span className="ml-auto text-xs text-gray-400">{ago(m.created_at)}</span></div>
            {m.status === "queued" ? <textarea rows={3} className={`${inp} w-full mt-2`} value={edit[m.id] ?? m.text} onChange={(e) => setEdit({ ...edit, [m.id]: e.target.value })}/> : <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{m.text}</div>}
            {m.error && <div className="text-xs text-red-600 mt-1">{m.error}</div>}{m.note && <div className="text-xs text-gray-400 mt-1">{m.note}</div>}
            {m.status === "queued" && (
              <div className="mt-2 flex flex-wrap gap-2">
                <a target="_blank" rel="noopener noreferrer" href={waLink(m.phone, edit[m.id] ?? m.text)} onClick={() => { if (edit[m.id] != null) save(m); send(m, "manual"); }} className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] text-white px-4 py-1.5 text-sm"><MessageCircle className="w-4 h-4"/> Open in WhatsApp</a>
                {d.api_connected && <button onClick={() => send(m, "api")} className="inline-flex items-center gap-1.5 rounded-full bg-urbanex-navy text-urbanex-ivory px-4 py-1.5 text-sm"><Send className="w-4 h-4"/> Send now</button>}
                {edit[m.id] != null && <button onClick={() => save(m)} className="rounded-full border px-3 py-1.5 text-sm">Save my edit</button>}
                <button onClick={() => skip(m)} className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm text-gray-500"><SkipForward className="w-4 h-4"/> Skip</button>
              </div>
            )}
          </div>
        ))}
        {!d.items.length && <div className="rounded-2xl border bg-white p-12 text-center text-gray-400">{status === "queued" ? "Nothing waiting. Messages for follow-ups, wishes and alerts appear here before they are sent." : "Nothing here."}</div>}
      </div>
    </div>
  );
}

export function AutomationPanel() {
  const [cfg, setCfg] = useState(null);
  const [running, setRunning] = useState(false);
  useEffect(() => { api.get("/admin/crm/automation").then(r => setCfg(r.data)).catch(() => {}); }, []);
  if (!cfg) return null;
  const save = async (patch, msg = "Saved") => { try { const { data } = await api.put("/admin/crm/automation", patch); setCfg(data); if (msg) toast.success(msg); } catch (e) { toast.error(err(e, "Could not save")); } };
  const setMode = (k, v) => save({ modes: { [k]: v } }, "");
  const steps = cfg.sequence.steps;
  const setStep = (i, patch) => save({ sequence: { enabled: cfg.sequence.enabled, steps: steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) } }, "");
  const run = async () => { setRunning(true); try { const { data } = await api.post("/admin/crm/automation/run"); toast.success(`Done: ${data.sequences?.messages || 0} follow-ups, ${data.wishes || 0} wishes, ${data.reawaken || 0} wake-ups, ${data.digest || 0} digests`); } catch { toast.error("Could not run"); } finally { setRunning(false); } };
  return (
    <div className="rounded-2xl border bg-white p-5 space-y-5" data-testid="crm-automation">
      <div className="flex items-center gap-2"><Settings2 className="w-5 h-5 text-urbanex-gold"/><h3 className="font-medium">Automatic messages</h3>
        <span className={`text-xs rounded-full px-2.5 py-0.5 ${cfg.api_connected ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>WhatsApp Business API {cfg.api_connected ? "connected" : "not connected"}</span>
        <button onClick={run} disabled={running} className="ml-auto text-xs rounded-full border px-3 py-1.5 hover:border-urbanex-gold disabled:opacity-50">{running ? "Running…" : "Run all now"}</button></div>
      <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
        {Object.entries(KIND).filter(([k]) => k !== "reply").map(([k, [label, sub]]) => (
          <div key={k} className="flex items-center gap-3 text-sm"><div className="flex-1"><div>{label}</div><div className="text-[11px] text-gray-400">{sub}</div></div>
            <select value={cfg.modes[k]} onChange={(e) => setMode(k, e.target.value)} className={`${inp} py-1 text-xs`}><option value="ask">Ask me first</option><option value="auto">Send by itself</option><option value="off">Off</option></select></div>
        ))}
      </div>
      <div>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={cfg.sequence.enabled} onChange={(e) => save({ sequence: { enabled: e.target.checked, steps } }, "")}/> Follow-up sequence for leads who go quiet</label>
        <div className="mt-2 space-y-1.5 text-sm">{steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">After <input type="number" min="1" max="365" value={s.after_days} onChange={(e) => setStep(i, { after_days: Number(e.target.value) || 1 })} className={`${inp} w-20 py-1`}/> days:
            <select value={s.action === "call" ? "call" : s.kind} onChange={(e) => setStep(i, e.target.value === "call" ? { action: "call", kind: undefined } : { action: "message", kind: e.target.value })} className={`${inp} py-1`}><option value="follow_up_nudge">send a nudge</option><option value="revival">send a revival message</option><option value="call">remind me to call</option></select></div>
        ))}</div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.wishes} onChange={(e) => save({ wishes: e.target.checked }, "")}/> Festival and birthday wishes to</label>
        <select value={cfg.wish_audience} onChange={(e) => save({ wish_audience: e.target.value }, "")} className={`${inp} py-1`}><option value="customers">past customers</option><option value="all_contacted">everyone I have spoken to</option></select>
        <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.reawaken} onChange={(e) => save({ reawaken: e.target.checked }, "")}/> Wake up cold leads every <input type="number" min="1" max="60" value={cfg.reawaken_every_days} onChange={(e) => save({ reawaken_every_days: Number(e.target.value) || 7 }, "")} className={`${inp} w-16 py-1`}/> days</label>
        <span className="text-xs text-gray-500">No automatic message goes out between {cfg.quiet_from}:00 and {cfg.quiet_to}:00.</span>
      </div>
    </div>
  );
}
