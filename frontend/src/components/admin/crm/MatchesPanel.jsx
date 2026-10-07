import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Phone, Target } from "lucide-react";
import { api } from "@/lib/api";
import { inrShort, telLink, waLink, ago } from "@/lib/crm";

// "Customers who may want this": appears after a listing or a YouTube video gets a price.
export default function MatchesPanel({ initial, onOpenLead }) {
  const [recent, setRecent] = useState([]);
  const [sel, setSel] = useState(initial || null);        // "property:<id>" | "video:<id>"
  const [data, setData] = useState(null);

  useEffect(() => { api.get("/admin/crm/matches").then(r => setRecent(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    if (!sel) { setData(null); return; }
    const [kind, ...rest] = sel.split(":");
    setData(null);
    api.get(`/admin/crm/matches/${kind}/${rest.join(":")}`).then(r => setData(r.data)).catch(() => toast.error("Could not load the shortlist"));
  }, [sel]);

  const log = useCallback(async (lead, text, type) => { await api.post(`/admin/leads/${lead.id}/activity`, { type, text }).catch(() => {}); }, []);
  const msg = (lead, item) => `Hi ${(lead.name || "").split(" ")[0] || "there"}, a new ${item.bedrooms ? item.bedrooms + "BHK " : ""}${item.property_type || "property"}${item.zone ? " in " + item.zone : ""} just came up (${item.title}). It looks like what you were looking for. Shall I send you the details and video?`;

  return (
    <div className="mt-4 grid lg:grid-cols-[320px_1fr] gap-5" data-testid="crm-matches">
      <div className="space-y-2">
        <div className="text-xs tracking-[0.2em] uppercase text-urbanex-gold">Recently priced listings</div>
        {recent.map(r => (
          <button key={`${r.kind}${r.item_id}`} onClick={() => setSel(`${r.kind}:${r.item_id}`)} className={`w-full text-left rounded-xl border bg-white p-3 hover:border-urbanex-gold ${sel === `${r.kind}:${r.item_id}` ? "border-urbanex-gold" : ""}`}>
            <div className="text-sm font-medium line-clamp-2">{r.title}</div>
            <div className="text-xs text-gray-500 mt-1">{r.kind === "video" ? "YouTube video" : "Listing"} · {inrShort(r.price_inr)} · <b className="text-urbanex-navy">{r.count}</b> customers · {ago(r.at)}</div>
          </button>
        ))}
        {!recent.length && <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">When you set a price on a listing or a YouTube video (Admin → Properties or Videos), the customers who may want it show up here.</div>}
      </div>
      <div>
        {!sel && <div className="rounded-2xl border bg-white p-12 text-center text-gray-400"><Target className="w-8 h-8 mx-auto mb-2"/>Pick a listing to see who may want it.</div>}
        {sel && !data && <div className="p-10 text-center text-gray-400">Loading…</div>}
        {data && (
          <div className="space-y-3">
            <div className="rounded-xl bg-urbanex-navy text-urbanex-ivory p-4"><div className="font-medium">{data.item.title}</div><div className="text-sm text-urbanex-ivory/70">{[data.item.zone, data.item.property_type, data.item.bedrooms != null ? `${data.item.bedrooms} BHK` : null, data.item.price_inr ? inrShort(data.item.price_inr) : null].filter(Boolean).join(" · ")}</div></div>
            {data.note && <div className="rounded-xl bg-amber-50 text-amber-800 p-4 text-sm">{data.note}</div>}
            {data.matches.map(l => (
              <div key={l.id} className="rounded-xl border bg-white p-4 flex flex-wrap items-center gap-3" data-testid={`match-${l.id}`}>
                <div className="flex-1 min-w-[220px]">
                  <button onClick={() => onOpenLead(l.id)} className="font-medium text-left hover:text-urbanex-gold">{l.name}</button>
                  <span className="ml-2 text-[10px] rounded-full bg-urbanex-gold/20 px-2 py-0.5">fit {l.match_score}</span>
                  <div className="text-xs text-gray-600 mt-0.5">{l.match_reasons.join(" · ")}</div>
                  <div className="text-xs text-gray-400">{l.property_interest || ""}{l.budget_inr ? ` · budget ${inrShort(l.budget_inr)}` : ""}</div>
                </div>
                {l.phone && <div className="flex gap-2 text-xs">
                  <a href={telLink(l.phone)} onClick={() => log(l, `Called about ${data.item.title}`, "call")} className="inline-flex items-center gap-1 rounded-full bg-urbanex-navy text-urbanex-ivory px-3 py-1.5"><Phone className="w-3 h-3"/> Call</a>
                  <a href={waLink(l.phone, msg(l, data.item))} target="_blank" rel="noopener noreferrer" onClick={() => log(l, `Suggested ${data.item.title} on WhatsApp`, "whatsapp")} className="inline-flex items-center gap-1 rounded-full bg-[#25D366] text-white px-3 py-1.5"><MessageCircle className="w-3 h-3"/> WhatsApp</a>
                </div>}
              </div>
            ))}
            {!data.matches.length && !data.note && <div className="rounded-xl border bg-white p-8 text-center text-gray-500">No customers in your CRM fit this listing yet. Add budgets and what people want to your leads and they will appear here.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
