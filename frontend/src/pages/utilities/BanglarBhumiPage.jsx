import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, MessageCircle } from "lucide-react";
import UtilityShell from "@/pages/utilities/UtilityShell";
import { waLink } from "@/lib/config";
import { useSeo } from "@/lib/seo";

const PORTAL = "https://banglarbhumi.gov.in/";
const KEY = "urbanex_plot_notes";
const BLANK = { district: "Purba Bardhaman", block: "", mouza: "", jl: "", plot: "", khatian: "", owner: "", land: "" };
const inp = "w-full border border-urbanex-navy/15 rounded-lg px-3 py-2.5 text-sm bg-white";
const STEPS = [
  "Open the official Banglar Bhumi website with the button above.",
  "Choose “Know Your Property” on the home page.",
  "Select the district, block and mouza of the plot.",
  "Enter the khatian number or the plot number, type the captcha, then press View.",
  "Read the owner name, land type and area, then note them down here to compare.",
];
const CHECKS = [
  "The owner on the record is the person selling to you (names and spellings can differ, ask why).",
  "Land type: bastu (homestead), shali (farm land), danga, pukur. Farm land needs conversion before building.",
  "The area on the record matches the area being sold.",
  "Mutation is done in the seller's name, and the latest tax (khajna) receipts are paid.",
  "Check the older RS/LR records for the chain of ownership, and ask for the deed of the last purchase.",
];

export default function BanglarBhumiPage() {
  useSeo({ title: "Banglar Bhumi land record search", description: "How to check khatian and plot details on Banglar Bhumi, with a notepad for the plot you are checking." });
  const [f, setF] = useState(() => { try { return { ...BLANK, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return BLANK; } });
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(f)); } catch { /* storage blocked */ } }, [f]);
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.value }));
  const text = () => ["Land record check", `District: ${f.district}`, f.block && `Block: ${f.block}`, f.mouza && `Mouza: ${f.mouza}`, f.jl && `JL no: ${f.jl}`, f.plot && `Plot no: ${f.plot}`,
    f.khatian && `Khatian no: ${f.khatian}`, f.owner && `Owner on record: ${f.owner}`, f.land && `Land type: ${f.land}`].filter(Boolean).join("\n");

  return (
    <UtilityShell title="Banglar Bhumi: check land records" intro="Banglar Bhumi is the West Bengal government's land record website. Check the khatian and plot of any land before you pay a rupee.">
      <div className="rounded-2xl bg-urbanex-navy text-urbanex-ivory p-6 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[240px]">
          <div className="font-display text-2xl">Official portal</div>
          <p className="text-sm text-urbanex-ivory/70 mt-1">The search happens on the government site (it has its own captcha). This page helps you do it right and keep your notes.</p>
        </div>
        <a href={PORTAL} target="_blank" rel="noopener noreferrer" data-testid="bhumi-open" className="inline-flex items-center gap-2 bg-urbanex-gold text-urbanex-navy rounded-full px-6 py-3 text-sm font-medium"><ExternalLink className="w-4 h-4"/> Open Banglar Bhumi</a>
      </div>

      <div className="mt-8 grid md:grid-cols-2 gap-8">
        <div>
          <h2 className="font-display text-2xl text-urbanex-navy">How to search</h2>
          <ol className="mt-3 space-y-2 text-sm text-urbanex-navy/75 list-decimal pl-5">{STEPS.map(s => <li key={s}>{s}</li>)}</ol>
          <h2 className="font-display text-2xl text-urbanex-navy mt-8">What to check</h2>
          <ul className="mt-3 space-y-2 text-sm text-urbanex-navy/75 list-disc pl-5">{CHECKS.map(s => <li key={s}>{s}</li>)}</ul>
        </div>
        <div className="rounded-2xl bg-white border border-urbanex-navy/5 p-5" data-testid="plot-notes">
          <h2 className="font-display text-2xl text-urbanex-navy">Plot notepad</h2>
          <p className="text-xs text-urbanex-navy/50">Saved only in this browser.</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-urbanex-navy/60">
            <label className="col-span-2">District<select className={`${inp} mt-1`} value={f.district} onChange={set("district")}><option>Purba Bardhaman</option><option>Paschim Bardhaman</option><option>Hooghly</option><option>Birbhum</option><option>Bankura</option><option>Nadia</option><option>Other</option></select></label>
            <label>Block<input className={`${inp} mt-1`} value={f.block} onChange={set("block")}/></label>
            <label>Mouza<input className={`${inp} mt-1`} value={f.mouza} onChange={set("mouza")}/></label>
            <label>JL no<input className={`${inp} mt-1`} value={f.jl} onChange={set("jl")}/></label>
            <label>Plot no<input className={`${inp} mt-1`} value={f.plot} onChange={set("plot")}/></label>
            <label>Khatian no<input className={`${inp} mt-1`} value={f.khatian} onChange={set("khatian")}/></label>
            <label>Land type on record<input className={`${inp} mt-1`} value={f.land} onChange={set("land")} placeholder="bastu / shali / danga"/></label>
            <label className="col-span-2">Owner name on record<input className={`${inp} mt-1`} value={f.owner} onChange={set("owner")}/></label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => navigator.clipboard?.writeText(text()).then(() => toast.success("Copied")).catch(() => {})} className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm"><Copy className="w-4 h-4"/> Copy</button>
            <a href={waLink(`${text()}\n\nCan you help me check this land record?`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] text-white px-4 py-2 text-sm"><MessageCircle className="w-4 h-4"/> Ask Urbanex to check</a>
            <button onClick={() => setF(BLANK)} className="text-sm text-urbanex-navy/50 px-2">Clear</button>
          </div>
        </div>
      </div>
      <p className="mt-8 text-xs text-urbanex-navy/45">Urbanex Realty is not connected to the government portal. Records online can lag behind the ground reality, so always also check the deed and the physical possession, and take legal advice before buying.</p>
    </UtilityShell>
  );
}
