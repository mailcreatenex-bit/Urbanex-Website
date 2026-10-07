import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Compass, Eye, FileCheck2, Layers, MessageCircle, ShieldCheck, Sun, Video, XOctagon } from "lucide-react";

const U = (id, w = 1400) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=70&w=${w}`;
export const PICS = {
  plans: "1503387762-592deb58ef4e",
  rebar: "1504307651254-35680f356dfd",
  crew: "1541888946425-d81bb19240f5",
  cctv: "1557597774-9d273605dfa9",
  carpenter: "1589939705384-5185137a7f0f",
  electric: "1621905251189-08b45d6a269e",
  villa: "1600596542815-ffad4c1539a9",
  home: "1558036117-15d82a90b9b1",
  living: "1600607687939-ce8a6c25118c",
  kitchen: "1600585152220-90363fe7e115",
  renovate: "1517581177682-a085bb7ffb15",
};

const rise = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { duration: 0.6 } };
const Eyebrow = ({ children }) => <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-4">{children}</div>;
const Photo = ({ id, alt, className = "", w = 1400 }) => <img src={U(PICS[id], w)} alt={alt} loading="lazy" decoding="async" className={`w-full h-full object-cover ${className}`}/>;

// ----------------------------------------------------------------- Vastu first
const ZONES = [
  ["NW", "North-West", "Guest room, garage, toilets", "Air element. Movement and guests."],
  ["N", "North", "Living room, cash and study", "Kubera's side. Wealth and opportunity."],
  ["NE", "North-East", "Prayer room, water, open and light", "Ishanya. Keep it clean, open and low."],
  ["W", "West", "Dining, children's room, stairs", "Gains and growth."],
  ["C", "Centre", "Left open (Brahmasthan)", "No toilet, stairs, pillar or heavy load."],
  ["E", "East", "Entrance, living, windows", "Morning light and fresh energy."],
  ["SW", "South-West", "Master bedroom, heavy walls", "Stability. The strongest, heaviest corner."],
  ["S", "South", "Bedrooms, storage", "Rest. Fewer and smaller openings."],
  ["SE", "South-East", "Kitchen", "Agni, the fire corner."],
];

export function VastuFirst() {
  const [on, setOn] = useState("NE");
  const z = ZONES.find(x => x[0] === on);
  return (
    <section id="vastu" data-testid="vastu-first" className="relative bg-[#fbf6ea] overflow-hidden">
      <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #0a1225 1px, transparent 0)", backgroundSize: "26px 26px" }} aria-hidden="true"/>
      <div className="relative max-w-7xl mx-auto px-6 md:px-12 py-24">
        <motion.div {...rise} className="max-w-3xl">
          <Eyebrow>Our rule, not an add-on</Eyebrow>
          <h2 className="font-display text-4xl md:text-6xl text-urbanex-navy leading-[1.02] tracking-tight text-balance">Vastu first. <em className="italic text-urbanex-gold">Then everything else.</em></h2>
          <p className="mt-5 text-lg text-urbanex-navy/75 leading-relaxed">Most builders draw a house and then ask a priest to bless it. We do it the other way round. Before a single wall is drawn, the plot is read by its direction, slope, road and entrance, and the rooms are placed where Vastu Shastra says they belong. Looks, budget and fittings are then worked out inside that frame.</p>
        </motion.div>

        <div className="mt-14 grid lg:grid-cols-5 gap-10 items-start">
          {/* the nine zones */}
          <motion.div {...rise} className="lg:col-span-3">
            <div className="grid grid-cols-3 gap-2 md:gap-3 max-w-xl" role="group" aria-label="The nine Vastu zones of a plot">
              {ZONES.map(([k, name]) => (
                <button key={k} type="button" onClick={() => setOn(k)} onMouseEnter={() => setOn(k)} aria-pressed={on === k}
                  className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center text-center p-1 transition-all ${on === k ? "bg-urbanex-navy border-urbanex-gold text-urbanex-ivory scale-[1.04] shadow-xl" : "bg-white border-urbanex-navy/10 text-urbanex-navy hover:border-urbanex-gold/70"}`}>
                  <span className="font-display text-2xl md:text-3xl">{k}</span>
                  <span className={`text-[10px] md:text-xs ${on === k ? "text-urbanex-gold" : "text-urbanex-navy/55"}`}>{name}</span>
                </button>
              ))}
            </div>
            <div className="mt-5 max-w-xl rounded-xl bg-white border border-urbanex-gold/40 p-5" aria-live="polite" data-testid="vastu-zone">
              <div className="text-[11px] tracking-[0.2em] uppercase text-urbanex-gold">{z[1]}</div>
              <div className="font-display text-2xl text-urbanex-navy mt-1">{z[2]}</div>
              <div className="text-sm text-urbanex-navy/65 mt-1">{z[3]}</div>
            </div>
            <p className="mt-3 text-xs text-urbanex-navy/45 max-w-xl">Traditional Vastu Shastra placements, shown as a guide. Every plot is different, and the exact layout is settled with you on your own plot.</p>
          </motion.div>

          <motion.div {...rise} className="lg:col-span-2 space-y-5">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-[0_30px_60px_-30px_rgba(10,18,37,.5)]">
              <Photo id="plans" alt="An architect drawing a house plan by hand on paper" w={1100}/>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-urbanex-navy/90 to-transparent p-5 text-urbanex-ivory text-sm">Plans start from the plot's direction, never from a catalogue design.</div>
            </div>
            <ul className="space-y-3">
              {[[Compass, "Plot read first", "Direction, road side, slope, shape and nearby structures decide the layout."], [Sun, "Entrance and light", "Main door placed in the auspicious pada for your plot's facing, with morning sun let in from the east."], [Layers, "Room by room", "Kitchen, bedrooms, pooja, stairs, toilets and water tanks each sit in their proper zone."]].map(([I, t, d]) => (
                <li key={t} className="flex gap-3"><I className="w-5 h-5 mt-0.5 text-urbanex-gold shrink-0"/><div><div className="font-medium text-urbanex-navy">{t}</div><div className="text-sm text-urbanex-navy/65">{d}</div></div></li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* the rule we hold to */}
        <motion.div {...rise} className="mt-16 rounded-3xl bg-urbanex-navy text-urbanex-ivory p-8 md:p-12 grid md:grid-cols-5 gap-8 items-center" data-testid="vastu-pledge">
          <div className="md:col-span-3">
            <div className="inline-flex items-center gap-2 text-xs tracking-[0.24em] uppercase text-urbanex-gold"><XOctagon className="w-4 h-4"/> Our promise, in plain words</div>
            <h3 className="mt-3 font-display text-3xl md:text-4xl leading-tight text-balance">We will not build against Vastu.</h3>
            <ol className="mt-5 space-y-3 text-urbanex-ivory/80 leading-relaxed list-decimal pl-5">
              <li>If a design you bring breaks Vastu, <b className="text-urbanex-ivory">we tell you clearly and in writing</b> which part, why, and what we suggest instead. Often a small change fixes it.</li>
              <li>If you still want it that way, <b className="text-urbanex-ivory">we step away from the project</b>, politely, and return what is yours.</li>
              <li>We would rather lose a contract than put our name on a home we would not live in ourselves.</li>
            </ol>
          </div>
          <div className="md:col-span-2 rounded-2xl bg-white/5 border border-white/10 p-6">
            <div className="text-[11px] tracking-[0.2em] uppercase text-urbanex-gold">Why we are strict</div>
            <p className="mt-2 text-sm text-urbanex-ivory/75 leading-relaxed">A family lives in the house for decades. If Vastu matters to you, it must be right from the foundation: corners and walls cannot be moved after the slab is cast. Being firm early saves you from regret later.</p>
            <a href="#estimate" className="mt-5 inline-flex items-center gap-2 rounded-full bg-urbanex-gold text-urbanex-navy px-5 py-2.5 text-sm font-medium">Get a Vastu-first design <span aria-hidden="true">→</span></a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------- 24/7 cameras and materials
const CAMS = [
  ["CAM 01", "Main gate", "crew", "People in and out. Vehicles and deliveries."],
  ["CAM 02", "Material store", "rebar", "Cement, steel and sand: what came, what is used."],
  ["CAM 03", "Ground floor", "carpenter", "Shuttering, bar-bending, bricklaying."],
  ["CAM 04", "Upper floors", "electric", "Slab, electrical, plumbing and finishing."],
];

function Clock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  return <>{t.toLocaleDateString("en-GB")} {t.toLocaleTimeString("en-GB")}</>;
}

export function SiteEyes() {
  return (
    <section id="cctv" data-testid="cctv-section" className="bg-[#0b1426] text-urbanex-ivory relative overflow-hidden">
      <div className="absolute inset-0 opacity-30"><Photo id="cctv" alt="" className="opacity-20 grayscale" w={1800}/></div>
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b1426] via-[#0b1426]/85 to-[#0b1426]"/>
      <div className="relative max-w-7xl mx-auto px-6 md:px-12 py-24">
        <motion.div {...rise} className="max-w-3xl">
          <div className="inline-flex items-center gap-2 text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-4"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/> Recording now</div>
          <h2 className="font-display text-4xl md:text-6xl leading-[1.02] tracking-tight text-balance">Every house we build has <em className="italic text-urbanex-gold">eyes on it, all day and all night.</em></h2>
          <p className="mt-5 text-lg text-urbanex-ivory/75 leading-relaxed">The moment work begins, we install CCTV cameras on your site. They record 24 hours a day, 7 days a week, and you get a private link to watch. You can check the work, see which material is going in, and know that nothing is going missing, from your office, from another city or from another country.</p>
        </motion.div>

        {/* camera wall (an illustration of what you get) */}
        <motion.div {...rise} className="mt-12 grid sm:grid-cols-2 gap-3 md:gap-4" aria-label="Illustration of the live camera view">
          {CAMS.map(([id, name, pic, what], i) => (
            <figure key={id} className="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-black">
              <Photo id={pic} alt={`${name} camera view (illustration)`} className="grayscale contrast-125 brightness-75" w={900}/>
              <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,.14)_0px,rgba(0,0,0,.14)_1px,transparent_1px,transparent_3px)] pointer-events-none"/>
              <div className="absolute top-3 left-3 flex items-center gap-2 text-[11px] font-mono"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/>REC · {id}</div>
              <div className="absolute top-3 right-3 text-[11px] font-mono bg-black/50 px-2 py-0.5 rounded">{name}</div>
              <figcaption className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 to-transparent">
                <div className="text-[11px] font-mono text-urbanex-gold">{i === 0 ? <Clock/> : "24/7 · night vision"}</div>
                <div className="text-sm text-urbanex-ivory/90">{what}</div>
              </figcaption>
            </figure>
          ))}
        </motion.div>
        <p className="mt-2 text-[11px] text-urbanex-ivory/40">Pictures are for illustration. Your link shows your own site.</p>

        <div className="mt-16 grid md:grid-cols-3 gap-5">
          {[
            [Video, "24/7 recording", "Cameras at the gate, the material store and each working floor, recording day and night, with night vision. A power cut does not mean a blind spot."],
            [Eye, "You see the work", "A private link just for you, on your phone or computer. Ask us to show any day or any hour, and we will."],
            [Layers, "You see the material", "Which cement, which steel, which bricks and sand are in use and from which delivery. Compare them with the bills and weighment slips in your weekly report."],
            [ShieldCheck, "Safe from theft and swaps", "Material cannot quietly leave the gate, and cheaper material cannot quietly replace what you paid for."],
            [Camera, "Proof, not promises", "Disputes about what was done and when are settled by the footage, in your favour and ours."],
            [MessageCircle, "Questions answered", "Spot something odd at night? Message Ayan on WhatsApp and get an answer, with the footage if needed."],
          ].map(([I, t, d], i) => (
            <motion.div key={t} {...rise} transition={{ duration: 0.5, delay: i * 0.06 }} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 hover:border-urbanex-gold/50 transition-colors">
              <I className="w-6 h-6 text-urbanex-gold"/>
              <div className="mt-4 font-display text-xl">{t}</div>
              <div className="mt-2 text-sm text-urbanex-ivory/65 leading-relaxed">{d}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------- materials you can check
const CHECKS = [
  ["Cement", "Brand and grade on the bag", "Bags counted at the gate, bill photographed, stock checked against use each week."],
  ["Steel (TMT bars)", "Grade and diameter as per the drawing", "Weighed on delivery, slip photographed, bars checked before every slab is cast."],
  ["Bricks and blocks", "Type and size as agreed", "Counted at unloading, broken or under-fired ones rejected on the spot."],
  ["Sand and aggregate", "Clean, as agreed", "Checked for silt and quantity before it enters the store."],
  ["Concrete", "Mix as designed", "Mixed to ratio, cubes taken for testing where the stage needs them."],
  ["Electrical and plumbing", "Brand and gauge as agreed", "Fitted only after you have seen the sample, and photographed before it is covered up."],
];

export function MaterialTrail() {
  return (
    <section id="materials" className="max-w-7xl mx-auto px-6 md:px-12 py-24" data-testid="material-trail">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <motion.div {...rise}>
          <Eyebrow>Know what is inside your walls</Eyebrow>
          <h2 className="font-display text-4xl md:text-5xl text-urbanex-navy leading-tight tracking-tight text-balance">Every material, checked and shown to you.</h2>
          <p className="mt-5 text-urbanex-navy/75 leading-relaxed">Once the plaster is on, nobody can see the steel behind it. That is why we show you before it is covered: the material list is agreed in writing before work starts, and each delivery is checked against it, photographed and filed. Together with the cameras, you can follow your build from any distance.</p>
          <div className="mt-6 relative aspect-[16/9] rounded-2xl overflow-hidden shadow-xl"><Photo id="rebar" alt="Steel reinforcement bars laid for a slab while workers check them" w={1200}/></div>
        </motion.div>
        <motion.div {...rise} className="rounded-2xl bg-white border border-urbanex-navy/10 divide-y divide-urbanex-navy/10 shadow-[0_20px_50px_-30px_rgba(10,18,37,.4)]">
          {CHECKS.map(([k, a, b]) => (
            <div key={k} className="p-5 flex gap-4">
              <FileCheck2 className="w-5 h-5 text-urbanex-gold shrink-0 mt-0.5"/>
              <div><div className="font-display text-lg text-urbanex-navy">{k}</div><div className="text-sm text-urbanex-navy/80">{a}</div><div className="text-xs text-urbanex-navy/55 mt-0.5">{b}</div></div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------- the stages, with pictures
const STAGES = [
  ["01", "Plot study and Vastu plan", "We visit, measure, read the directions and agree the layout with you before any money is spent on construction.", "plans"],
  ["02", "Design, estimate, approvals", "A drawing, a line-by-line estimate and the material list in writing. Municipal approval is handled with you.", "home"],
  ["03", "Foundation and structure", "Excavation, footing, columns, beams and slabs. Cameras go up on day one and stay until handover.", "crew"],
  ["04", "Walls, services and plaster", "Brickwork, electrical and plumbing laid and photographed before they are covered.", "electric"],
  ["05", "Woodwork and finishing", "Doors, windows, flooring, paint and fittings, checked against the samples you chose.", "carpenter"],
  ["06", "Handover", "A walk-through with you, a snag list fixed, and the 12-month written warranty begins.", "villa"],
];

export function Stages() {
  return (
    <section id="stages" className="bg-white" data-testid="stages">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-24">
        <motion.div {...rise} className="max-w-2xl"><Eyebrow>From plot to keys</Eyebrow>
          <h2 className="font-display text-4xl md:text-5xl text-urbanex-navy leading-tight tracking-tight text-balance">Six stages. You sign off every one.</h2></motion.div>
        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {STAGES.map(([n, t, d, pic], i) => (
            <motion.article key={n} {...rise} transition={{ duration: 0.5, delay: (i % 3) * 0.08 }} className="group rounded-2xl overflow-hidden bg-urbanex-ivory border border-urbanex-navy/10 hover:shadow-2xl hover:-translate-y-1 transition-all">
              <div className="relative aspect-[4/3] overflow-hidden"><Photo id={pic} alt={t} w={900} className="group-hover:scale-105 transition-transform duration-700"/><div className="absolute top-3 left-3 font-display text-3xl text-urbanex-ivory drop-shadow">{n}</div></div>
              <div className="p-5"><h3 className="font-display text-xl text-urbanex-navy">{t}</h3><p className="mt-2 text-sm text-urbanex-navy/70 leading-relaxed">{d}</p></div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------- questions
const FAQ = [
  ["What if my design is not Vastu-friendly?", "We will point out exactly what is wrong and suggest a fix, in writing. If you still want to go ahead against Vastu, we respectfully step away from the project. Vastu first is our rule, and we do not make exceptions."],
  ["How do I watch the cameras?", "You are given a private link for your site only. Open it on a phone or computer. If you cannot find something, ask Ayan on WhatsApp and we will show you."],
  ["Can I see which materials are being used?", "Yes. The agreed material list, the delivery bills and weighment slips, the weekly site diary and the cameras together show what comes in and what goes into the work."],
  ["Do you work only in Burdwan?", "We build in and around Burdwan. For a plot further away, write to us and we will tell you honestly whether we can supervise it properly."],
  ["How long does a house take?", "It depends on the size and the season. We give you a stage-by-stage schedule with the estimate, and the weekly report shows how it is going."],
  ["Is there a warranty?", "Yes, a 12-month written warranty from handover."],
];

export function Questions() {
  return (
    <section className="max-w-4xl mx-auto px-6 md:px-12 py-20" data-testid="construction-faq">
      <motion.div {...rise}><Eyebrow>Before you ask</Eyebrow><h2 className="font-display text-4xl text-urbanex-navy tracking-tight">Straight answers</h2></motion.div>
      <div className="mt-8 divide-y divide-urbanex-navy/10 border-y border-urbanex-navy/10">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group py-4">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-medium text-urbanex-navy"><span>{q}</span><span className="text-urbanex-gold text-xl group-open:rotate-45 transition-transform" aria-hidden="true">+</span></summary>
            <p className="mt-3 text-urbanex-navy/70 leading-relaxed">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
