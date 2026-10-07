import { useCallback, useEffect, useState } from "react";
import { Clock, Sun } from "lucide-react";
import { api } from "@/lib/api";
import LeadActions from "@/components/admin/crm/LeadActions";
import { TEMP } from "@/lib/crm";

const SLOT = { morning: "Best in the morning", afternoon: "Best in the afternoon", evening: "Best in the evening", any: "Any time" };

// The morning briefing and a ranked "who to call today" list with the best time to call each person.
export default function PlanPanel({ templates, me, onOpen, tick }) {
  const [brief, setBrief] = useState(null);
  const [plan, setPlan] = useState(null);
  const load = useCallback(() => {
    api.get("/admin/crm/plan", { params: { limit: 12 } }).then(r => setPlan(r.data)).catch(() => {});
    api.get("/admin/crm/briefing").then(r => setBrief(r.data)).catch(() => {});      // staff cannot see the briefing: that stays quiet
  }, []);
  useEffect(() => { load(); }, [load, tick]);
  if (!plan) return null;
  const order = [plan.now_slot, ...["morning", "afternoon", "evening", "any"].filter(s => s !== plan.now_slot)];
  const byId = Object.fromEntries(plan.items.map(i => [i.id, i]));
  return (
    <div className="space-y-5" data-testid="crm-plan">
      {brief && (
        <div className="rounded-2xl bg-urbanex-navy text-urbanex-ivory p-5">
          <div className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-urbanex-gold"><Sun className="w-4 h-4"/> {brief.date}</div>
          <p className="mt-2 font-display text-2xl leading-snug" data-testid="briefing-headline">{brief.headline}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {brief.overnight_leads > 0 && <span className="rounded-full bg-white/10 px-3 py-1">{brief.overnight_leads} new overnight</span>}
            {brief.visits.map((v, i) => <span key={i} className="rounded-full bg-white/10 px-3 py-1">{v.time}: {v.name}</span>)}
            {brief.documents_pending > 0 && <span className="rounded-full bg-white/10 px-3 py-1">{brief.documents_pending} deals waiting for papers</span>}
            {brief.failed_calls > 0 && <span className="rounded-full bg-red-500/30 px-3 py-1">{brief.failed_calls} call recordings failed</span>}
          </div>
        </div>
      )}
      {plan.items.length > 0 && (
        <div>
          <div className="flex items-baseline gap-3"><h2 className="font-display text-2xl text-urbanex-navy">Who to call today</h2><span className="text-xs text-gray-500">{plan.total} need you, here are the best {plan.items.length}</span></div>
          {order.map(slot => {
            const ids = plan.slots[slot];
            if (!ids?.length) return null;
            return (
              <div key={slot} className="mt-3">
                <div className={`text-[11px] tracking-[0.2em] uppercase mb-2 ${slot === plan.now_slot ? "text-urbanex-gold" : "text-gray-400"}`}>{SLOT[slot]}{slot === plan.now_slot ? " · now" : ""}</div>
                <div className="grid md:grid-cols-2 gap-3">
                  {ids.map(id => { const i = byId[id]; const t = TEMP[i.temperature] || TEMP.cold; return (
                    <div key={id} onClick={() => onOpen({ id })} className="rounded-xl border bg-white p-4 cursor-pointer hover:border-urbanex-gold/60" data-testid={`plan-${id}`}>
                      <div className="flex items-center gap-2"><span className="font-medium text-urbanex-navy">{i.name}</span><span className={`text-[10px] rounded-full px-2 py-0.5 ${t.cls}`}>{t.label} {i.score}</span>{i.action === "reply" && <span className="text-[10px] bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">reply</span>}</div>
                      <ul className="mt-1.5 space-y-0.5">{i.reasons.slice(0, 3).map((r, k) => <li key={k} className="text-xs text-gray-600">• {r}</li>)}</ul>
                      {i.tasks?.length > 0 && <div className="mt-1 text-xs text-gray-500">To do: {i.tasks.join("; ")}</div>}
                      <div className="mt-2 flex items-center gap-1 text-[11px] text-gray-400"><Clock className="w-3 h-3"/> {i.best_call.label}</div>
                      <div className="mt-2"><LeadActions lead={{ ...i, email: null }} templates={templates} me={me} onChange={() => load()}/></div>
                    </div>); })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
