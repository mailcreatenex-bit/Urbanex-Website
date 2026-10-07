import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Banknote, CalendarPlus, CheckSquare, ClipboardList, Copy, Languages, Mic, Phone, Sparkles, Square, Target } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { inrShort, telLink, waLink } from "@/lib/crm";

const inp = "w-full border rounded-lg px-3 py-2 text-sm bg-white";
const err = (e, f) => { const d = e?.response?.data?.detail; return typeof d === "string" ? d : f; };
const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

function Section({ icon: Icon, title, children, open = false, badge, testId }) {
  return (
    <details open={open} className="mt-3 rounded-xl border bg-white group" data-testid={testId}>
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center gap-2 text-sm font-medium text-urbanex-navy"><Icon className="w-4 h-4 text-urbanex-gold"/>{title}{badge ? <span className="ml-auto text-[10px] bg-urbanex-gold/20 rounded-full px-2 py-0.5">{badge}</span> : null}</summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

// ---- before you call
function Brief({ lead }) {
  const [b, setB] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = async (fresh = false) => {
    setBusy(true);
    try { const { data } = await api.get(`/admin/leads/${lead.id}/brief`, { params: fresh ? { fresh: true } : {} }); setB(data); } catch (e) { toast.error(err(e, "Could not prepare the brief")); } finally { setBusy(false); }
  };
  return (
    <div>
      {!b ? <button onClick={() => load()} disabled={busy} data-testid="brief-go" className="rounded-full border border-urbanex-gold px-4 py-2 text-sm disabled:opacity-50">{busy ? "Preparing…" : "Get ready to call"}</button> : (
        <div className="space-y-3 text-sm">
          <p className="text-urbanex-navy/80">{b.recap}</p>
          <div className="rounded-lg bg-urbanex-cream p-3"><span className="text-[10px] uppercase tracking-widest text-urbanex-gold">Open with</span><div>{b.opener}</div></div>
          {b.talking_points?.length > 0 && <div><div className="text-[10px] uppercase tracking-widest text-urbanex-gold">Say</div><ul className="list-disc pl-5">{b.talking_points.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
          <div><div className="text-[10px] uppercase tracking-widest text-urbanex-gold">Ask</div><ul className="list-disc pl-5">{b.questions.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          {b.watch_out_for?.length > 0 && <div><div className="text-[10px] uppercase tracking-widest text-red-600">Watch out for</div><ul className="list-disc pl-5">{b.watch_out_for.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
          <button onClick={() => load(true)} disabled={busy} className="text-xs underline text-urbanex-navy/50">{busy ? "…" : "Refresh"}</button>
        </div>
      )}
    </div>
  );
}

// ---- a note, spoken or typed, about this one customer
function VoiceNote({ lead, onChange }) {
  const [text, setText] = useState("");
  const [on, setOn] = useState(false);
  const [prev, setPrev] = useState(null);
  const [busy, setBusy] = useState(false);
  const rec = useRef(null);
  useEffect(() => () => rec.current?.stop?.(), []);
  const start = () => {
    if (!SR) return toast.error("This browser cannot turn speech into text. Type instead, or use the microphone on your phone keyboard.");
    const r = new SR(); r.lang = lead.language === "bn" ? "bn-IN" : "en-IN"; r.continuous = true; r.interimResults = true;
    const base = text ? text + " " : "";
    r.onresult = (e) => { let s = ""; for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript; setText(base + s); };
    r.onend = () => setOn(false); r.onerror = () => setOn(false);
    r.start(); rec.current = r; setOn(true);
  };
  const read = async () => {
    setBusy(true);
    try { const { data } = await api.post(`/admin/leads/${lead.id}/ai/note`, { text }); setPrev(data); } catch (e) { toast.error(err(e, "The AI could not read that")); } finally { setBusy(false); }
  };
  const apply = async () => {
    setBusy(true);
    try { const { data } = await api.post(`/admin/leads/${lead.id}/ai/note/apply`, prev); onChange(data); setPrev(null); setText(""); toast.success("Lead updated"); } catch (e) { toast.error(err(e, "Could not save")); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2" data-testid="voice-note">
      <p className="text-xs text-gray-500">Say what happened after a call or visit. The CRM updates the budget, what they want, the next follow-up and your to-dos.</p>
      <textarea rows={3} className={inp} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Met at the Goda plot, he likes the corner one, budget around 30 lakh, show more on Sunday"/>
      <div className="flex gap-2">
        {on ? <button onClick={() => { rec.current?.stop(); setOn(false); }} className="inline-flex items-center gap-1.5 rounded-full bg-red-600 text-white px-4 py-2 text-sm"><Square className="w-4 h-4"/> Stop</button>
          : <button onClick={start} className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm"><Mic className="w-4 h-4"/> Speak</button>}
        <button onClick={read} disabled={busy || text.trim().length < 3} data-testid="voice-note-read" className="inline-flex items-center gap-1.5 rounded-full bg-urbanex-navy text-urbanex-ivory px-4 py-2 text-sm disabled:opacity-40"><Sparkles className="w-4 h-4"/> Read it</button>
      </div>
      {prev && (
        <div className="rounded-lg border bg-urbanex-cream p-3 space-y-2 text-sm">
          <input className={inp} value={prev.summary} onChange={(e) => setPrev({ ...prev, summary: e.target.value })}/>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {prev.wants?.budget_inr ? <span className="bg-white rounded-full px-2 py-0.5">budget {inrShort(prev.wants.budget_inr)}</span> : null}
            {prev.wants?.bedrooms != null && <span className="bg-white rounded-full px-2 py-0.5">{prev.wants.bedrooms} BHK</span>}
            {prev.wants?.property_type && <span className="bg-white rounded-full px-2 py-0.5">{prev.wants.property_type}</span>}
            {(prev.wants?.zones || []).map(z => <span key={z} className="bg-white rounded-full px-2 py-0.5">{z}</span>)}
            {prev.status_hint && <span className="bg-white rounded-full px-2 py-0.5">stage → {prev.status_hint}</span>}
            <label className="ml-auto flex items-center gap-1">Follow up <input type="date" value={prev.follow_up_date || ""} onChange={(e) => setPrev({ ...prev, follow_up_date: e.target.value || null })} className="border rounded px-1"/></label>
          </div>
          {prev.tasks?.map((t, i) => <div key={i} className="text-xs">To do: {t.text}{t.due ? ` (by ${t.due})` : ""}</div>)}
          <div className="flex gap-2"><button onClick={apply} disabled={busy} data-testid="voice-note-apply" className="rounded-full bg-urbanex-navy text-urbanex-ivory px-4 py-1.5 text-sm">Save to this lead</button><button onClick={() => setPrev(null)} className="text-xs underline text-gray-500">Discard</button></div>
        </div>
      )}
    </div>
  );
}

// ---- promises and to-dos
function Tasks({ lead, reload }) {
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const add = async () => { if (!text.trim()) return; try { await api.post(`/admin/leads/${lead.id}/tasks`, { text, due: due || null }); setText(""); setDue(""); reload(); } catch (e) { toast.error(err(e, "Could not add")); } };
  const toggle = async (t) => { await api.patch(`/admin/leads/${lead.id}/tasks/${t.id}`, { done: !t.done }).catch(() => toast.error("Could not update")); reload(); };
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-1.5" data-testid="lead-tasks">
      {(lead.tasks || []).map(t => (
        <button key={t.id} type="button" onClick={() => toggle(t)} className="w-full flex items-start gap-2 text-left text-sm">
          {t.done ? <CheckSquare className="w-4 h-4 mt-0.5 text-emerald-600"/> : <Square className="w-4 h-4 mt-0.5 text-gray-400"/>}
          <span className={t.done ? "line-through text-gray-400" : ""}>{t.text}{t.due ? <span className={`ml-2 text-[11px] ${!t.done && t.due < today ? "text-red-600" : "text-gray-500"}`}>by {t.due}</span> : null}{t.source === "call" ? <span className="ml-2 text-[10px] bg-gray-100 rounded-full px-1.5">from a call</span> : null}</span>
        </button>
      ))}
      {!(lead.tasks || []).length && <div className="text-xs text-gray-400">Nothing promised yet. Promises you make on recorded calls appear here by themselves.</div>}
      <div className="flex gap-2 pt-1"><input className={inp} placeholder="Add a to-do" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}/><input type="date" className={`${inp} w-40`} value={due} onChange={(e) => setDue(e.target.value)}/><button onClick={add} className="rounded-lg bg-urbanex-navy text-urbanex-ivory px-4 text-sm">Add</button></div>
    </div>
  );
}

// ---- which listings fit this lead, or who might buy from this seller
function Fit({ lead }) {
  const [d, setD] = useState(null);
  useEffect(() => { api.get(`/admin/leads/${lead.id}/matches`).then(r => setD(r.data)).catch(() => setD({ kind: "listings", listings: [] })); }, [lead.id, lead.updated_at]);
  if (!d) return <div className="text-xs text-gray-400">Looking…</div>;
  if (d.kind === "buyers") {
    return (
      <div className="space-y-2" data-testid="fit-buyers">
        {!d.item && <div className="text-xs text-gray-500">Add what they are selling (type, place, asking price) to see who might buy.</div>}
        {d.buyers.map(b => <div key={b.id} className="flex items-center gap-2 text-sm"><div className="flex-1"><b>{b.name}</b><div className="text-xs text-gray-500">{b.match_reasons.join(" · ")}</div></div>{b.phone && <a href={telLink(b.phone)} className="rounded-full bg-urbanex-navy text-urbanex-ivory px-3 py-1 text-xs"><Phone className="w-3 h-3 inline"/> Call</a>}</div>)}
        {d.item && !d.buyers.length && <div className="text-xs text-gray-500">No buyer in your CRM fits yet.</div>}
      </div>
    );
  }
  return (
    <div className="space-y-2" data-testid="fit-listings">
      {d.listings.map(l => (
        <div key={`${l.kind}${l.id}`} className="flex items-center gap-2 text-sm">
          <div className="flex-1"><b>{l.title}</b><div className="text-xs text-gray-500">{l.reasons.join(" · ")}</div></div>
          {lead.phone && <a target="_blank" rel="noopener noreferrer" href={waLink(lead.phone, `Hi ${(lead.name || "").split(" ")[0]}, I found something that may suit you: ${l.title}. Shall I send the details?`)} className="rounded-full bg-[#25D366] text-white px-3 py-1 text-xs">WhatsApp</a>}
        </div>
      ))}
      {!d.listings.length && <div className="text-xs text-gray-500">None of your priced listings fit yet. Add their budget and what they want to see matches.</div>}
    </div>
  );
}

// ---- let them pick their own visit time
function VisitLink({ lead }) {
  const [props, setProps] = useState([]);
  const [pid, setPid] = useState("");
  const [mode, setMode] = useState("onsite");
  const [out, setOut] = useState(null);
  useEffect(() => { api.get("/admin/properties").then(r => setProps(r.data || [])).catch(() => {}); }, []);
  const make = async () => {
    try { const { data } = await api.post(`/admin/leads/${lead.id}/visit-link`, { property_id: pid || null, mode }); setOut(data); } catch (e) { toast.error(err(e, "Could not make the link")); }
  };
  return (
    <div className="space-y-2" data-testid="visit-link">
      <div className="flex gap-2"><select className={inp} value={mode} onChange={(e) => setMode(e.target.value)}><option value="onsite">Site visit</option><option value="video">Video call</option></select>
        <select className={inp} value={pid} onChange={(e) => setPid(e.target.value)}><option value="">Which property?</option>{props.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
      <button onClick={make} className="rounded-full border border-urbanex-gold px-4 py-2 text-sm">Make a booking link</button>
      {out && (
        <div className="rounded-lg bg-urbanex-cream p-3 text-xs space-y-2"><div className="break-all">{out.link}</div>
          <div className="flex gap-2">{lead.phone && <a target="_blank" rel="noopener noreferrer" href={waLink(lead.phone, out.text)} className="rounded-full bg-[#25D366] text-white px-3 py-1">Send on WhatsApp</a>}
            <button onClick={() => navigator.clipboard?.writeText(out.link).then(() => toast.success("Copied"))} className="rounded-full border px-3 py-1 inline-flex items-center gap-1"><Copy className="w-3 h-3"/> Copy</button></div></div>
      )}
    </div>
  );
}

// ---- document checklist
function Checklist({ lead, reload }) {
  const [type, setType] = useState("plot_purchase");
  const docs = lead.deal_docs || [];
  const start = async () => { try { await api.post(`/admin/leads/${lead.id}/checklist`, { type }); reload(); } catch (e) { toast.error(err(e, "Could not start")); } };
  const set = async (d, status) => { await api.patch(`/admin/leads/${lead.id}/checklist/${d.key}`, { status }).catch(() => toast.error("Could not update")); reload(); };
  const done = docs.filter(d => d.status !== "pending").length;
  return (
    <div className="space-y-2" data-testid="checklist">
      {docs.length > 0 && <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${(done / docs.length) * 100}%` }}/></div>}
      {docs.map(d => (
        <div key={d.key} className="flex items-center gap-2 text-sm"><select value={d.status} onChange={(e) => set(d, e.target.value)} className={`rounded-full text-xs px-2 py-1 border ${d.status === "pending" ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
          <option value="pending">Needed</option><option value="received">Received</option><option value="verified">Checked</option><option value="na">Not needed</option></select>
          <span className={d.status !== "pending" ? "text-gray-400" : ""}>{d.label}</span><span className="ml-auto text-[10px] text-gray-400">{d.party === "us" ? "you" : d.party}</span></div>
      ))}
      <div className="flex gap-2"><select className={inp} value={type} onChange={(e) => setType(e.target.value)}><option value="plot_purchase">Buying a plot</option><option value="flat_purchase">Buying a flat</option><option value="rent">Renting</option><option value="loan">Home loan papers</option></select>
        <button onClick={start} className="rounded-lg border px-4 text-sm whitespace-nowrap">{docs.length ? "Add list" : "Start list"}</button></div>
    </div>
  );
}

// ---- bank hand-off
function Loan({ lead, reload }) {
  const [partners, setPartners] = useState([]);
  const [pid, setPid] = useState("");
  const [amount, setAmount] = useState("");
  const [shared, setShared] = useState(null);
  const loan = lead.loan && lead.loan.needed ? lead.loan : null;
  useEffect(() => { api.get("/admin/crm/partners").then(r => setPartners(r.data || [])).catch(() => {}); }, []);
  const refer = async () => {
    try { const { data } = await api.post(`/admin/leads/${lead.id}/loan/refer`, { partner_id: pid, amount_inr: Number(amount) }); setShared(data.share_text); reload(); toast.success("Referred"); } catch (e) { toast.error(err(e, "Could not refer")); }
  };
  const upd = async (body) => { try { await api.patch(`/admin/leads/${lead.id}/loan`, body); reload(); } catch (e) { toast.error(err(e, "Could not update")); } };
  const addPartner = async () => {
    const name = window.prompt("Bank or agent name:"); if (!name) return;
    const email = window.prompt("E-mail (optional):") || undefined; const pct = Number(window.prompt("Your commission % (e.g. 0.5):", "0.5")) || 0.5;
    try { await api.post("/admin/crm/partners", { name, email, commission_pct: pct }); const { data } = await api.get("/admin/crm/partners"); setPartners(data); } catch (e) { toast.error(err(e, "Could not add")); }
  };
  return (
    <div className="space-y-2 text-sm" data-testid="loan">
      {loan ? (
        <>
          <div><b>{loan.partner_name}</b> · {inrShort(loan.amount_inr)} · <span className="capitalize">{loan.status}</span> · commission {loan.commission_pct}%{loan.commission_inr ? ` = ${inrShort(loan.commission_inr)}${loan.commission_paid ? " (paid)" : " (due)"}` : ""}</div>
          <div className="flex flex-wrap gap-1.5">{["documents", "sanctioned", "disbursed", "rejected"].map(s => <button key={s} onClick={() => upd({ status: s, ...(s === "disbursed" ? { disbursed_inr: Number(window.prompt("Amount disbursed (₹)?", loan.sanctioned_inr || loan.amount_inr)) || undefined } : {}) })} className={`rounded-full border px-3 py-1 text-xs capitalize ${loan.status === s ? "bg-urbanex-navy text-urbanex-ivory" : ""}`}>{s}</button>)}</div>
          {loan.status === "disbursed" && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!loan.commission_paid} onChange={(e) => upd({ commission_paid: e.target.checked })}/> Commission received</label>}
        </>
      ) : (
        <>
          <div className="flex gap-2"><select className={inp} value={pid} onChange={(e) => setPid(e.target.value)}><option value="">Choose bank or agent</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name} ({p.commission_pct}%)</option>)}</select><button onClick={addPartner} className="rounded-lg border px-3 text-xs whitespace-nowrap">+ New</button></div>
          <div className="flex gap-2"><input type="number" className={inp} placeholder="Loan needed (₹)" value={amount} onChange={(e) => setAmount(e.target.value)}/><button onClick={refer} disabled={!pid || !amount} className="rounded-lg bg-urbanex-navy text-urbanex-ivory px-4 text-sm disabled:opacity-40">Refer</button></div>
        </>
      )}
      {shared && <div className="rounded-lg bg-urbanex-cream p-3 text-xs whitespace-pre-wrap">{shared}<div className="mt-2"><a target="_blank" rel="noopener noreferrer" href={waLink("", shared)} className="underline">Open WhatsApp to send it</a></div></div>}
    </div>
  );
}

// ---- who they are: language, role, birthday, owner
function Profile({ lead, onChange, team }) {
  const { user } = useAuth();
  const patch = async (body) => { try { const { data } = await api.patch(`/admin/leads/${lead.id}`, body); onChange(data); } catch (e) { toast.error(err(e, "Could not save")); } };
  const [mm, dd] = (lead.birthday || "").split("-");
  const translate = async (note) => {
    try { const { data } = await api.post("/admin/crm/translate", { text: note.text, to: "en" }); toast(data.text, { duration: 15000 }); } catch (e) { toast.error(err(e, "Could not translate")); }
  };
  const lastIn = [...(lead.notes || [])].reverse().find(n => n.inbound && n.text);
  return (
    <div className="grid grid-cols-2 gap-3 text-xs text-gray-600" data-testid="lead-profile">
      <label>Language<select className={`${inp} mt-1`} value={lead.language || ""} onChange={(e) => patch({ language: e.target.value || null })}><option value="">Unknown</option><option value="en">English</option><option value="bn">বাংলা</option><option value="hi">हिन्दी</option></select></label>
      <label>They are a…<select className={`${inp} mt-1`} value={lead.role || ""} onChange={(e) => patch({ role: e.target.value || null })}><option value="">Not sure</option><option value="buyer">Buyer</option><option value="seller">Seller</option><option value="renter">Renter</option><option value="landlord">Landlord</option><option value="other">Other</option></select></label>
      <label>Birthday<div className="flex gap-1 mt-1"><select className={inp} value={dd || ""} onChange={(e) => patch({ birthday: e.target.value && mm ? `${mm}-${e.target.value}` : e.target.value ? `01-${e.target.value}` : null })}><option value="">Day</option>{Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map(d => <option key={d}>{d}</option>)}</select>
        <select className={inp} value={mm || ""} onChange={(e) => patch({ birthday: e.target.value ? `${e.target.value}-${dd || "01"}` : null })}><option value="">Month</option>{["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map(m => <option key={m} value={m}>{new Date(2000, +m - 1, 1).toLocaleString("en", { month: "short" })}</option>)}</select></div></label>
      {user?.is_admin && <label>Looked after by<select className={`${inp} mt-1`} value={lead.owner_email || ""} onChange={(e) => patch({ owner_email: e.target.value || null })}><option value="">You</option>{team.map(m => <option key={m.email} value={m.email}>{m.name}</option>)}</select></label>}
      <label className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={!!lead.digest_opt_in} onChange={(e) => patch({ digest_opt_in: e.target.checked })}/> Send them the daily “new for you” message (only if they agreed)</label>
      <label className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={!!lead.spam} onChange={(e) => patch({ spam: e.target.checked })}/> This is spam{lead.spam_reasons?.length ? <span className="text-gray-400">({lead.spam_reasons.join(", ")})</span> : null}</label>
      {lastIn && lead.language && lead.language !== "en" && <button type="button" onClick={() => translate(lastIn)} className="col-span-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 w-fit"><Languages className="w-3.5 h-3.5"/> Show their last message in English</button>}
    </div>
  );
}

export default function LeadExtras({ lead, onChange }) {
  const { user } = useAuth();
  const [team, setTeam] = useState([]);
  useEffect(() => { if (user?.is_admin) api.get("/admin/crm/team").then(r => setTeam(r.data.members || [])).catch(() => {}); }, [user?.is_admin]);
  const reload = useCallback(async () => {
    const { data } = await api.get("/admin/leads", { params: { q: lead.phone || lead.name, tag: lead.spam ? "spam" : undefined } });
    const fresh = data.find(l => l.id === lead.id);
    if (fresh) onChange(fresh);
  }, [lead.id, lead.phone, lead.name, lead.spam, onChange]);
  const open = (lead.tasks || []).filter(t => !t.done).length;
  const staff = !user?.is_admin;
  return (
    <div data-testid="lead-extras">
      <Section icon={Phone} title="Before you call" testId="sec-brief"><Brief lead={lead}/></Section>
      <Section icon={Mic} title="Add a note by voice" testId="sec-voice"><VoiceNote lead={lead} onChange={onChange}/></Section>
      <Section icon={CheckSquare} title="To-dos and promises" badge={open || null} open={open > 0} testId="sec-tasks"><Tasks lead={lead} reload={reload}/></Section>
      <Section icon={Target} title={lead.role === "seller" || lead.role === "landlord" ? "Who might buy this" : "Listings that fit"} testId="sec-fit"><Fit lead={lead}/></Section>
      <Section icon={CalendarPlus} title="Let them book a visit" testId="sec-visit"><VisitLink lead={lead}/></Section>
      {!staff && <Section icon={ClipboardList} title="Documents for the deal" badge={(lead.deal_docs || []).filter(d => d.status === "pending").length || null} testId="sec-docs"><Checklist lead={lead} reload={reload}/></Section>}
      {!staff && <Section icon={Banknote} title="Home loan hand-off" badge={lead.loan?.needed ? lead.loan.status : null} testId="sec-loan"><Loan lead={lead} reload={reload}/></Section>}
      <Section icon={Languages} title="Profile and settings" testId="sec-profile"><Profile lead={lead} onChange={onChange} team={team}/></Section>
    </div>
  );
}
