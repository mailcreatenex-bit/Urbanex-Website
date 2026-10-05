import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { ArrowRight, PlayCircle, ChevronDown } from "lucide-react";
import { HOME } from "@/constants/testIds";
import { api } from "@/lib/api";
import { fxOK } from "@/lib/fx";
import Magnetic from "@/components/fx/Magnetic";
import Counter from "@/components/fx/Counter";

// Scroll-scrubbed hero: the video's playhead is tied to how far you have scrolled, so scrolling "plays" the film.
// The poster (the film's first frame) paints first; the video is fetched right after first paint and fades in when ready.
// On top sit depth layers that also react to the cursor, a finger drag or the phone's tilt (Android).
// The poster is the film's own first frame (32 KB), so when the video fades in nothing visibly changes.
export const HERO_IMG = "/videos/hero-poster.jpg";
const HEADLINE = ["Homes", "worth", "every", "rupee", "—", "chosen,", "built,", "delivered."];

function useDepthPointer(ref) {
  useEffect(() => {
    const node = ref.current;
    if (!node || !fxOK()) return undefined;
    let raf = 0, nx = 0, ny = 0;
    const apply = () => { raf = 0; node.style.setProperty("--mx", nx.toFixed(3)); node.style.setProperty("--my", ny.toFixed(3)); };
    const set = (x, y) => { nx = Math.max(-1, Math.min(1, x)); ny = Math.max(-1, Math.min(1, y)); if (!raf) raf = requestAnimationFrame(apply); };
    const move = (e) => {
      const r = node.getBoundingClientRect();
      set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    };
    const leave = () => set(0, 0);
    // Android reports tilt: gamma (left/right) and beta (front/back). iOS needs a permission prompt, so it is skipped.
    const tilt = (e) => { if (e.gamma != null && e.beta != null) set(e.gamma / 25, (e.beta - 50) / 25); };
    node.addEventListener("pointermove", move, { passive: true });
    node.addEventListener("pointerleave", leave);
    const gyro = typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission !== "function";
    if (gyro) window.addEventListener("deviceorientation", tilt, { passive: true });
    return () => {
      node.removeEventListener("pointermove", move); node.removeEventListener("pointerleave", leave);
      if (gyro) window.removeEventListener("deviceorientation", tilt);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
}

// Data Saver or reduced motion: keep the poster photo only (and a normal-height hero)
const wantVideo = () => {
  try { return !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !navigator.connection?.saveData; } catch { return true; }
};

export default function HeroSection() {
  const ref = useRef(null);
  const videoRef = useRef(null);
  const [video] = useState(wantVideo);
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState({ properties: 0, videos: 0, zones: 0 });
  const target = useRef(0);       // where the playhead should be (seconds), set from scroll
  const loop = useRef(0);
  useDepthPointer(ref);

  // 0 when the hero reaches the top, 1 when the pinned stage is about to be released: the whole film plays in between
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const contentOpacity = useTransform(scrollYProgress, [0, 0.5, 0.85], [1, 0.9, 0]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const hintOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const chipsOpacity = useTransform(scrollYProgress, [0, 0.45], [1, 0]);

  // Ease the playhead toward the scroll position each frame: smooth even though seeking is discrete.
  const chase = () => {
    loop.current = 0;
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const diff = target.current - v.currentTime;
    if (Math.abs(diff) > 0.015) {
      try { v.currentTime = v.currentTime + diff * 0.28; } catch { /* seek not allowed yet */ }
      loop.current = requestAnimationFrame(chase);
    }
  };
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    target.current = Math.max(0, Math.min(v.duration - 0.05, p * v.duration));
    if (!loop.current) loop.current = requestAnimationFrame(chase);
  });

  // Fetch the video only after the page has painted, so the first view is just the photo.
  useEffect(() => {
    if (!video) return undefined;
    const v = videoRef.current;
    if (!v) return undefined;
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      const onReady = () => {
        setReady(true);
        const p = scrollYProgress.get();
        if (v.duration) { target.current = p * v.duration; try { v.currentTime = target.current; } catch { /* ignore */ } }
      };
      v.addEventListener("loadeddata", onReady, { once: true });
      v.preload = "auto";   // buffer the whole film so scrubbing in both directions is instant
      v.load();
      // Decoders on phones stay "asleep" until something plays: play then pause once so seeks render frames.
      v.play().then(() => { v.pause(); }).catch(() => { /* autoplay blocked: seeking still works */ });
    };
    const idle = window.requestIdleCallback ? window.requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 600);
    return () => { cancelled = true; if (window.cancelIdleCallback && window.requestIdleCallback) window.cancelIdleCallback(idle); else clearTimeout(idle); if (loop.current) cancelAnimationFrame(loop.current); };
  }, [video, scrollYProgress]);

  useEffect(() => {
    Promise.all([
      api.get("/properties").then(r => r.data.length).catch(() => 0),
      api.get("/video-listings/facets").then(r => r.data.total).catch(() => 0),
      api.get("/config/public").then(r => (r.data.zones || []).length).catch(() => 0),
    ]).then(([properties, videos, zones]) => setStats({ properties, videos, zones }));
  }, []);

  const chip = "glass rounded-2xl px-5 py-4 text-urbanex-ivory shadow-2xl";
  const depth = (k) => ({ transform: `translate3d(calc(var(--mx, 0) * ${k}px), calc(var(--my, 0) * ${k * 0.7}px), 0)` });

  return (
    <section ref={ref} data-testid={HOME.hero} className={`relative bg-urbanex-navy ${video ? "h-[220vh]" : "h-[100svh]"}`} style={{ "--mx": 0, "--my": 0 }}>
      {/* The stage stays pinned while you scroll through the section */}
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
        {/* Layer 1: poster photo, then the scroll-driven video fades in over it */}
        <div className="hero-layer absolute inset-[-3%]" style={depth(-12)}>
          <img src={HERO_IMG} alt="" fetchpriority="high" decoding="async" className="absolute inset-0 w-full h-full object-cover"/>
          {video && (
            <video ref={videoRef} muted playsInline preload="none" poster={HERO_IMG} disablePictureInPicture data-testid="hero-video"
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}>
              <source src="/videos/hero-scroll.mp4" type="video/mp4"/>
              <source src="/videos/hero-scroll.webm" type="video/webm"/>
            </video>
          )}
        </div>

        {/* Layer 2: colour wash and a warm light that moves the opposite way (feels like depth) */}
        <div className="absolute inset-0 bg-gradient-to-b from-urbanex-navy/55 via-urbanex-navy/25 to-urbanex-navy/80 pointer-events-none"/>
        <div className="hero-layer absolute -top-1/4 right-[-10%] w-[70vw] h-[70vw] max-w-[900px] max-h-[900px] rounded-full pointer-events-none"
          style={{ ...depth(46), background: "radial-gradient(circle, rgba(197,160,89,.30), transparent 62%)" }}/>

        {/* Layer 3: floating glass chips with live numbers (large screens) */}
        <motion.div style={{ opacity: chipsOpacity }} className="hidden xl:block absolute right-10 2xl:right-24 top-1/2 -translate-y-1/2 z-10 w-64 pointer-events-none" aria-hidden="true">
          {[
            { label: "Properties", n: stats.properties, k: 34, cls: "ml-0" },
            { label: "Video tours", n: stats.videos, k: 52, cls: "ml-14" },
            { label: "Burdwan zones", n: stats.zones, k: 28, cls: "ml-4" },
          ].map((c, i) => (
            <div key={c.label} className={`hero-layer mb-5 ${c.cls}`} style={depth(c.k)}>
              <div className={`${chip} floaty`} style={{ animationDelay: `${i * 0.8}s` }}>
                <div className="font-display text-4xl leading-none"><Counter to={c.n}/></div>
                <div className="mt-1 text-[10px] tracking-[0.28em] uppercase text-urbanex-gold">{c.label}</div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Layer 4: the words, with a slight 3D lean toward the pointer */}
        <motion.div style={{ opacity: contentOpacity, y: contentY }} className="relative z-10 h-full max-w-7xl mx-auto px-6 md:px-12 flex flex-col justify-end pb-24 pt-32">
          <div className="hero-layer" style={{ transform: "perspective(1200px) rotateY(calc(var(--mx, 0) * 2.2deg)) rotateX(calc(var(--my, 0) * -1.6deg))" }}>
            <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-6 flex items-center gap-3">
              <span className="w-10 h-px bg-urbanex-gold"/> Burdwan · Est. 2022
            </div>
            <h1 className="font-display text-5xl md:text-7xl lg:text-[92px] leading-[0.95] text-urbanex-ivory tracking-tight max-w-4xl xl:max-w-3xl 2xl:max-w-4xl" style={{ perspective: 800 }}>
              {HEADLINE.map((w, i) => (
                <span key={i} className="word mr-[0.22em]" style={{ "--i": i }}>
                  {i === 3 ? <em className="italic font-normal text-gold-gradient">{w}</em> : w}
                </span>
              ))}
            </h1>
            <p className="mt-6 max-w-xl text-urbanex-ivory/85 text-lg leading-relaxed">
              Boutique real estate advisory in Burdwan. Hand-picked homes, every video tour on our channel, and one founder who picks up the phone.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Magnetic>
                <Link to="/properties" data-testid={HOME.ctaExplore}
                  className="btn-shine group inline-flex items-center gap-2 bg-urbanex-gold hover:bg-urbanex-goldHover text-urbanex-navy px-7 py-4 rounded-full text-sm tracking-wide font-medium transition-colors">
                  Explore properties
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1"/>
                </Link>
              </Magnetic>
              <Magnetic>
                <Link to="/videos" data-testid="hero-videos"
                  className="group inline-flex items-center gap-2 glass hover:border-urbanex-gold text-urbanex-ivory px-6 py-4 rounded-full text-sm tracking-wide transition-colors">
                  <PlayCircle className="w-4 h-4 text-urbanex-gold"/> Watch video tours
                </Link>
              </Magnetic>
              <Link to="/construction" data-testid={HOME.ctaConstruction} className="text-sm text-urbanex-ivory/70 hover:text-urbanex-gold underline underline-offset-4 decoration-urbanex-gold/50">
                Contract construction
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Scroll hint */}
        {video && (
          <motion.div style={{ opacity: hintOpacity }} className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-urbanex-ivory/70 pointer-events-none">
            <div className="text-[10px] tracking-[0.32em] uppercase">Scroll to unfold</div>
            <ChevronDown className="w-4 h-4 text-urbanex-gold animate-bounce"/>
          </motion.div>
        )}
      </div>
    </section>
  );
}
