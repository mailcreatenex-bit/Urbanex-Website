import { useState } from "react";
import { Clock } from "lucide-react";
import LeadActions from "@/components/admin/crm/LeadActions";
import { STAGES, TEMP, ago, dueLabel, inrShort } from "@/lib/crm";

const toneCls = { bad: "bg-red-100 text-red-700", warn: "bg-amber-100 text-amber-700", ok: "bg-gray-100 text-gray-600" };

export function LeadCard({ lead, onOpen, templates, me, onChange, draggable = false, selected, onSelect }) {
  const t = TEMP[lead.temperature] || TEMP.cold;
  const due = dueLabel(lead.next_follow_up);
  return (
    <div draggable={draggable} onDragStart={(e) => e.dataTransfer.setData("text/lead", lead.id)} onClick={() => onOpen(lead)}
      data-testid={`crm-card-${lead.id}`}
      className={`rounded-xl border bg-white p-3 text-left shadow-sm hover:shadow-md hover:border-urbanex-gold/50 transition cursor-pointer ${draggable ? "active:opacity-60" : ""}`}>
      <div className="flex items-start gap-2">
        {onSelect && <input type="checkbox" checked={!!selected} onClick={(e) => e.stopPropagation()} onChange={() => onSelect(lead.id)} className="mt-1 accent-[#C5A059]" aria-label={`Select ${lead.name}`}/>}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="font-medium text-urbanex-navy truncate">{lead.name}</div>
            <span className={`ml-auto shrink-0 text-[10px] rounded-full px-2 py-0.5 ${t.cls}`} title={(lead.reasons || []).join(" · ")}>{t.label} {lead.score}</span>
          </div>
          <div className="text-xs text-urbanex-navy/60 truncate">{lead.property_interest || lead.message || "No interest noted"}</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="rounded-full bg-gray-100 px-2 py-0.5">{(lead.source_page || "").replace("_", " ")}</span>
        {due && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${toneCls[due.tone]}`}><Clock className="w-3 h-3"/>{due.text}</span>}
        {lead.budget_inr ? <span className="rounded-full bg-gray-100 px-2 py-0.5">{inrShort(lead.budget_inr)}</span> : null}
        {lead.status === "new" && !lead.first_contacted_at && <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5">waiting {ago(lead.created_at).replace(" ago", "")}</span>}
        {lead.flags?.length > 0 && <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5" title={lead.flags.join(", ")}>flagged</span>}
      </div>
      <div className="mt-3"><LeadActions lead={lead} templates={templates} me={me} onChange={onChange}/></div>
    </div>
  );
}

export default function Board({ leads, onMove, ...rest }) {
  const [over, setOver] = useState(null);
  return (
    <div className="mt-4 grid gap-3 overflow-x-auto pb-4" style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(250px, 1fr))` }} data-testid="crm-board">
      {STAGES.map(s => {
        const col = leads.filter(l => l.status === s.v);
        const total = col.reduce((a, l) => a + (l.deal_value_inr || l.budget_inr || 0), 0);
        return (
          <div key={s.v} onDragOver={(e) => { e.preventDefault(); setOver(s.v); }} onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/lead"); if (id) onMove(id, s.v); }}
            data-testid={`crm-col-${s.v}`}
            className={`rounded-2xl p-2 transition-colors ${over === s.v ? "bg-urbanex-gold/15" : "bg-urbanex-navy/[0.03]"}`}>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }}/>
              <span className="text-sm font-medium text-urbanex-navy">{s.label}</span>
              <span className="text-xs text-urbanex-navy/50">{col.length}</span>
              {total > 0 && <span className="ml-auto text-[10px] text-urbanex-navy/45">{inrShort(total)}</span>}
            </div>
            <div className="space-y-2 max-h-[68vh] overflow-y-auto pr-0.5">
              {col.map(l => <LeadCard key={l.id} lead={l} draggable {...rest}/>)}
              {!col.length && <div className="text-xs text-center text-urbanex-navy/30 py-6">Drop a lead here</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
