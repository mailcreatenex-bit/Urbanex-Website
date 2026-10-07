import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { inrShort } from "@/lib/crm";
import { useSeo } from "@/lib/seo";

// A read-only weekly report to share with partners: numbers only, no names or phone numbers.
export default function WeeklyReportPage() {
  const { token } = useParams();
  useSeo({ title: "Urbanex weekly report" });
  const [r, setR] = useState(null);
  const [gone, setGone] = useState(false);
  useEffect(() => { api.get(`/report/${token}`).then(x => setR(x.data)).catch(() => setGone(true)); }, [token]);
  if (gone) return <div className="max-w-xl mx-auto px-6 py-24 text-center text-urbanex-navy/70">This report link has expired.</div>;
  if (!r) return <div className="max-w-xl mx-auto px-6 py-24 text-center text-urbanex-navy/50">Loading…</div>;
  const d = r.data;
  const mx = Math.max(1, ...d.per_day.map(x => x.count));
  const smx = Math.max(1, ...d.by_source.map(x => x.count));
  const reply = d.avg_first_reply_minutes == null ? "—" : d.avg_first_reply_minutes < 90 ? `${d.avg_first_reply_minutes} min` : `${(d.avg_first_reply_minutes / 60).toFixed(1)} h`;
  return (
    <div className="max-w-3xl mx-auto px-6 py-14" data-testid="weekly-report">
      <div className="text-xs tracking-[0.28em] uppercase text-urbanex-gold">Urbanex Realty</div>
      <h1 className="font-display text-4xl text-urbanex-navy mt-1">Weekly report</h1>
      <div className="text-urbanex-navy/60">{d.from} to {d.to}</div>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["New leads", d.leads, `${d.leads - d.leads_before >= 0 ? "+" : ""}${d.leads - d.leads_before} on last week`], ["Hot leads", d.hot], ["Deals closed", d.closed, d.deal_value_inr ? inrShort(d.deal_value_inr) : null], ["First reply", reply]].map(([k, v, sub]) => (
          <div key={k} className="rounded-2xl bg-white border p-4"><div className="font-display text-3xl text-urbanex-navy">{v}</div><div className="text-xs text-urbanex-navy/60">{k}</div>{sub && <div className="text-[11px] text-urbanex-navy/40 mt-1">{sub}</div>}</div>))}
      </div>
      <div className="mt-8 rounded-2xl bg-white border p-5"><div className="text-xs tracking-[0.2em] uppercase text-urbanex-gold mb-3">New leads each day</div>
        <div className="flex items-end gap-2 h-32">{d.per_day.map(x => <div key={x.date} className="flex-1 flex flex-col items-center justify-end"><div className="text-xs">{x.count || ""}</div><div className="w-full rounded-t bg-urbanex-gold" style={{ height: `${(x.count / mx) * 100}%`, minHeight: x.count ? 4 : 1 }}/><div className="text-[10px] text-urbanex-navy/40">{x.date.slice(8)}</div></div>)}</div></div>
      <div className="mt-4 rounded-2xl bg-white border p-5"><div className="text-xs tracking-[0.2em] uppercase text-urbanex-gold mb-3">Where leads came from</div>
        {d.by_source.map(s => <div key={s.source} className="flex items-center gap-3 text-sm mb-1.5"><div className="w-28 truncate">{s.source.replace("_", " ")}</div><div className="flex-1 h-4 rounded bg-gray-100 overflow-hidden"><div className="h-full bg-urbanex-navy/70" style={{ width: `${(s.count / smx) * 100}%` }}/></div><div className="w-8 text-right">{s.count}</div></div>)}</div>
      <p className="mt-4 text-xs text-urbanex-navy/50">{d.visits} visits booked · {d.calls_analysed} calls reviewed{d.avg_call_score != null ? ` (average score ${d.avg_call_score})` : ""} · {d.messages_sent} messages sent · {d.spam_blocked} spam enquiries blocked</p>
    </div>
  );
}
