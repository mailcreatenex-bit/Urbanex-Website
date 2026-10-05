import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { CONSTRUCTION_STEPS } from "@/constants/seedData";

// What you would actually see at the site during each stage.
const SEE = [
  "Surveyors peg the boundary, levels are marked and the soil is checked before a single brick moves.",
  "The sanctioned plan is pinned at the gate and every permit is in your hands, not in a drawer.",
  "Steel cages are tied, shuttering goes up, concrete is poured and cured, floor by floor.",
  "Trade crews work in sequence: wiring, pipes, tiles. Nothing is covered until you have signed it off.",
  "A final walk-through with a snag list, then the keys, the paperwork and the written warranty.",
];

const GOLD = "#C5A059";
const NAVY = "#0A1225";
const GROUND = 380;
const FLOOR_H = 84;

// A column that grows upward from `bottom`.
function Column({ s, x, bottom }) {
  const h = useTransform(s, (v) => v * FLOOR_H);
  const y = useTransform(s, (v) => bottom - v * FLOOR_H);
  return <motion.rect x={x} y={y} width="8" height={h} fill="#7d8597"/>;
}

function Slab({ s, bottom }) {
  const w = useTransform(s, [0.7, 1], [0, 212], { clamp: true });
  const x = useTransform(w, (v) => 210 - v / 2);
  return <motion.rect x={x} y={bottom - FLOOR_H - 6} width={w} height="8" fill="#4b5468"/>;
}

function Floor({ p, f }) {
  // structure covers 0.4 - 0.6 of the scroll, split between three floors
  const s = useTransform(p, [0.4 + f * 0.0667, 0.4 + (f + 1) * 0.0667], [0, 1], { clamp: true });
  const bottom = GROUND - 10 - f * FLOOR_H;
  const wall = useTransform(p, [0.6 + f * 0.05, 0.65 + f * 0.05], [0, 1], { clamp: true });
  const paint = useTransform(p, [0.8, 1], [0, 0.55], { clamp: true });
  return (
    <g>
      {[114, 174, 238, 298].map((x) => <Column key={x} s={s} x={x} bottom={bottom}/>)}
      <Slab s={s} bottom={bottom}/>
      <motion.rect x="122" y={bottom - FLOOR_H + 2} width="176" height={FLOOR_H - 8} fill="#E8E0D0" style={{ opacity: wall }}/>
      <motion.g style={{ opacity: wall }}>
        {[140, 196, 252].map((x) => <rect key={x} x={x} y={bottom - FLOOR_H + 22} width="30" height="30" rx="2" fill="#16335c" stroke="#fff" strokeWidth="2"/>)}
      </motion.g>
      <motion.rect x="122" y={bottom - FLOOR_H + 2} width="176" height={FLOOR_H - 8} fill={GOLD} style={{ opacity: paint }}/>
    </g>
  );
}

export function SiteSvg({ p }) {
  const pit = useTransform(p, [0, 0.12], [0, 1], { clamp: true });
  const outline = useTransform(p, [0, 0.14], [0, 1], { clamp: true });
  const found = useTransform(p, [0.2, 0.4], [0, 212], { clamp: true });
  const foundX = useTransform(found, (v) => 210 - v / 2);
  const board = useTransform(p, [0.2, 0.28], [0, 1], { clamp: true });
  const mep = useTransform(p, [0.6, 0.66, 0.78, 0.82], [0, 1, 1, 0], { clamp: true });
  const scaffold = useTransform(p, [0.38, 0.45, 0.78, 0.86], [0, 1, 1, 0], { clamp: true });
  const done = useTransform(p, [0.86, 0.96], [0, 1], { clamp: true });
  const hookX = useTransform(p, [0, 0.4, 0.55, 0.7, 1], [372, 280, 330, 250, 372]);
  const cable = useTransform(p, [0, 0.4, 0.55, 0.7, 1], [110, 190, 120, 160, 110]);
  const roof = useTransform(p, [0.8, 0.92], [0, 1], { clamp: true });

  return (
    <svg viewBox="0 0 420 440" className="w-full h-full" role="img" aria-label="A house being built, stage by stage, as you scroll">
      <defs>
        <pattern id="g" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke={GOLD} strokeOpacity=".12"/></pattern>
      </defs>
      <rect width="420" height="440" fill="url(#g)"/>

      {/* crane */}
      <g>
        <rect x="372" y="50" width="8" height="330" fill="#d9a63a"/>
        {Array.from({ length: 11 }).map((_, i) => <path key={i} d={`M372 ${60 + i * 30} L380 ${80 + i * 30} M380 ${60 + i * 30} L372 ${80 + i * 30}`} stroke="#d9a63a" strokeWidth="1.5"/>)}
        <rect x="190" y="44" width="200" height="8" fill="#d9a63a"/>
        <rect x="380" y="38" width="20" height="14" fill="#8a6d1e"/>
        <circle cx="376" cy="34" r="4" fill="#ff5a4d" className="beacon"/>
        <motion.line x1={hookX} y1="52" x2={hookX} y2={cable} stroke="#cbd2de" strokeWidth="1.5"/>
        <motion.rect x={useTransform(hookX, (v) => v - 8)} y={cable} width="16" height="10" fill="#e2573f"/>
      </g>

      {/* ground */}
      <rect x="0" y={GROUND} width="420" height="60" fill="#1A253F"/>
      <rect x="0" y={GROUND} width="420" height="4" fill={GOLD}/>

      {/* stage 1: survey pegs + excavation */}
      <motion.path d={`M110 ${GROUND - 252} H310 V${GROUND} H110 Z`} fill="none" stroke={GOLD} strokeWidth="1.5" strokeDasharray="5 5" style={{ pathLength: outline, opacity: 0.55 }}/>
      <motion.rect x="104" y={GROUND} width="212" height="14" fill="#0b0f1c" style={{ opacity: pit }}/>
      {[104, 316].map((x) => <motion.rect key={x} x={x - 2} y={GROUND - 22} width="4" height="22" fill="#ff5a4d" style={{ opacity: pit }}/>)}

      {/* stage 2: sanctioned plan board */}
      <motion.g style={{ opacity: board }}>
        <rect x="16" y="288" width="78" height="62" rx="3" fill="#FDFBF7" stroke={GOLD} strokeWidth="2"/>
        <rect x="52" y="350" width="6" height="30" fill="#4b5468"/>
        <text x="55" y="310" fontSize="9" textAnchor="middle" fill={NAVY} fontWeight="700">PLAN</text>
        <text x="55" y="322" fontSize="9" textAnchor="middle" fill={NAVY} fontWeight="700">SANCTIONED</text>
        <text x="55" y="340" fontSize="14" textAnchor="middle" fill="#2c8a4b" fontWeight="700" transform="rotate(-8 55 340)">APPROVED</text>
      </motion.g>

      {/* foundation */}
      <motion.rect x={foundX} y={GROUND - 10} width={found} height="10" fill="#4b5468"/>

      {/* structure, walls, finish: three floors */}
      {[0, 1, 2].map((f) => <Floor key={f} p={p} f={f}/>)}

      {/* wiring and plumbing */}
      <motion.g style={{ opacity: mep }} fill="none" strokeWidth="2.5" strokeLinecap="round">
        <path d="M134 360 V140" stroke="#e2573f"/><path d="M286 360 V140" stroke="#e2573f"/><path d="M146 300 H274 M146 216 H274" stroke="#3b82c4"/><path d="M160 360 V140" stroke="#3b82c4" strokeDasharray="2 6"/>
      </motion.g>

      {/* scaffolding */}
      <motion.g style={{ opacity: scaffold }} stroke="#c58a1f" strokeWidth="2" fill="none">
        <path d="M100 380 V120 M326 380 V120"/>
        {[0, 1, 2, 3].map((i) => <path key={i} d={`M96 ${296 - i * 84} H330`}/>)}
        {[0, 1, 2].map((i) => <path key={i} d={`M100 ${380 - i * 84} L326 ${296 - i * 84} M326 ${380 - i * 84} L100 ${296 - i * 84}`} strokeOpacity=".45"/>)}
      </motion.g>

      {/* roof + door + warranty seal */}
      <motion.rect x="104" y={GROUND - 10 - 3 * FLOOR_H - 12} width="212" height="10" fill={NAVY} style={{ opacity: roof }}/>
      <motion.g style={{ opacity: done }}>
        <rect x="190" y={GROUND - 54} width="38" height="44" rx="3" fill="#6b3f1d"/>
        <circle cx="222" cy={GROUND - 32} r="2" fill={GOLD}/>
        <circle cx="76" cy="120" r="34" fill={GOLD} stroke={NAVY} strokeWidth="3"/>
        <text x="76" y="116" fontSize="13" textAnchor="middle" fill={NAVY} fontWeight="700">12 MONTH</text>
        <text x="76" y="132" fontSize="10" textAnchor="middle" fill={NAVY} fontWeight="700">WARRANTY</text>
      </motion.g>
    </svg>
  );
}

export default function BuildScroll() {
  const ref = useRef(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [stage, setStage] = useState(0);
  useMotionValueEvent(p, "change", (v) => setStage(Math.min(4, Math.max(0, Math.floor(v * 5)))));

  return (
    <section ref={ref} className="relative blueprint" style={{ height: "420vh" }} data-testid="build-scroll">
      <div className="sticky top-0 h-screen overflow-hidden">
        <div className="max-w-7xl mx-auto h-full px-6 md:px-12 grid md:grid-cols-2 gap-6 md:gap-12 items-center pt-20 pb-4">
          <div className="order-2 md:order-1">
            <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-3">Scroll to build your home</div>
            <div className="flex gap-2 mb-3" aria-hidden="true">
              {CONSTRUCTION_STEPS.map((s, i) => <div key={s.title} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i <= stage ? "bg-urbanex-gold" : "bg-white/15"}`}/>)}
            </div>
            <div key={stage} className="page-in">
              <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold">Stage {String(stage + 1).padStart(2, "0")} of 05</div>
              <h2 className="mt-2 font-display text-2xl md:text-5xl text-urbanex-ivory leading-tight">{CONSTRUCTION_STEPS[stage].title}</h2>
              <p className="mt-2 text-urbanex-ivory/75 leading-relaxed max-w-md text-sm md:text-base">{CONSTRUCTION_STEPS[stage].body}</p>
              <div className="mt-3 border-l-2 border-urbanex-gold pl-4 text-sm text-urbanex-ivory/90 max-w-md">
                <span className="block text-[10px] tracking-[0.28em] uppercase text-urbanex-gold mb-1">On site today</span>
                {SEE[stage]}
              </div>
            </div>
          </div>
          <div className="order-1 md:order-2 h-[34vh] md:h-[78vh]"><SiteSvg p={p}/></div>
        </div>
      </div>
    </section>
  );
}
