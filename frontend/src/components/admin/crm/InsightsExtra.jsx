import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, MapPin, MessageCircleQuestion, Send, Sparkles, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { inrShort } from "@/lib/crm";

const Card = ({ title, icon: Icon, children, className = "" }) => <div className={`rounded-2xl border bg-white p-5 ${className}`}><div className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-urbanex-gold mb-3"><Icon className="w-4 h-4"/>{title}</div>{children}</div>;
const err = (e, f) => { const d = e?.response?.data?.detail; return typeof d === "string" ? d : f; };

function Ask() {
  const [q, setQ] = useState("");
  const [a, setA] = useState(null);
  const [busy, setBusy] = useState(false);
  const go = async () => { if (q.trim().length < 3) return; setBusy(true); setA(null); try { const { data } = await api.post("/admin/crm/ask", { question: q }); setA(data.answer); } catch (e) { toast.error(err(e, "Could not answer")); } finally { setBusy(false); } };
  return (
    <Card title="Ask your CRM anything" icon={MessageCircleQuestion} className="lg:col-span-2">
      <div className="flex gap-2"><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} data-testid="ask-input" placeholder="e.g. How many leads did 99acres give me last month, and how many closed?" className="flex-1 border rounded-lg px-3 py-2 text-sm"/>
        <button onClick={go} disabled={busy} data-testid="ask-go" className="inline-flex items-center gap-1.5 rounded-lg bg-urbanex-navy text-urbanex-ivory px-4 text-sm disabled:opacity-50"><Sparkles className="w-4 h-4"/>{busy ? "Thinking…" : "Ask"}</button></div>
      {a && <p className="mt-3 text-sm text-urbanex-navy/85 whitespace-pre-wrap" data-testid="ask-answer">{a}</p>}
    </Card>
  );
}

function Forecast() {
  const [f, setF] = useState(null);
  useEffect(() => { api.get("/admin/crm/forecast").then(r => setF(r.data)).catch(() => {}); }, []);
  if (!f) return null;
  return (
    <Card title="What you can expect to earn" icon={TrendingUp}>
      <div className="font-display text-4xl" data-testid="forecast">{inrShort(f.expected_inr)}</div>
      <div className="text-xs text-gray-500">likely, between {inrShort(f.low_inr)} and {inrShort(f.high_inr)}, from deals in progress at {f.commission_pct}% commission</div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-gray-50 p-2"><div className="font-medium">{inrShort(f.earned_this_month_inr)}</div><div className="text-[11px] text-gray-500">earned this month</div></div><div className="rounded-lg bg-gray-50 p-2"><div className="font-medium">{inrShort(f.loan_commission_inr)}</div><div className="text-[11px] text-gray-500">from loans so far</div></div></div>
      <div className="mt-3 text-[11px] text-gray-500">Chance of closing: {Object.entries(f.chances).map(([k, v]) => `${k.replace("_", " ")} ${Math.round(v * 100)}%`).join(" · ")}</div>
      <div className="text-[11px] text-gray-400">{f.note}</div>
    </Card>
  );
}

function Anomalies() {
  const [a, setA] = useState([]);
  useEffect(() => { api.get("/admin/crm/anomalies").then(r => setA(r.data)).catch(() => {}); }, []);
  return (
    <Card title="Worth a look" icon={AlertTriangle}>
      {a.length ? <ul className="space-y-2">{a.map(x => <li key={x.key} className="text-sm"><b>{x.title}</b><div className="text-xs text-gray-600">{x.detail}</div></li>)}</ul> : <div className="text-sm text-gray-500">Nothing looks wrong. You will be told if lead numbers drop, a source goes quiet or leads get stuck.</div>}
    </Card>
  );
}

function Roi() {
  const [d, setD] = useState(null);
  const load = useCallback(() => api.get("/admin/crm/roi", { params: { months: 3 } }).then(r => setD(r.data)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const addSpend = async () => {
    const source = window.prompt("Which source? (e.g. 99acres, facebook)"); if (!source) return;
    const amount = Number(window.prompt("How much did you spend on it this month (₹)?", "0")); if (Number.isNaN(amount)) return;
    const month = new Date().toISOString().slice(0, 7);
    try { await api.put("/admin/crm/spend", { month, source, amount_inr: amount }); load(); toast.success("Saved"); } catch (e) { toast.error(err(e, "Could not save")); }
  };
  if (!d) return null;
  return (
    <Card title="What each source costs and earns (last 3 months)" icon={TrendingUp} className="lg:col-span-2">
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs text-gray-500"><tr><th className="py-1">Source</th><th>Leads</th><th>Closed</th><th>Spent</th><th>Per lead</th><th>Per deal</th><th>Your commission</th><th>Return</th></tr></thead>
        <tbody>{d.items.map(r => <tr key={r.source} className="border-t"><td className="py-2 font-medium">{r.source.replace("_", " ")}</td><td>{r.leads}</td><td>{r.closed}</td><td>{r.spend_inr ? inrShort(r.spend_inr) : "—"}</td><td>{r.cost_per_lead ? inrShort(r.cost_per_lead) : "—"}</td><td>{r.cost_per_deal ? inrShort(r.cost_per_deal) : "—"}</td><td>{r.revenue_inr ? inrShort(r.revenue_inr) : "—"}</td><td className={r.roi_pct == null ? "" : r.roi_pct >= 0 ? "text-emerald-600" : "text-red-600"}>{r.roi_pct == null ? "—" : `${r.roi_pct}%`}</td></tr>)}</tbody></table></div>
      <button onClick={addSpend} className="mt-3 text-xs rounded-full border px-3 py-1.5 hover:border-urbanex-gold">+ Add what you spent on a source this month</button>
    </Card>
  );
}

function Demand() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/admin/crm/demand").then(r => setD(r.data)).catch(() => {}); }, []);
  if (!d) return null;
  const max = Math.max(1, ...d.zones.map(z => z.leads));
  return (
    <Card title="Where people want to buy" icon={MapPin} className="lg:col-span-2">
      {d.zones.length ? (
        <div className="space-y-1.5" data-testid="demand">{d.zones.slice(0, 12).map(z => (
          <div key={z.zone} className="flex items-center gap-3 text-sm"><div className="w-32 truncate">{z.zone}</div>
            <div className="flex-1 h-5 rounded bg-gray-100 overflow-hidden relative"><div className="h-full bg-urbanex-gold/70" style={{ width: `${(z.leads / max) * 100}%` }}/>{z.hot > 0 && <div className="absolute inset-y-0 left-0 bg-red-400/60" style={{ width: `${(z.hot / max) * 100}%` }}/>}</div>
            <div className="w-56 text-xs text-gray-600">{z.leads} wanting · {z.listings} listing{z.listings === 1 ? "" : "s"}{z.median_budget ? ` · about ${inrShort(z.median_budget)}` : ""}{z.top_type ? ` · ${z.top_type}` : ""}</div>
            {z.gap > 0 && <span className="text-[10px] bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">find more here</span>}</div>))}</div>
      ) : <div className="text-sm text-gray-500">When leads say where they want to buy, the busiest places show here, so you know where to look for plots and flats.</div>}
    </Card>
  );
}

function Weekly() {
  const [d, setD] = useState(null);
  const [off, setOff] = useState(0);
  useEffect(() => { api.get("/admin/crm/weekly", { params: { offset: off } }).then(r => setD(r.data)).catch(() => {}); }, [off]);
  const send = async () => { try { const { data } = await api.post("/admin/crm/weekly/send"); toast.success("Sent. Share this link with your partners."); await navigator.clipboard?.writeText(data.link).catch(() => {}); } catch (e) { toast.error(err(e, "Could not make the link")); } };
  if (!d) return null;
  const mx = Math.max(1, ...d.per_day.map(x => x.count));
  const reply = d.avg_first_reply_minutes == null ? "—" : d.avg_first_reply_minutes < 90 ? `${d.avg_first_reply_minutes} min` : `${(d.avg_first_reply_minutes / 60).toFixed(1)} h`;
  return (
    <Card title="The week" icon={CalendarDays} className="lg:col-span-2">
      <div className="flex items-center gap-2 text-sm"><button onClick={() => setOff(o => o + 1)} className="rounded-full border px-2.5">‹</button><span>{d.from} to {d.to}</span><button onClick={() => setOff(o => Math.max(0, o - 1))} className="rounded-full border px-2.5">›</button>
        <button onClick={send} className="ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs hover:border-urbanex-gold"><Send className="w-3.5 h-3.5"/> E-mail it and copy a share link</button></div>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
        {[["New leads", `${d.leads} (${d.leads - d.leads_before >= 0 ? "+" : ""}${d.leads - d.leads_before})`], ["Hot", d.hot], ["Closed", d.closed], ["First reply", reply], ["Visits", d.visits]].map(([k, v]) => <div key={k} className="rounded-lg bg-gray-50 p-2"><div className="font-display text-xl">{v}</div><div className="text-[11px] text-gray-500">{k}</div></div>)}
      </div>
      <div className="mt-3 flex items-end gap-2 h-20">{d.per_day.map(x => <div key={x.date} className="flex-1 flex flex-col items-center justify-end" title={`${x.date}: ${x.count}`}><div className="text-[10px] text-gray-500">{x.count || ""}</div><div className="w-full rounded-t bg-urbanex-gold/70" style={{ height: `${(x.count / mx) * 100}%`, minHeight: x.count ? 4 : 1 }}/><div className="text-[9px] text-gray-400">{x.date.slice(8)}</div></div>)}</div>
      <div className="mt-2 text-xs text-gray-500">{d.calls_analysed} calls listened to{d.avg_call_score != null ? `, average call score ${d.avg_call_score}` : ""} · {d.messages_sent} messages sent · {d.spam_blocked} spam blocked{d.commission_inr ? ` · commission ${inrShort(d.commission_inr)}` : ""}</div>
    </Card>
  );
}

export default function InsightsExtra() {
  return (
    <div className="mt-4 grid lg:grid-cols-2 gap-4" data-testid="insights-extra">
      <Ask/>
      <Forecast/>
      <Anomalies/>
      <Roi/>
      <Weekly/>
      <Demand/>
    </div>
  );
}
