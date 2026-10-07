import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Copy, MessageCircle, Search, ShieldCheck } from "lucide-react";
import LandShell from "@/pages/utilities/LandShell";
import AppGateModal from "@/components/common/AppGateModal";
import { inAppShell } from "@/lib/appShell";
import { waLink } from "@/lib/config";
import { useSeo } from "@/lib/seo";

const PORTAL = "https://banglarbhumi.gov.in/";
const KEY = "urbanex_plot_notes";
const BLANK = { district: "Purba Bardhaman", block: "", mouza: "", jl: "", plot: "", khatian: "", owner: "", land: "" };
const inp = "w-full border border-urbanex-navy/15 rounded-lg px-3 py-2.5 text-sm bg-white";
const CHECKS = [
  "The owner on the record is the person selling to you.",
  "Land type: bastu (homestead), shali (farm land), danga, pukur. Farm land needs conversion before building.",
  "The area on the record matches the area being sold.",
  "Mutation is in the seller's name and the latest khajna (tax) receipts are paid.",
  "Check the older RS/LR records for the chain of ownership, and ask for the last deed.",
];

export default function BanglarBhumiPage() {
  useSeo({ title: "Search West Bengal land records", description: "Search khatian and plot (dag) records of West Bengal in the Urbanex app, and keep notes on the plot you are checking." });
  const [f, setF] = useState(() => { try { return { ...BLANK, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return BLANK; } });
  const [gate, setGate] = useState(false);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(f)); } catch { /* storage blocked */ } }, [f]);
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.value }));
  const text = () => ["Land record check", `District: ${f.district}`, f.block && `Block: ${f.block}`, f.mouza && `Mouza: ${f.mouza}`, f.jl && `JL no: ${f.jl}`, f.plot && `Plot no: ${f.plot}`,
    f.khatian && `Khatian no: ${f.khatian}`, f.owner && `Owner on record: ${f.owner}`, f.land && `Land type: ${f.land}`].filter(Boolean).join("\n");

  const search = (e) => {
    e.preventDefault();
    if (!f.mouza.trim() || !(f.plot.trim() || f.khatian.trim())) return toast.error("Enter the mouza and either the plot (dag) or khatian number");
    if (!inAppShell()) { setGate(true); return; }
    // Inside the app: keep the details on the clipboard and open the official page; you sign in there yourself.
    navigator.clipboard?.writeText(text()).catch(() => {});
    toast.success("Details copied. Opening Banglar Bhumi…");
    window.open(PORTAL, "_blank", "noopener");
  };

  return (
    <LandShell title="Search land records" intro="Look up a khatian or plot (dag) of West Bengal from the official Banglar Bhumi records, and keep your notes on the plot together.">
      <div className="grid lg:grid-cols-2 gap-8">
        <form onSubmit={search} className="rounded-2xl bg-white border border-urbanex-navy/5 p-6" data-testid="record-search">
          <div className="grid grid-cols-2 gap-3 text-xs text-urbanex-navy/60">
            <label className="col-span-2">District<select className={`${inp} mt-1`} value={f.district} onChange={set("district")}><option>Purba Bardhaman</option><option>Paschim Bardhaman</option><option>Hooghly</option><option>Birbhum</option><option>Bankura</option><option>Nadia</option><option>Other</option></select></label>
            <label>Block<input className={`${inp} mt-1`} value={f.block} onChange={set("block")}/></label>
            <label>Mouza<input className={`${inp} mt-1`} value={f.mouza} onChange={set("mouza")} data-testid="rec-mouza"/></label>
            <label>JL no<input className={`${inp} mt-1`} value={f.jl} onChange={set("jl")}/></label>
            <label>Plot (dag) no<input className={`${inp} mt-1`} value={f.plot} onChange={set("plot")} data-testid="rec-plot"/></label>
            <label className="col-span-2">Khatian no<input className={`${inp} mt-1`} value={f.khatian} onChange={set("khatian")}/></label>
          </div>
          <button data-testid="rec-search" className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-urbanex-navy text-urbanex-ivory rounded-full py-3 text-sm"><Search className="w-4 h-4"/> Search land record</button>
          <p className="mt-3 flex items-start gap-2 text-[11px] text-urbanex-navy/50"><ShieldCheck className="w-4 h-4 shrink-0 text-urbanex-gold"/> The search runs on the official Banglar Bhumi site, which asks you to sign in with your own mobile number. Urbanex never sees your password or OTP.</p>
        </form>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white border border-urbanex-navy/5 p-6" data-testid="plot-notes">
            <h2 className="font-display text-2xl text-urbanex-navy">What the record says</h2>
            <p className="text-xs text-urbanex-navy/50">Type what you read, to compare it with what the seller told you. Saved only in this browser.</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-urbanex-navy/60">
              <label>Owner name on record<input className={`${inp} mt-1`} value={f.owner} onChange={set("owner")}/></label>
              <label>Land type<input className={`${inp} mt-1`} value={f.land} onChange={set("land")} placeholder="bastu / shali / danga"/></label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => navigator.clipboard?.writeText(text()).then(() => toast.success("Copied")).catch(() => {})} className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm"><Copy className="w-4 h-4"/> Copy</button>
              <a href={waLink(`${text()}\n\nCan you help me check this land record?`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] text-white px-4 py-2 text-sm"><MessageCircle className="w-4 h-4"/> Ask Urbanex to check</a>
              <button type="button" onClick={() => setF(BLANK)} className="text-sm text-urbanex-navy/50 px-2">Clear</button>
            </div>
          </div>
          <div>
            <h2 className="font-display text-2xl text-urbanex-navy">What to check</h2>
            <ul className="mt-3 space-y-2 text-sm text-urbanex-navy/75 list-disc pl-5">{CHECKS.map(s => <li key={s}>{s}</li>)}</ul>
          </div>
        </div>
      </div>
      <div className="mt-8 grid sm:grid-cols-2 gap-4" data-testid="land-ctas">
        <Link to="/utilities/land-report" className="rounded-2xl bg-urbanex-navy text-urbanex-ivory p-5 hover:bg-urbanex-navyLight transition-colors">
          <div className="font-display text-xl">Let us fetch it for you</div>
          <p className="mt-1 text-sm text-urbanex-ivory/75">Give the plot or khatian number. We get the official record and explain it. Pay a small fee by UPI.</p>
        </Link>
        <Link to="/utilities/khatian-reader" className="rounded-2xl bg-white border border-urbanex-gold/50 p-5 hover:bg-urbanex-cream transition-colors">
          <div className="font-display text-xl text-urbanex-navy">Already have the record?</div>
          <p className="mt-1 text-sm text-urbanex-navy/70">Upload a photo or PDF and AI explains it in English and Bengali, with warning signs. Free.</p>
        </Link>
      </div>
      <p className="mt-8 text-xs text-urbanex-navy/45">Urbanex Realty is not connected to the government. Online records can lag behind the ground reality, so also check the deed and who is in possession, and take legal advice before buying.</p>
      <AppGateModal open={gate} onClose={() => setGate(false)} officialUrl={PORTAL}/>
    </LandShell>
  );
}
