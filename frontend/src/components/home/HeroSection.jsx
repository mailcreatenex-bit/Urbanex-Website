import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, PlayCircle } from "lucide-react";
import { HERO_VIDEO } from "@/constants/seedData";
import { HOME } from "@/constants/testIds";

export default function HeroSection() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0.4]);

  return (
    <section ref={ref} data-testid={HOME.hero} className="relative h-[92vh] overflow-hidden bg-urbanex-navy">
      <motion.div style={{ scale, opacity }} className="absolute inset-0">
        <video
          autoPlay muted loop playsInline
          poster="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=2400"
          className="w-full h-full object-cover"
        >
          <source src={HERO_VIDEO} type="video/mp4"/>
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-urbanex-navy/50 via-urbanex-navy/30 to-urbanex-navy/70"/>
      </motion.div>

      <div className="relative z-10 h-full max-w-7xl mx-auto px-6 md:px-12 flex flex-col justify-end pb-20">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: "easeOut" }}>
          <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-6 flex items-center gap-3">
            <span className="w-10 h-px bg-urbanex-gold"/> Burdwan · Est. 2022
          </div>
          <h1 className="font-display text-5xl md:text-7xl lg:text-[92px] leading-[0.95] text-urbanex-ivory tracking-tight max-w-4xl text-balance">
            Homes worth <em className="italic font-normal text-urbanex-gold">every rupee</em> — chosen, built, delivered.
          </h1>
          <p className="mt-6 max-w-xl text-urbanex-ivory/80 text-lg leading-relaxed">
            Boutique real estate advisory in Burdwan. Twelve hand-curated properties. One founder who picks up the phone.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link to="/properties" data-testid={HOME.ctaExplore}
              className="group inline-flex items-center gap-2 bg-urbanex-gold hover:bg-urbanex-goldHover text-urbanex-navy px-7 py-4 rounded-full text-sm tracking-wide font-medium transition-colors">
              Explore properties
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1"/>
            </Link>
            <Link to="/construction" data-testid={HOME.ctaConstruction}
              className="group inline-flex items-center gap-2 border border-urbanex-ivory/40 hover:border-urbanex-gold text-urbanex-ivory px-6 py-4 rounded-full text-sm tracking-wide transition-colors">
              <PlayCircle className="w-4 h-4 text-urbanex-gold"/> Contract construction
            </Link>
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 text-urbanex-ivory/50 text-[10px] tracking-[0.32em] uppercase">
        Scroll to enter →
      </div>
    </section>
  );
}
