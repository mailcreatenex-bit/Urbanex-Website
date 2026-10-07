import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Sparkles, HandshakeIcon, Hammer } from "lucide-react";
import HeroSection from "@/components/home/HeroSection";
import PromoBand from "@/components/home/PromoBand";
import ZonesMarquee from "@/components/home/ZonesMarquee";
import TestimonialsSlider from "@/components/home/TestimonialsSlider";
import GreetingBand from "@/components/home/GreetingBand";
import LatestVideos from "@/components/home/LatestVideos";
import SocialFeeds from "@/components/home/SocialFeeds";
import HomeCtas from "@/components/home/HomeCtas";
import Concierge from "@/components/home/Concierge";
import Triptych from "@/components/home/Triptych";
import Spot from "@/components/fx/Spot";

const PILLARS = [
  { icon: Sparkles, title: "Hand-picked", body: "We only list what we would buy ourselves." },
  { icon: ShieldCheck, title: "Zero-surprise deals", body: "Full title check, mutation, tax dues — verified before you sign anything." },
  { icon: Hammer, title: "In-house construction", body: "Buying a plot? We can build your home too, with weekly billing transparency." },
  { icon: HandshakeIcon, title: "One relationship", body: "Ayan personally handles every deal. No junior handoffs, no ghosting." },
];


const WORDS = ["Vastu first", "CCTV on every site", "Video tours", "Burdwan", "One founder", "Written warranty", "Honest advice"];
function Strip() {
  const row = [...WORDS, ...WORDS];
  return (
    <div className="overflow-hidden bg-urbanex-ivory py-6 md:py-9 border-y border-urbanex-navy/10" aria-hidden="true">
      <div className="strip">
        {[0, 1].map(k => (
          <div key={k} className="flex shrink-0 items-center">
            {row.map((w, i) => (
              <span key={`${k}-${i}`} className="flex items-center">
                <span className={`font-display text-6xl md:text-8xl leading-none px-6 md:px-10 whitespace-nowrap ${i % 3 === 1 ? "italic text-urbanex-gold" : "outline-text-dark"}`}>{w}</span>
                <span className="text-urbanex-gold text-3xl">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div>
      <HeroSection/>
      <Concierge/>
      <GreetingBand/>
      <Triptych/>
      <Strip/>
      <LatestVideos/>
      <PromoBand/>

      {/* Pillars */}
      <section className="cv-auto sec-dark">
        <div className="aurora" style={{ opacity: 0.4 }}/>
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-32 grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-5 md:sticky md:top-32">
            <div className="chapter" data-n="05">Why Urbanex</div>
            <h2 className="mt-5 font-display text-4xl md:text-6xl text-urbanex-ivory leading-[1.02] tracking-tight text-balance">
              Real estate you can <em className="italic text-gold-gradient">actually trust</em>, because we said no first.
            </h2>
            <p className="mt-6 text-urbanex-ivory/65 leading-relaxed max-w-md">
              Burdwan is small. Reputation isn't optional. We work with families, NRIs and first-time buyers who value slow, honest advice over pushy salesmanship.
            </p>
          </div>
          <div className="md:col-span-7 grid sm:grid-cols-2 gap-5">
            {PILLARS.map((p, i) => (
              <motion.div key={p.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.6 }} className={i % 2 ? "sm:translate-y-10" : ""}>
                <Spot className="h-full p-7 rounded-3xl glass-dark hover:border-urbanex-gold/50 transition-colors">
                  <p.icon className="w-7 h-7 text-urbanex-gold"/>
                  <div className="mt-6 font-mono text-[11px] text-urbanex-gold/60">0{i + 1}</div>
                  <div className="mt-1 font-display text-2xl text-urbanex-ivory">{p.title}</div>
                  <div className="mt-2 text-sm text-urbanex-ivory/65 leading-relaxed">{p.body}</div>
                </Spot>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <HomeCtas/>

      <ZonesMarquee/>

      <TestimonialsSlider/>
      <SocialFeeds/>

      {/* Construction CTA */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-24">
          <div className="relative bg-urbanex-navy rounded-3xl p-10 md:p-16 overflow-hidden">
            <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1527335988388-b40ee248d80c?w=2000)", backgroundSize: "cover" }}/>
            <div className="absolute inset-0 bg-gradient-to-r from-urbanex-navy via-urbanex-navy/80 to-urbanex-navy/50"/>
            <div className="relative z-10 max-w-2xl">
              <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-4">Contract construction</div>
              <h2 className="font-display text-4xl md:text-6xl text-urbanex-ivory leading-[1.05] tracking-tight text-balance">
                Own a plot? Let's <em className="italic text-urbanex-gold">build your home</em>.
              </h2>
              <p className="mt-5 text-urbanex-ivory/80 max-w-xl leading-relaxed">
                Vastu first, always. CCTV on your site day and night, fixed milestones, weekly reports and a 12-month warranty in writing.
              </p>
              <Link to="/construction" className="mt-8 inline-flex items-center gap-2 bg-urbanex-gold hover:bg-urbanex-goldHover text-urbanex-navy px-7 py-4 rounded-full text-sm tracking-wide font-medium transition-colors">
                Explore construction service <ArrowRight className="w-4 h-4"/>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
