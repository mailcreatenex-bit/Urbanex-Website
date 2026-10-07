import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, MessageCircle, Share2 } from "lucide-react";
import { api } from "@/lib/api";
import { waLink } from "@/lib/config";
import { useSeo } from "@/lib/seo";
import { Ring } from "@/pages/VastuCompassPage";

const TONE = { ideal: "bg-emerald-400/90 text-emerald-950", good: "bg-emerald-300/90 text-emerald-950", ok: "bg-amber-300/90 text-amber-950", poor: "bg-orange-400/90 text-orange-950", wrong: "bg-red-500 text-white" };

// A saved Vastu report that can be opened from a WhatsApp message and forwarded to family. It shows no phone number or surname.
export default function VastuReportPage() {
  const { token } = useParams();
  useSeo({ title: "Your Vastu report" });
  const [d, setD] = useState(null);
  const [gone, setGone] = useState(false);
  useEffect(() => { api.get(`/vastu/report/${token}`).then(r => setD(r.data)).catch(() => setGone(true)); }, [token]);
  if (gone) return <div className="sec-dark min-h-screen grid place-items-center text-center px-6"><div><h1 className="font-display text-4xl">This report was not found.</h1><Link to="/vastu" className="mt-4 inline-block text-urbanex-gold underline">Check a plan on the Vastu Compass</Link></div></div>;
  if (!d) return <div className="sec-dark min-h-screen grid place-items-center text-urbanex-ivory/60">Loading…</div>;
  const r = d.result;
  const link = typeof window !== "undefined" ? window.location.href : "";
  return (
    <div className="sec-dark min-h-screen" data-testid="vastu-report">
      <div className="aurora"/>
      <div className="max-w-3xl mx-auto px-5 md:px-8 pt-32 pb-24">
        <div className="chapter" data-n="∞">Vastu report for {d.name}</div>
        <div className="mt-6 flex flex-wrap items-center gap-6">
          <Ring score={r.score}/>
          <div><h1 className="font-display text-5xl leading-none">{r.grade}</h1><p className="mt-2 text-urbanex-ivory/60">{r.checked} placements checked{d.facing ? `, plot faces ${d.facing}` : ""}</p></div>
        </div>
        {r.facing_note && <p className="mt-6 border-l-2 border-urbanex-gold/60 pl-3 text-urbanex-ivory/75">{r.facing_note}</p>}
        {r.must_fix.length > 0 && <div className="mt-8"><div className="text-[11px] tracking-[0.2em] uppercase text-red-300 mb-2">Fix these first</div>
          <ul className="space-y-2.5">{r.must_fix.map((i, k) => <li key={k} className="rounded-xl bg-red-500/10 border border-red-400/25 p-3"><div className="font-medium">{i.label} in the {i.direction_name}</div><div className="text-sm text-urbanex-ivory/70 mt-0.5">{i.fix}</div></li>)}</ul></div>}
        <ul className="mt-8 divide-y divide-white/10 glass-dark rounded-2xl px-4">{r.items.map((i, k) => <li key={k} className="py-2.5 flex items-center gap-3 text-sm"><span className={`rounded-full px-2 py-0.5 text-[10px] ${TONE[i.verdict]}`}>{i.word}</span>{i.label}, {i.direction_name}</li>)}</ul>
        <p className="mt-4 text-[11px] text-urbanex-ivory/40">{r.note}</p>
        <div className="mt-10 rounded-3xl bg-urbanex-gold text-urbanex-navy p-6 md:p-8">
          <h2 className="font-display text-3xl leading-tight">Want it drawn right from the start?</h2>
          <p className="mt-2 text-sm text-urbanex-navy/75">We design and build Vastu-first, and we say so plainly when a plan breaks it.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={waLink(`Hello Ayan, I saw my Vastu report (score ${r.score}/100): ${link} I would like a Vastu-first design.`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-urbanex-navy text-urbanex-ivory px-5 py-3 text-sm"><MessageCircle className="w-4 h-4"/> Talk to Ayan</a>
            <a href={`https://wa.me/?text=${encodeURIComponent(`My Vastu report from Urbanex Realty: ${r.score}/100. ${link}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-urbanex-navy/40 px-5 py-3 text-sm"><Share2 className="w-4 h-4"/> Share with family</a>
            <Link to="/vastu" className="inline-flex items-center gap-2 rounded-full border border-urbanex-navy/40 px-5 py-3 text-sm">Check another plan <ArrowRight className="w-4 h-4"/></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
