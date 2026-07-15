import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { FOUNDER_IMAGES } from "@/constants/seedData";

export default function PromoBand() {
  return (
    <section className="relative bg-urbanex-cream py-6 md:py-8 border-y border-urbanex-navy/5">
      <div className="max-w-7xl mx-auto px-6 md:px-12 grid md:grid-cols-[1fr_2fr_auto] items-center gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="relative h-24 md:h-28 rounded-2xl overflow-hidden ring-1 ring-urbanex-gold/30">
          <img src={FOUNDER_IMAGES.promoBand} alt="Looking for properties" loading="lazy"
            className="w-full h-full object-cover"/>
          <div className="absolute inset-0 bg-gradient-to-r from-urbanex-navy/70 to-transparent"/>
          <div className="absolute inset-0 flex items-center px-5">
            <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold">Looking for properties?</div>
          </div>
        </motion.div>
        <div>
          <div className="font-display text-2xl md:text-3xl text-urbanex-navy leading-snug">
            We already shortlisted <em className="italic text-urbanex-gold">twelve</em>. Your dream home is one of them.
          </div>
          <div className="text-sm text-urbanex-navy/60 mt-1">Curated across 19 Burdwan zones — from Kalibazar to Renaissance Township.</div>
        </div>
        <Link to="/properties" className="inline-flex items-center gap-2 text-urbanex-navy hover:text-urbanex-gold text-sm tracking-wide group">
          See the list
          <ArrowUpRight className="w-4 h-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"/>
        </Link>
      </div>
    </section>
  );
}
