import PrivacyConsent from "@/components/common/PrivacyConsent";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { CheckCircle2, FileSearch, MapPinned, MessageCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useSeo } from "@/lib/seo";
import { checkPhone, apiError } from "@/lib/phone";
import Turnstile, { TURNSTILE_ENABLED } from "@/components/common/Turnstile";

const KINDS = [
  ["plot_documents", "Free plot document check", FileSearch, "Send photos of the papers (khatian, deed, mutation, tax receipt). Ayan reads them and tells you plainly what looks fine and what to ask the seller about."],
  ["land_report_preview", "Free land report preview", MapPinned, "A first look at what the official records show for a plot, so you know whether a full land report is worth it."],
];
const inp = "w-full h-12 rounded-xl border border-white/15 bg-white/[0.07] px-4 text-sm text-urbanex-ivory placeholder:text-urbanex-ivory/40 focus:border-urbanex-gold outline-none";

export default function FreeCheckPage() {
  useSeo({ title: "Free plot document check and land report preview", description: "A few free checks every week: send your plot papers and Ayan tells you what looks right and what to ask about." });
  const [st, setSt] = useState(null);
  const [kind, setKind] = useState("plot_documents");
  const [f, setF] = useState({ name: "", phone: "", details: "" });
  const [ts, setTs] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  useEffect(() => { api.get("/free-checks/status").then(r => setSt(r.data)).catch(() => {}); }, [done]);

  const submit = async (e) => {
    e.preventDefault();
    const ph = checkPhone(f.phone);
    if (f.name.trim().length < 2) { toast.error("Please tell us your name"); return; }
    if (!ph.ok) { toast.error(ph.error); return; }
    setBusy(true);
    try { const { data } = await api.post("/free-checks", { name: f.name.trim(), phone: ph.value, kind, details: f.details || undefined, turnstile_token: ts || undefined }); setDone(data); try { sessionStorage.setItem("urbanex_lead_given", "1"); } catch { /* ignore */ } }
    catch (er) { toast.error(apiError(er, "Could not send. Please WhatsApp Ayan.")); } finally { setBusy(false); setTs(""); }
  };
  const pct = st ? Math.min(100, (st.used / Math.max(1, st.limit)) * 100) : 0;

  return (
    <div className="sec-dark min-h-screen" data-testid="free-check-page">
      <div className="aurora"/>
      <div className="max-w-5xl mx-auto px-5 md:px-10 pt-32 pb-24">
        <div className="chapter" data-n="✦">Free, every week</div>
        <h1 className="mt-5 font-display text-5xl md:text-7xl leading-[0.98] tracking-tight text-balance">Know what you are <em className="italic text-gold-gradient">buying</em> before you pay.</h1>
        <p className="mt-5 max-w-2xl text-lg text-urbanex-ivory/70">Land papers are where most trouble starts. Each week Ayan checks a few buyers' documents for free. Book yours.</p>

        <div className="mt-10 grid lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-3 glass-dark rounded-[2rem] p-6 md:p-8">
            {done ? (
              <div className="text-center py-6" data-testid="free-check-done">
                <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto"/>
                <h2 className="mt-4 font-display text-4xl">{done.status === "booked" ? "You are booked" : "You are on the list"}</h2>
                <p className="mt-2 text-urbanex-ivory/70">{done.status === "booked" ? "Now send clear photos of your papers to Ayan on WhatsApp. He will go through them and call you." : `This week's free checks are all taken. The next ones open on ${done.resets_on}, and you are first in line.`}</p>
                <a href={done.whatsapp} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#25D366] text-white px-6 py-3 text-sm"><MessageCircle className="w-4 h-4"/> {done.status === "booked" ? "Send the documents on WhatsApp" : "Say hello on WhatsApp"}</a>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Which check?">
                  {KINDS.map(([k, label, Icon, body]) => (
                    <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} data-testid={`free-kind-${k}`}
                      className={`text-left rounded-2xl border p-4 transition-colors ${kind === k ? "border-urbanex-gold bg-urbanex-gold/10" : "border-white/15 hover:border-white/40"}`}>
                      <Icon className="w-6 h-6 text-urbanex-gold"/><div className="mt-2 font-display text-xl">{label}</div><div className="mt-1 text-xs text-urbanex-ivory/60 leading-relaxed">{body}</div>
                    </button>
                  ))}
                </div>
                <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Your name" autoComplete="name" className={inp} data-testid="free-name"/>
                <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Phone / WhatsApp number" inputMode="tel" autoComplete="tel" className={inp} data-testid="free-phone"/>
                <textarea value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} rows={3} maxLength={500} placeholder="Where is the plot, and what are you worried about? (optional)" className={`${inp} h-auto py-3`}/>
                <Turnstile value={ts} onChange={setTs}/>
                <PrivacyConsent tone="dark"/>
      <button disabled={busy || (TURNSTILE_ENABLED && !ts)} data-testid="free-send" className="btn-shine w-full h-12 rounded-full bg-urbanex-gold text-urbanex-navy font-medium disabled:opacity-60">{busy ? "Booking…" : st && st.left === 0 ? "Join the list for next week" : "Book my free check"}</button>
              </form>
            )}
          </div>

          <motion.aside initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="lg:col-span-2 space-y-4">
            <div className="glass-dark rounded-[2rem] p-6" data-testid="free-status">
              <div className="text-[11px] tracking-[0.2em] uppercase text-urbanex-gold">This week</div>
              <div className="mt-1 font-display text-6xl">{st ? st.left : "–"}<span className="text-2xl text-urbanex-ivory/50"> of {st ? st.limit : "–"} left</span></div>
              <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden"><motion.div className="h-full bg-urbanex-gold" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1 }}/></div>
              <p className="mt-3 text-xs text-urbanex-ivory/55">{st && st.left === 0 ? `All taken. New checks open on ${st.resets_on}.` : st ? `Resets on ${st.resets_on}.` : ""} The number is real: Ayan does each check himself.</p>
            </div>
            <ul className="space-y-2 text-sm text-urbanex-ivory/75">
              {["Papers are only used for your check", "You get a plain answer, not legal jargon", "No obligation to buy or build anything"].map(t => <li key={t} className="flex gap-2"><span className="text-urbanex-gold">✦</span>{t}</li>)}
            </ul>
            <p className="text-[11px] text-urbanex-ivory/40">This is a first look by Urbanex, not legal advice. For a purchase, also have a lawyer verify the title.</p>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
