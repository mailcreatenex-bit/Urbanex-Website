import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";

export default function TestimonialsSlider() {
  const [i, setI] = useState(0);
  const [real, setReal] = useState([]);
  // Only real, approved customer reviews are shown; the section stays hidden until there are some.
  useEffect(() => {
    api.get("/reviews").then(r => setReal((r.data.items || []).map(x => ({
      name: x.name, role: "★".repeat(x.rating) + " · Signed-in customer", quote: x.text, avatar: null,
    })))).catch(() => {});
  }, []);
  const list = real;
  const idx = list.length ? i % list.length : 0;
  const t = list[idx];
  if (!list.length) return null;
  const prev = () => setI((idx - 1 + list.length) % list.length);
  const next = () => setI((idx + 1) % list.length);

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-24">
      <div className="grid md:grid-cols-12 gap-10 items-start">
        <div className="md:col-span-4">
          <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-4">Real families · Real numbers</div>
          <h2 className="font-display text-4xl md:text-5xl text-urbanex-navy leading-[1.05] tracking-tight">
            Trusted by <em className="italic text-urbanex-gold">buyers</em>, sellers and Burdwan-returning NRIs.
          </h2>
          <div className="mt-8 flex items-center gap-2">
            <button data-testid="testimonial-prev" onClick={prev} className="w-10 h-10 rounded-full border border-urbanex-navy/20 hover:border-urbanex-gold flex items-center justify-center transition-colors"><ChevronLeft className="w-4 h-4"/></button>
            <button data-testid="testimonial-next" onClick={next} className="w-10 h-10 rounded-full border border-urbanex-navy/20 hover:border-urbanex-gold flex items-center justify-center transition-colors"><ChevronRight className="w-4 h-4"/></button>
            <div className="ml-4 text-xs text-urbanex-navy/50 font-mono">{idx + 1} / {list.length}</div>
          </div>
        </div>
        <div className="md:col-span-8 relative">
          <AnimatePresence mode="wait">
            <motion.div key={idx}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="relative bg-white rounded-3xl p-10 md:p-14 border border-urbanex-navy/5 shadow-[0_20px_60px_-30px_rgba(10,18,37,0.2)]">
              <Quote className="w-10 h-10 text-urbanex-gold/40"/>
              <p className="mt-6 font-display text-2xl md:text-3xl text-urbanex-navy leading-snug text-balance">
                {t.quote}
              </p>
              <div className="mt-8 flex items-center gap-4">
                {t.avatar ? <img src={t.avatar} alt={t.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-urbanex-gold/40"/> : <div className="w-12 h-12 rounded-full bg-urbanex-gold/20 flex items-center justify-center text-urbanex-navy font-medium">{t.name[0]}</div>}
                <div>
                  <div className="text-urbanex-navy font-medium">{t.name}</div>
                  <div className="text-sm text-urbanex-navy/60">{t.role}</div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
