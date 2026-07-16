import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, PlayCircle, ChevronDown } from "lucide-react";
import { HOME } from "@/constants/testIds";

const HERO_VIDEO_SRC = "/videos/hero-scroll.mp4";

export default function HeroSection() {
  const ref = useRef(null);
  const videoRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [duration, setDuration] = useState(0);

  // Extended scroll range so the scrub feels cinematic
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const contentOpacity = useTransform(scrollYProgress, [0, 0.5, 0.85], [1, 0.9, 0]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -60]);

  // Bind video currentTime to scroll progress
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    // Advance the video linearly across the scroll range
    const t = Math.max(0, Math.min(duration - 0.05, p * duration));
    // Only update if diff meaningful to avoid stutter
    if (Math.abs(v.currentTime - t) > 0.03) {
      try { v.currentTime = t; } catch {}
    }
  });

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => { setDuration(v.duration || 0); };
    const onCanPlay = () => setReady(true);
    if (v.readyState >= 1) onMeta();
    if (v.readyState >= 3) setReady(true);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("canplay", onCanPlay);
    // Force load and prime the pipeline: play + immediately pause so the first frame
    // is rendered and the decoder stays warm for scroll-driven seeks.
    v.load();
    const prime = async () => {
      try {
        await v.play();
        await new Promise((r) => setTimeout(r, 60));
        v.pause();
        v.currentTime = 0;
      } catch {
        /* autoplay blocked — that's fine, seeks still work */
      }
    };
    prime();
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("canplay", onCanPlay);
    };
  }, []);

  return (
    <section
      ref={ref}
      data-testid={HOME.hero}
      className="relative h-[220vh] bg-urbanex-navy"
    >
      {/* Sticky viewport that the video sits inside */}
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <video
          ref={videoRef}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          poster="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=2400"
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/videos/hero-scroll.webm" type="video/webm"/>
          <source src="/videos/hero-scroll.mp4" type="video/mp4"/>
        </video>

        {/* Elegant gradient wash — never fully dark */}
        <div className="absolute inset-0 bg-gradient-to-b from-urbanex-navy/45 via-urbanex-navy/25 to-urbanex-navy/70 pointer-events-none"/>
        {/* Subtle grain */}
        <div className="absolute inset-0 opacity-40 mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.35'/></svg>\")" }}
        />

        {/* Content */}
        <motion.div style={{ opacity: contentOpacity, y: contentY }} className="relative z-10 h-full max-w-7xl mx-auto px-6 md:px-12 flex flex-col justify-end pb-24">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          >
            <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-6 flex items-center gap-3">
              <span className="w-10 h-px bg-urbanex-gold"/> Burdwan · Est. 2022
            </div>
            <h1 className="font-display text-5xl md:text-7xl lg:text-[92px] leading-[0.95] text-urbanex-ivory tracking-tight max-w-4xl text-balance">
              Homes worth <em className="italic font-normal text-urbanex-gold">every rupee</em> — chosen, built, delivered.
            </h1>
            <p className="mt-6 max-w-xl text-urbanex-ivory/85 text-lg leading-relaxed">
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
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          style={{ opacity: useTransform(scrollYProgress, [0, 0.15], [1, 0]) }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-urbanex-ivory/70"
        >
          <div className="text-[10px] tracking-[0.32em] uppercase">Scroll to unfold</div>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown className="w-4 h-4 text-urbanex-gold"/>
          </motion.div>
        </motion.div>

        {/* Loading shimmer while metadata resolves */}
        {!ready && (
          <div className="absolute inset-0 z-20 flex items-end pb-24 max-w-7xl mx-auto px-6 md:px-12 pointer-events-none">
            <div className="w-40 h-1 bg-urbanex-gold/30 overflow-hidden rounded-full">
              <div className="h-full w-1/3 bg-urbanex-gold animate-shimmer"/>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
