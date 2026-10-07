import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Spot from "@/components/fx/Spot";

const img = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=65&w=1100`;

// Three things only Urbanex has. Each card starts as a blueprint line drawing and turns into the real thing on hover or focus.
const CARDS = [
  { to: "/vastu", n: "02", title: "Vastu Compass", body: "Place your rooms on the compass, or photograph your floor plan. See in seconds what is right and what to fix.", photo: "1503387762-592deb58ef4e", art: "compass", tag: "Free · AI reads your plan" },
  { to: "/map", n: "03", title: "Map of Burdwan", body: "Every home and video tour on one live map. Tap a neighbourhood and the map flies there.", photo: "1541888946425-d81bb19240f5", art: "map", tag: "Homes + video tours" },
  { to: "/construction#cctv", n: "04", title: "Your site, live", body: "CCTV on your house from day one. Watch the work, and see which material goes into it, from anywhere.", photo: "1557597774-9d273605dfa9", art: "cctv", tag: "24/7 recording" },
];

function Art({ kind }) {
  const p = { fill: "none", stroke: "#C5A059", strokeWidth: 1.2, pathLength: 1, className: "draw" };
  return (
    <svg viewBox="0 0 300 200" className="absolute inset-0 w-full h-full" aria-hidden="true">
      {kind === "compass" && <><circle cx="150" cy="100" r="70" {...p}/><circle cx="150" cy="100" r="46" {...p} strokeDasharray=""/><path d="M150 22 L158 100 L150 178 L142 100 Z" {...p}/><path d="M72 100 L150 92 L228 100 L150 108 Z" {...p}/><rect x="110" y="60" width="80" height="80" {...p}/></>}
      {kind === "map" && <><path d="M20 150 C70 90 110 170 160 110 S250 60 280 90" {...p}/><path d="M30 60 L120 80 L170 40 L270 120" {...p}/><circle cx="120" cy="80" r="9" {...p}/><circle cx="210" cy="96" r="9" {...p}/><circle cx="90" cy="130" r="9" {...p}/><path d="M20 20 H280 V180 H20 Z" {...p}/></>}
      {kind === "cctv" && <><path d="M60 70 L190 50 L205 100 L75 120 Z" {...p}/><path d="M205 80 L250 70 L255 120 L210 112" {...p}/><circle cx="130" cy="85" r="22" {...p}/><circle cx="130" cy="85" r="8" {...p}/><path d="M70 120 L60 175 H110" {...p}/></>}
    </svg>
  );
}

export default function Triptych() {
  return (
    <section className="sec-dark" data-testid="triptych">
      <div className="aurora" style={{ opacity: 0.35 }}/>
      <div className="max-w-7xl mx-auto px-5 md:px-10 py-24 md:py-32">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div><div className="chapter" data-n="02">Only at Urbanex</div>
            <h2 className="mt-5 font-display text-5xl md:text-7xl leading-[0.98] tracking-tight max-w-3xl text-balance">Tools that <em className="italic text-gold-gradient">no other</em> property site has.</h2></div>
          <p className="max-w-sm text-urbanex-ivory/60 leading-relaxed">We are not just a list of homes. We are the builder who reads the compass, the map that knows Burdwan, and the camera on your wall.</p>
        </div>
        <div className="mt-14 grid lg:grid-cols-3 gap-5">
          {CARDS.map((c, i) => (
            <motion.div key={c.to} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.7, delay: i * 0.12, ease: [0.2, 0.8, 0.2, 1] }}>
              <Spot as={Link} to={c.to} className="group relative block overflow-hidden rounded-[1.75rem] aspect-[4/5] border border-white/12 bg-[#0a1428] focus-visible:outline focus-visible:outline-2 focus-visible:outline-urbanex-gold" data-testid={`tri-${c.art}`}>
                <img src={img(c.photo)} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-0 scale-110 group-hover:opacity-70 group-focus-visible:opacity-70 group-hover:scale-100 group-focus-visible:scale-100 transition-all duration-700 ease-out"/>
                <div className="absolute inset-0 blueprint opacity-60 group-hover:opacity-0 transition-opacity duration-700"/>
                <Art kind={c.art}/>
                <div className="absolute inset-0 bg-gradient-to-t from-[#060d1c] via-[#060d1c]/40 to-transparent"/>
                <div className="absolute inset-x-0 bottom-0 p-6 md:p-7">
                  <div className="font-mono text-[11px] tracking-[0.2em] text-urbanex-gold">{c.n} · {c.tag}</div>
                  <div className="mt-2 flex items-start justify-between gap-3"><h3 className="font-display text-4xl leading-none">{c.title}</h3>
                    <span className="grid place-items-center h-11 w-11 shrink-0 rounded-full border border-white/25 group-hover:bg-urbanex-gold group-hover:border-urbanex-gold group-hover:text-urbanex-navy transition-colors"><ArrowUpRight className="w-5 h-5"/></span></div>
                  <p className="mt-3 text-sm text-urbanex-ivory/70 leading-relaxed">{c.body}</p>
                </div>
              </Spot>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
