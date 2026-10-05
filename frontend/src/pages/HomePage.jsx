import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Sparkles, HandshakeIcon, Hammer } from "lucide-react";
import HeroSection from "@/components/home/HeroSection";
import PromoBand from "@/components/home/PromoBand";
import ZonesMarquee from "@/components/home/ZonesMarquee";
import TestimonialsSlider from "@/components/home/TestimonialsSlider";
import LatestVideos from "@/components/home/LatestVideos";
import HomeCtas from "@/components/home/HomeCtas";
import Tilt from "@/components/fx/Tilt";
import PropertyCard from "@/components/properties/PropertyCard";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const PILLARS = [
  { icon: Sparkles, title: "Hand-picked", body: "Only 12 properties on the site — because we won't list what we wouldn't buy ourselves." },
  { icon: ShieldCheck, title: "Zero-surprise deals", body: "Full title check, mutation, tax dues — verified before you sign anything." },
  { icon: Hammer, title: "In-house construction", body: "Buying a plot? We can build your home too, with weekly billing transparency." },
  { icon: HandshakeIcon, title: "One relationship", body: "Ayan personally handles every deal. No junior handoffs, no ghosting." },
];

export default function HomePage() {
  const [props, setProps] = useState([]);
  const { user, loading } = useAuth();
  const uid = user?.user_id;
  // Refetch on sign-in/out: prices only come back for authenticated users.
  useEffect(() => {
    if (loading) return;
    api.get("/properties").then(r => setProps((r.data || []).slice(0, 6))).catch(() => {});
  }, [uid, loading]);

  return (
    <div>
      <HeroSection/>
      <LatestVideos/>
      <PromoBand/>

      {/* Pillars */}
      <section className="cv-auto max-w-7xl mx-auto px-6 md:px-12 py-24">
        <div className="grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-5">
            <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-4">Why Urbanex</div>
            <h2 className="font-display text-4xl md:text-5xl text-urbanex-navy leading-[1.05] tracking-tight text-balance">
              Real estate you can <em className="italic text-urbanex-gold">actually trust</em> — because we said no first.
            </h2>
            <p className="mt-6 text-urbanex-navy/70 leading-relaxed max-w-md">
              Burdwan is small. Reputation isn't optional. We work with families, NRIs and first-time buyers who value slow, honest advice over pushy salesmanship.
            </p>
          </div>
          <div className="md:col-span-7 grid sm:grid-cols-2 gap-5">
            {PILLARS.map((p, i) => (
              <Tilt key={p.title} className="rounded-2xl" max={7}>
              <motion.div
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.5 }}
                className="h-full p-6 rounded-2xl bg-white border border-urbanex-navy/5 hover:border-urbanex-gold/40 transition-colors">
                <p.icon className="w-6 h-6 text-urbanex-gold"/>
                <div className="mt-4 font-display text-xl text-urbanex-navy">{p.title}</div>
                <div className="mt-2 text-sm text-urbanex-navy/70 leading-relaxed">{p.body}</div>
              </motion.div>
              </Tilt>
            ))}
          </div>
        </div>
      </section>

      <HomeCtas/>

      <ZonesMarquee/>

      {/* Featured properties */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-24">
        <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
          <div>
            <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-3">This month's shortlist</div>
            <h2 className="font-display text-4xl md:text-5xl text-urbanex-navy leading-tight tracking-tight">Six homes we'd bet on.</h2>
          </div>
          <Link to="/properties" className="inline-flex items-center gap-2 text-urbanex-navy hover:text-urbanex-gold text-sm tracking-wide group">
            View all 12 <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1"/>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {props.map((p, i) => <PropertyCard key={p.id} property={p} idx={i}/>)}
        </div>
      </section>

      <TestimonialsSlider/>

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
                Turnkey construction with fixed milestones, weekly billing transparency and a 12-month structural warranty in writing.
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
