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
import { CheckCircle2, ArrowRight } from "lucide-react";

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
      {/* Hero */}
      <section ref={ref} data-testid={CONSTR.hero} className="relative h-[80vh] overflow-hidden bg-urbanex-navy">
        <motion.div style={{ scale }} className="absolute inset-0">
          <video autoPlay loop muted playsInline poster="https://images.unsplash.com/photo-1527335988388-b40ee248d80c?w=2400" className="w-full h-full object-cover opacity-60">
            <source src={CONSTR_VIDEO} type="video/mp4"/>
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-urbanex-navy/60 via-transparent to-urbanex-navy"/>
        </motion.div>
        <div className="relative z-10 h-full max-w-7xl mx-auto px-6 md:px-12 flex flex-col justify-end pb-16">
          <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-4">Contract construction</div>
          <h1 className="font-display text-5xl md:text-7xl text-urbanex-ivory leading-[0.98] tracking-tight max-w-4xl text-balance">
            Your plot. Our crew. <em className="italic text-urbanex-gold">One handshake.</em>
          </h1>
          <p className="mt-5 max-w-2xl text-urbanex-ivory/80 text-lg leading-relaxed">
            Turnkey home construction in Burdwan — from architectural design and municipal approvals to move-in day, backed by a 12-month written warranty.
          </p>
        </div>
      </section>

      {/* Highlights */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-20 grid md:grid-cols-4 gap-6">
        {CONSTRUCTION_HIGHLIGHTS.map((h, i) => (
          <motion.div key={h.title} initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*0.08}}
            className="p-6 rounded-2xl bg-white border border-urbanex-navy/5 hover:border-urbanex-gold/40 transition-colors">
            <CheckCircle2 className="w-6 h-6 text-urbanex-gold"/>
            <div className="mt-4 font-display text-xl text-urbanex-navy">{h.title}</div>
            <div className="mt-2 text-sm text-urbanex-navy/70 leading-relaxed">{h.body}</div>
          </motion.div>
        ))}
      </section>

      {/* Timeline */}
      <section className="max-w-5xl mx-auto px-6 md:px-12 py-16">
        <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-4">Our process</div>
        <h2 className="font-display text-4xl md:text-5xl text-urbanex-navy leading-tight tracking-tight max-w-2xl text-balance">
          Five stages. Zero surprises. Written milestones.
        </h2>

        <div className="mt-14 relative">
          <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-urbanex-gold/40 md:-translate-x-px"/>
          {CONSTRUCTION_STEPS.map((s, i) => (
            <motion.div key={s.title}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.05 }}
              className={`relative pl-12 md:pl-0 md:grid md:grid-cols-2 md:gap-16 pb-16`}>
              <div className={`absolute left-2 md:left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-urbanex-gold ring-4 ring-urbanex-ivory`}/>
              <div className={i % 2 === 0 ? "md:text-right md:pr-8" : "md:col-start-2 md:pl-8"}>
                <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold">Stage {String(i + 1).padStart(2, "0")}</div>
                <div className="mt-2 font-display text-3xl text-urbanex-navy leading-tight">{s.title}</div>
                <p className="mt-3 text-urbanex-navy/70 leading-relaxed">{s.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA form */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-16">
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
