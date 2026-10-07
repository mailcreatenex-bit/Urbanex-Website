import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileText, MessageCircle, Sparkles, XCircle } from "lucide-react";
import LandShell from "@/pages/utilities/LandShell";
import Turnstile, { TURNSTILE_ENABLED } from "@/components/common/Turnstile";
import { api } from "@/lib/api";
import { waLink } from "@/lib/config";
import { fmt, fromSqft, kathaChatak } from "@/lib/land";
import { useI18n } from "@/context/I18nContext";
import { useSeo } from "@/lib/seo";
import { Link } from "react-router-dom";

const inp = "w-full border border-urbanex-navy/15 rounded-lg px-3 py-2.5 text-sm bg-white";
const CONF = { high: "bg-emerald-100 text-emerald-700", medium: "bg-amber-100 text-amber-700", low: "bg-red-100 text-red-700" };

function Fact({ label, value }) {
  return value ? <div className="rounded-xl bg-urbanex-cream px-4 py-3"><div className="text-[10px] tracking-[0.2em] uppercase text-urbanex-navy/50">{label}</div><div className="font-medium text-urbanex-navy break-words">{value}</div></div> : null;
}

export default function KhatianReaderPage() {
  useSeo({ title: "Khatian reader: understand a land record with AI", description: "Upload a photo or PDF of a khatian or plot record and get a plain-language explanation and warning signs, in English and Bengali." });
  const { lang } = useI18n();
  const [files, setFiles] = useState([]);
  const [seller, setSeller] = useState("");
  const [claimed, setClaimed] = useState("");
  const [unit, setUnit] = useState("decimal");
  const [use, setUse] = useState("house");
  const [ts, setTs] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null);
  const [showBn, setShowBn] = useState(lang === "bn");
  const pick = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!files.length) return toast.error("Add a photo or PDF of the record");
    setBusy(true); setOut(null);
    const fd = new FormData();
    files.forEach(f => fd.append("files", f));
    if (seller.trim()) fd.append("seller_name", seller.trim());
    if (claimed) { fd.append("claimed_value", claimed); fd.append("claimed_unit", unit); }
    fd.append("intended_use", use);
    if (ts) fd.append("turnstile_token", ts);
    try { const { data } = await api.post("/land-ai/read", fd, { headers: { "Content-Type": "multipart/form-data" } }); setOut(data); setTimeout(() => document.getElementById("khatian-result")?.scrollIntoView({ behavior: "smooth" }), 100); }
    catch (err) { const d = err?.response?.data?.detail; toast.error(typeof d === "string" ? d : "Could not read that record. Try a clearer photo."); }
    finally { setBusy(false); setTs(""); }
  };

  const f = out?.fields;
  const kc = f?.area_sqft ? kathaChatak(f.area_sqft) : null;

  return (
    <LandShell title="Khatian reader" intro="Upload a photo or PDF of a khatian, plot (dag) record or tax receipt. AI explains it in plain words and points out what to double-check. Your file is not saved.">
      <div className="grid lg:grid-cols-2 gap-8">
        <form onSubmit={submit} className="rounded-2xl bg-white border border-urbanex-navy/5 p-6 space-y-4" data-testid="khatian-form">
          <div>
            <button type="button" onClick={() => pick.current?.click()} className="w-full rounded-xl border-2 border-dashed p-6 text-center hover:border-urbanex-gold">
              <FileText className="w-7 h-7 mx-auto text-urbanex-gold"/>
              <div className="mt-2 text-sm text-urbanex-navy/75">{files.length ? `${files.length} file${files.length > 1 ? "s" : ""}: ${files.map(x => x.name).join(", ").slice(0, 80)}` : "Take a photo or choose files (JPG, PNG, PDF, up to 4)"}</div>
            </button>
            <input ref={pick} type="file" accept="image/*,application/pdf" multiple className="hidden" data-testid="khatian-file" onChange={(e) => setFiles([...e.target.files].slice(0, 4))}/>
            <p className="mt-1 text-[11px] text-urbanex-navy/45">Lay the paper flat in good light so every line is readable.</p>
          </div>
          <div className="rounded-xl bg-urbanex-cream p-4 space-y-3">
            <div className="text-xs text-urbanex-navy/60">Optional: tell us what the seller said, and we will compare it with the record.</div>
            <input className={inp} placeholder="Seller's name" value={seller} onChange={(e) => setSeller(e.target.value)} maxLength={80}/>
            <div className="flex gap-2"><input type="number" min="0" step="any" className={inp} placeholder="Area the seller claims" value={claimed} onChange={(e) => setClaimed(e.target.value)}/>
              <select className={`${inp} w-auto`} value={unit} onChange={(e) => setUnit(e.target.value)}>{["decimal", "katha", "bigha", "acre", "sqft"].map(u => <option key={u} value={u}>{u === "sqft" ? "sq ft" : u}</option>)}</select></div>
            <select className={inp} value={use} onChange={(e) => setUse(e.target.value)} aria-label="What will you use the land for"><option value="house">I want to build a house</option><option value="farming">Farming</option><option value="investment">Investment</option><option value="">Not decided</option></select>
          </div>
          <Turnstile value={ts} onChange={setTs}/>
          <button disabled={busy || (TURNSTILE_ENABLED && !ts)} data-testid="khatian-go" className="w-full inline-flex items-center justify-center gap-2 bg-urbanex-navy text-urbanex-ivory rounded-full py-3 text-sm disabled:opacity-50"><Sparkles className="w-4 h-4"/> {busy ? "Reading the record…" : "Read this record"}</button>
        </form>
        <div className="rounded-2xl bg-urbanex-navy text-urbanex-ivory p-6 self-start">
          <div className="font-display text-2xl">What you get</div>
          <ul className="mt-3 space-y-2 text-sm text-urbanex-ivory/80 list-disc pl-5">
            <li>Owner names, plot and khatian numbers, land type and area, read out clearly.</li>
            <li>Checks against what the seller told you: name, area, and whether the land can be built on.</li>
            <li>Warning signs such as shared ownership, farm land or a pond.</li>
            <li>A summary in English and Bengali, and questions to ask the seller.</li>
          </ul>
          <p className="mt-4 text-xs text-urbanex-ivory/60">AI can misread handwriting. Treat this as a first look, not legal advice.</p>
          <Link to="/utilities/land-report" className="mt-5 inline-block rounded-full bg-urbanex-gold text-urbanex-navy px-5 py-2.5 text-sm font-medium">Want us to fetch the official record? Order a report</Link>
        </div>
      </div>

      {out && (
        <div id="khatian-result" className="mt-10 space-y-6" data-testid="khatian-result">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-3xl text-urbanex-navy">{out.document_type}</h2>
            <span className={`text-xs rounded-full px-3 py-1 ${CONF[out.confidence]}`}>{out.confidence} confidence</span>
            {!out.readable && <span className="text-xs rounded-full px-3 py-1 bg-red-100 text-red-700">hard to read: try a clearer photo</span>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Fact label="District" value={f.district}/><Fact label="Block" value={f.block}/><Fact label="Mouza" value={f.mouza}/><Fact label="JL no" value={f.jl_no}/>
            <Fact label="Plot (dag) no" value={f.plot_no}/><Fact label="Khatian no" value={f.khatian_no}/><Fact label="Share" value={f.share}/>
            <Fact label="Land type" value={f.land_class_text}/>
            {f.owners?.length > 0 && <div className="col-span-2 md:col-span-4 rounded-xl bg-urbanex-cream px-4 py-3"><div className="text-[10px] tracking-[0.2em] uppercase text-urbanex-navy/50">Owners on record</div><div className="font-medium text-urbanex-navy">{f.owners.join(", ")}</div></div>}
            {f.area_sqft && <div className="col-span-2 md:col-span-4 rounded-xl bg-urbanex-cream px-4 py-3"><div className="text-[10px] tracking-[0.2em] uppercase text-urbanex-navy/50">Area on record</div><div className="font-medium text-urbanex-navy">{f.area_value} {f.area_unit} = {fmt(f.area_sqft)} sq ft = {kc.katha} katha {fmt(kc.chatak)} chatak = {fmt(fromSqft(f.area_sqft, "decimal"))} decimal</div></div>}
          </div>

          {out.checks.length > 0 && (
            <div className="rounded-2xl bg-white border border-urbanex-navy/5 p-5 space-y-3" data-testid="khatian-checks">
              <div className="text-xs tracking-[0.2em] uppercase text-urbanex-gold">Checked against what you told us</div>
              {out.checks.map(c => <div key={c.id} className="flex gap-3">{c.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0"/> : <XCircle className="w-5 h-5 text-red-600 shrink-0"/>}<div><div className="font-medium text-urbanex-navy">{c.title}</div><div className="text-sm text-urbanex-navy/70">{c.why}</div></div></div>)}
            </div>
          )}

          {out.concerns.length > 0 && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 space-y-2">
              <div className="text-xs tracking-[0.2em] uppercase text-amber-800 flex items-center gap-1"><AlertTriangle className="w-4 h-4"/> Look closely at</div>
              {out.concerns.map((c, i) => <div key={i}><b>{c.title}.</b> <span className="text-sm text-urbanex-navy/75">{c.why}</span></div>)}
            </div>
          )}

          <div className="rounded-2xl bg-white border border-urbanex-navy/5 p-5">
            <div className="flex items-center justify-between"><div className="text-xs tracking-[0.2em] uppercase text-urbanex-gold">In plain words</div>
              <div className="flex rounded-full border overflow-hidden text-xs">{[[false, "English"], [true, "বাংলা"]].map(([v, l]) => <button key={l} type="button" onClick={() => setShowBn(v)} className={`px-3 py-1 ${showBn === v ? "bg-urbanex-navy text-urbanex-ivory" : ""}`}>{l}</button>)}</div></div>
            <p className="mt-3 text-urbanex-navy/85 leading-relaxed" data-testid="khatian-summary">{(showBn ? out.summary_bn : out.summary_en) || out.summary_en || out.summary_bn}</p>
            {out.ask_the_seller.length > 0 && <><div className="mt-4 text-xs tracking-[0.2em] uppercase text-urbanex-gold">Ask the seller</div><ul className="mt-2 list-disc pl-5 text-sm text-urbanex-navy/80 space-y-1">{out.ask_the_seller.map((q, i) => <li key={i}>{q}</li>)}</ul></>}
          </div>
          <p className="text-xs text-urbanex-navy/50">{out.disclaimer}</p>
          <a href={waLink(`Please review this land record with me.\nDistrict: ${f.district || "-"}, Mouza: ${f.mouza || "-"}, Plot: ${f.plot_no || "-"}, Khatian: ${f.khatian_no || "-"}\nOwners: ${(f.owners || []).join(", ") || "-"}\nLand type: ${f.land_class_text || "-"}`)}
            target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#25D366] text-white px-6 py-3 text-sm"><MessageCircle className="w-4 h-4"/> Ask Urbanex to review it with me</a>
        </div>
      )}
    </LandShell>
  );
}
