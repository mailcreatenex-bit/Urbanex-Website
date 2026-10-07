import PrivacyConsent from "@/components/common/PrivacyConsent";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { CONSTRUCTION_STEPS, CONSTRUCTION_HIGHLIGHTS, CONSTR_VIDEO } from "@/constants/seedData";
import { CONSTR } from "@/constants/testIds";
import { api } from "@/lib/api";
import Turnstile, { TURNSTILE_ENABLED } from "@/components/common/Turnstile";
import { checkPhone, apiError } from "@/lib/phone";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, HardHat } from "lucide-react";
import BuildScroll from "@/components/construction/BuildScroll";
import { MaterialTrail, Questions, SiteEyes, Stages, VastuFirst } from "@/components/construction/ConstructionExtras";

export default function ConstructionPage() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const [form, setForm] = useState({ name: "", phone: "", plot: "", budget: "" });
  const [busy, setBusy] = useState(false);
  const [ts, setTs] = useState("");
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) { toast.error("Name and phone are required."); return; }
    const ph = checkPhone(form.phone);
    if (!ph.ok) { toast.error(ph.error); return; }
    setBusy(true);
    try {
      await api.post("/leads", {
        turnstile_token: ts || undefined,
        name: form.name,
        phone: ph.value,
        source_page: "construction",
        property_interest: `Construction · Plot: ${form.plot} · Budget: ${form.budget}`,
        message: `Contract construction enquiry`,
      });
      toast.success("Enquiry received. Ayan will call within 24 hours.");
      setForm({ name: "", phone: "", plot: "", budget: "" });
    } catch (err) {
      toast.error(apiError(err, "Couldn't submit — please WhatsApp Ayan directly."));
    } finally { setBusy(false); setTs(""); }
  };

  return (
    <div>
      {/* Hero: the gate of the site */}
      <section ref={ref} data-testid={CONSTR.hero} className="relative h-[88vh] overflow-hidden bg-urbanex-navy">
        <motion.div style={{ scale }} className="absolute inset-0">
          <video autoPlay loop muted playsInline poster="https://images.unsplash.com/photo-1527335988388-b40ee248d80c?w=2400" className="w-full h-full object-cover opacity-55">
            <source src={CONSTR_VIDEO} type="video/mp4"/>
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-urbanex-navy/70 via-transparent to-urbanex-navy"/>
        </motion.div>
        <div className="absolute inset-0 blueprint opacity-30 mix-blend-screen pointer-events-none"/>

        {/* tower crane, swinging a load */}
        <svg viewBox="0 0 300 300" aria-hidden="true" className="hidden md:block absolute right-6 top-20 w-[300px] opacity-90 pointer-events-none">
          <rect x="250" y="20" width="9" height="280" fill="#d9a63a"/>
          {Array.from({ length: 9 }).map((_, i) => <path key={i} d={`M250 ${30 + i * 30} L259 ${55 + i * 30} M259 ${30 + i * 30} L250 ${55 + i * 30}`} stroke="#d9a63a" strokeWidth="1.5"/>)}
          <rect x="40" y="16" width="240" height="9" fill="#d9a63a"/>
          <circle cx="254" cy="10" r="4" fill="#ff5a4d" className="beacon"/>
          <g className="crane-hook"><line x1="230" y1="25" x2="230" y2="90" stroke="#cbd2de" strokeWidth="1.5"/>
            <g className="crane-load"><rect x="214" y="90" width="32" height="14" fill="#e2573f"/><rect x="214" y="104" width="32" height="14" fill="#7d8597"/></g></g>
        </svg>

        <div className="relative z-10 h-full max-w-7xl mx-auto px-6 md:px-12 flex flex-col justify-end pb-24">
          <div className="inline-flex items-center gap-2 self-start bg-urbanex-gold text-urbanex-navy text-xs tracking-[0.24em] uppercase font-semibold px-3 py-1.5 rounded-sm mb-5">
            <HardHat className="w-4 h-4"/> Hard hat area · You are welcome
          </div>
          <h1 className="font-display text-5xl md:text-7xl text-urbanex-ivory leading-[0.98] tracking-tight max-w-4xl text-balance">
            Walk onto your site <em className="italic text-urbanex-gold">before it exists.</em>
          </h1>
          <p className="mt-5 max-w-2xl text-urbanex-ivory/80 text-lg leading-relaxed">
            Turnkey home construction in Burdwan, from design and approvals to move-in day, with a 12-month written warranty. Scroll down and watch a house go up, stage by stage.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href="#vastu" className="inline-flex items-center gap-2 rounded-full border border-urbanex-gold/60 bg-urbanex-navy/60 backdrop-blur px-4 py-2 text-sm text-urbanex-ivory hover:bg-urbanex-gold hover:text-urbanex-navy transition-colors">Vastu first, always</a>
            <a href="#cctv" className="inline-flex items-center gap-2 rounded-full border border-urbanex-gold/60 bg-urbanex-navy/60 backdrop-blur px-4 py-2 text-sm text-urbanex-ivory hover:bg-urbanex-gold hover:text-urbanex-navy transition-colors"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/> CCTV on your site, 24/7</a>
            <a href="#materials" className="inline-flex items-center gap-2 rounded-full border border-urbanex-gold/60 bg-urbanex-navy/60 backdrop-blur px-4 py-2 text-sm text-urbanex-ivory hover:bg-urbanex-gold hover:text-urbanex-navy transition-colors">See every material</a>
          </div>
          <div className="mt-8 flex flex-wrap gap-6 text-urbanex-ivory/90 text-sm font-mono">
            {[["Since", "2022"], ["Written milestones", "5"], ["Free estimate in", "7 days"], ["Warranty", "12 months"]].map(([k, v]) => (
              <div key={k} className="border-l-2 border-urbanex-gold pl-3"><div className="text-[10px] tracking-[0.2em] uppercase text-urbanex-gold">{k}</div><div className="text-xl">{v}</div></div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 h-4 hazard hazard-move" style={{ backgroundSize: "64px 100%" }} aria-hidden="true"/>
      </section>

      {/* The house builds itself as you scroll */}
      <BuildScroll/>
      <div className="h-3 hazard" aria-hidden="true"/>

      <VastuFirst/>
      <SiteEyes/>
      <MaterialTrail/>
      <Stages/>

      {/* Site rules */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-20 grid md:grid-cols-4 gap-6">
        {CONSTRUCTION_HIGHLIGHTS.map((h, i) => (
          <motion.div key={h.title} initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*0.08}}
            className="p-6 rounded-sm bg-white border-t-4 border-urbanex-gold shadow-[0_10px_30px_-20px_rgba(10,18,37,.3)] hover:-translate-y-1 transition-transform">
            <CheckCircle2 className="w-6 h-6 text-urbanex-gold"/>
            <div className="mt-4 font-display text-xl text-urbanex-navy">{h.title}</div>
            <div className="mt-2 text-sm text-urbanex-navy/70 leading-relaxed">{h.body}</div>
          </motion.div>
        ))}
      </section>

      {/* Sample weekly site report */}
      <section className="max-w-5xl mx-auto px-6 md:px-12 py-16">
        <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-4">Nothing hidden</div>
        <h2 className="font-display text-4xl md:text-5xl text-urbanex-navy leading-tight tracking-tight max-w-2xl text-balance">The site diary you receive every week.</h2>
        <div className="mt-10 grid md:grid-cols-5 gap-6 items-start">
          <div className="md:col-span-3 relative bg-[#fffdf2] border border-urbanex-navy/10 rounded-sm shadow-[0_18px_40px_-24px_rgba(10,18,37,.35)] p-6 font-mono text-sm text-urbanex-navy -rotate-[0.6deg]">
            <div className="absolute -top-3 left-8 w-16 h-6 bg-urbanex-gold/70 rotate-[-4deg]" aria-hidden="true"/>
            <div className="flex justify-between text-[11px] tracking-[0.2em] uppercase text-urbanex-navy/50"><span>Weekly site report</span><span>Sample format</span></div>
            <div className="mt-4 divide-y divide-dashed divide-urbanex-navy/20">
              {[["Cement received", "bags, with bill photo"], ["Steel received", "kg, with weighment slip"], ["Crew on site", "masons, helpers, trade leads"], ["Work completed", "what was poured, laid or fixed"], ["Next week", "what is planned and what we need from you"]].map(([k, v]) => (
                <div key={k} className="py-2.5 flex justify-between gap-4"><span className="font-semibold">{k}</span><span className="text-urbanex-navy/55 text-right">{v}</span></div>
              ))}
            </div>
            <div className="mt-4 text-[11px] text-urbanex-navy/45">Sent to your WhatsApp every week with photos, so you can follow your build from anywhere.</div>
          </div>
          <div className="md:col-span-2 space-y-4 text-urbanex-navy/75 leading-relaxed">
            <p>Living abroad or just busy? You see what a visitor would see: material in, work done, what is next.</p>
            <p>Before each stage ends we walk you through it, on site or on video, and we only start the next stage after your sign-off.</p>
          </div>
        </div>
      </section>

      <Questions/>

      {/* CTA form */}
      <section id="estimate" className="max-w-7xl mx-auto px-6 md:px-12 py-16">
        <div className="relative overflow-hidden rounded-3xl bg-urbanex-navy p-10 md:p-16">
          <div className="grid md:grid-cols-2 gap-10 items-center relative z-10">
            <div>
              <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-4">Free estimate</div>
              <h3 className="font-display text-4xl md:text-5xl text-urbanex-ivory leading-tight tracking-tight text-balance">
                Tell us about your plot — we'll draft a design + estimate in 7 days.
              </h3>
              <p className="mt-4 text-urbanex-ivory/70 leading-relaxed max-w-md">No obligation. No hidden fee. We only take on projects we're proud to sign our name to.</p>
            </div>
            <form data-testid={CONSTR.form} onSubmit={submit} className="space-y-4 bg-urbanex-ivory rounded-2xl p-6 md:p-8">
              <Input data-testid={CONSTR.name} placeholder="Full name" value={form.name} onChange={set("name")} className="h-12 bg-white border-urbanex-navy/10 rounded-lg"/>
              <Input data-testid={CONSTR.phone} placeholder="Phone / WhatsApp" value={form.phone} onChange={set("phone")} className="h-12 bg-white border-urbanex-navy/10 rounded-lg"/>
              <Input data-testid={CONSTR.plot} placeholder="Plot size (sqft) & zone" value={form.plot} onChange={set("plot")} className="h-12 bg-white border-urbanex-navy/10 rounded-lg"/>
              <Input data-testid={CONSTR.budget} placeholder="Rough budget (₹)" value={form.budget} onChange={set("budget")} className="h-12 bg-white border-urbanex-navy/10 rounded-lg"/>
              <Turnstile value={ts} onChange={setTs}/>
              <PrivacyConsent tone="light"/>
      <Button data-testid={CONSTR.submit} disabled={busy || (TURNSTILE_ENABLED && !ts)} type="submit" className="w-full h-12 bg-urbanex-gold hover:bg-urbanex-goldHover text-urbanex-navy rounded-full font-medium">
                {busy ? "Sending…" : "Request estimate"} <ArrowRight className="w-4 h-4 ml-1"/>
              </Button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
