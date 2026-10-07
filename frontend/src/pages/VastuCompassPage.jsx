import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowRight, Camera, Compass, MessageCircle, Sparkles, Trash2, Wand2 } from "lucide-react";
import { api } from "@/lib/api";
import { useSeo } from "@/lib/seo";
import { waLink } from "@/lib/config";
import { checkPhone, apiError } from "@/lib/phone";
import Turnstile, { TURNSTILE_ENABLED } from "@/components/common/Turnstile";

const GRID = ["NW", "N", "NE", "W", "C", "E", "SW", "S", "SE"];
const ANGLE = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
const NAMES = { N: "North", NE: "North-East", E: "East", SE: "South-East", S: "South", SW: "South-West", W: "West", NW: "North-West", C: "Centre" };
const SHORT = { entrance: "Door", kitchen: "Kitchen", master_bedroom: "Master", bedroom: "Bedroom", pooja: "Pooja", living: "Living", dining: "Dining", toilet: "Toilet", staircase: "Stairs", water_underground: "Borewell", water_overhead: "Tank", study: "Study", store: "Store", garage: "Garage", balcony: "Balcony" };
const TONE = { ideal: "bg-emerald-400/90 text-emerald-950", good: "bg-emerald-300/90 text-emerald-950", ok: "bg-amber-300/90 text-amber-950", poor: "bg-orange-400/90 text-orange-950", wrong: "bg-red-500 text-white" };
const EXAMPLE = { facing: "S", rooms: { entrance: ["SW"], kitchen: ["NE"], pooja: ["SW"], master_bedroom: ["SE"], toilet: ["NE", "NW"], staircase: ["C"], bedroom: ["W"], living: ["N"] } };

export function Ring({ score }) {
  const pct = score == null ? 0 : score;
  const col = score == null ? "#64748b" : score >= 85 ? "#34d399" : score >= 70 ? "#C5A059" : score >= 50 ? "#fbbf24" : "#f87171";
  const C = 2 * Math.PI * 54;
  return (
    <svg viewBox="0 0 128 128" className="w-36 h-36" role="img" aria-label={score == null ? "No score yet" : `Vastu score ${score} out of 100`}>
      <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="9"/>
      <motion.circle cx="64" cy="64" r="54" fill="none" stroke={col} strokeWidth="9" strokeLinecap="round" strokeDasharray={C} transform="rotate(-90 64 64)"
        initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - pct / 100) }} transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}/>
      <text x="64" y="68" textAnchor="middle" className="font-display" fontSize="38" fill="#FDFBF7">{score ?? "–"}</text>
      <text x="64" y="86" textAnchor="middle" fontSize="9" letterSpacing="2" fill="rgba(253,251,247,.55)">OUT OF 100</text>
    </svg>
  );
}

export default function VastuCompassPage() {
  useSeo({ title: "Vastu Compass: check your house plan", description: "Place the rooms of your plan on the compass, or photograph your floor plan, and see at once what is right and what to fix." });
  const [catalog, setCatalog] = useState([]);
  const [facing, setFacing] = useState("E");
  const [rooms, setRooms] = useState({});
  const [active, setActive] = useState("kitchen");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState([]);
  const [lead, setLead] = useState({ name: "", phone: "" });
  const [ts, setTs] = useState("");
  const [sent, setSent] = useState(null);
  const fileRef = useRef(null);
  const seq = useRef(0);

  useEffect(() => { api.get("/vastu/rooms").then(r => setCatalog(r.data.rooms)).catch(() => {}); }, []);

  const has = useMemo(() => Object.values(rooms).some(d => d.length), [rooms]);
  useEffect(() => {
    if (!has) { setRes(null); return undefined; }
    const my = ++seq.current;
    const h = setTimeout(() => {
      api.post("/vastu/check", { facing, rooms }).then(r => { if (my === seq.current) setRes(r.data); }).catch(() => {});
    }, 250);
    return () => clearTimeout(h);
  }, [facing, rooms, has]);

  const verdict = useMemo(() => Object.fromEntries((res?.items || []).map(i => [`${i.room}:${i.direction}`, i.verdict])), [res]);
  const place = (dir) => {
    if (!active) { toast("Pick a room below first"); return; }
    setRooms(cur => {
      const list = cur[active] || [];
      const next = list.includes(dir) ? list.filter(d => d !== dir) : [...list, dir];
      const out = { ...cur, [active]: next };
      if (!next.length) delete out[active];
      return out;
    });
  };
  const clear = () => { setRooms({}); setNotes([]); setRes(null); };

  const readPhoto = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const fd = new FormData(); fd.append("file", f);
    setBusy(true); setNotes([]);
    try {
      const { data } = await api.post("/vastu/photo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setRooms(data.rooms || {});
      if (data.facing) setFacing(data.facing);
      const n = [...(data.unclear || [])];
      if (!data.north_found) n.unshift("No north arrow was found on the plan, so directions are a best guess. Check each room.");
      setNotes(n);
      toast.success(Object.keys(data.rooms || {}).length ? "Plan read. Check the rooms and fix anything wrong." : "I could not find rooms on that picture.");
    } catch (er) { toast.error(apiError(er, "Could not read that plan")); }
    finally { setBusy(false); e.target.value = ""; }
  };

  const send = async (e) => {
    e.preventDefault();
    const ph = checkPhone(lead.phone);
    if (lead.name.trim().length < 2 || !ph.ok) { toast.error(ph.ok ? "Please tell us your name" : ph.error); return; }
    if (!has) { toast.error("Place at least one room first"); return; }
    try {
      const { data } = await api.post("/vastu/report", { name: lead.name.trim(), phone: ph.value, facing, rooms, turnstile_token: ts || undefined });
      setSent(data); try { sessionStorage.setItem("urbanex_lead_given", "1"); } catch { /* ignore */ }
      toast.success("Your Vastu report is ready.");
    } catch (er) { toast.error(apiError(er, "Could not make the report. Please WhatsApp Ayan.")); } finally { setTs(""); }
  };

  const wa = waLink(`Hello Ayan, I checked my plan on the Vastu Compass${res ? ` (score ${res.score}/100)` : ""}. I would like a Vastu-first design.`);

  return (
    <div className="sec-dark min-h-screen" data-testid="vastu-page">
      <div className="aurora"/>
      <div className="max-w-7xl mx-auto px-5 md:px-10 pt-32 pb-24">
        <div className="max-w-3xl">
          <div className="chapter" data-n="∞">Vastu Compass</div>
          <h1 className="mt-5 font-display text-5xl md:text-7xl leading-[0.98] tracking-tight text-balance">
            <span className="mask-line" style={{ "--i": 0 }}><span>Does your plan</span></span>
            <span className="mask-line" style={{ "--i": 1 }}><span><em className="italic text-gold-gradient">obey the directions?</em></span></span>
          </h1>
          <p className="mt-6 text-lg text-urbanex-ivory/70 leading-relaxed max-w-2xl">Say which way the plot faces, then place each room on the compass. Or photograph your floor plan and let AI read it. You see in seconds what is right, what is wrong, and where each room should go instead.</p>
        </div>

        <div className="mt-14 grid lg:grid-cols-12 gap-8 items-start">
          {/* the board */}
          <div className="lg:col-span-7">
            <div className="glass-dark rounded-[2rem] p-4 md:p-8">
              <div className="flex flex-wrap items-center gap-2 mb-5" role="group" aria-label="Which way does the plot face?">
                <span className="text-[11px] tracking-[0.2em] uppercase text-urbanex-gold mr-1" title="The gold dot on the ring shows the side your entrance faces">Plot faces</span>
                {Object.keys(ANGLE).map(d => (
                  <button key={d} type="button" onClick={() => setFacing(d)} aria-pressed={facing === d} data-testid={`facing-${d}`}
                    className={`rounded-full px-3 py-1 text-xs border transition-colors ${facing === d ? "bg-urbanex-gold text-urbanex-navy border-urbanex-gold" : "border-white/20 text-urbanex-ivory/75 hover:border-urbanex-gold"}`}>{d}</button>
                ))}
              </div>

              <div className="relative mx-auto aspect-square w-full max-w-[560px]">
                {/* instrument ring */}
                <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full" aria-hidden="true">
                  <g className="ring-spin">
                    <circle cx="200" cy="200" r="196" fill="none" stroke="rgba(197,160,89,.35)" strokeWidth="1"/>
                    {Array.from({ length: 72 }).map((_, i) => { const a = (i * 5 * Math.PI) / 180, l = i % 6 === 0 ? 12 : 6; return <line key={i} x1={200 + 184 * Math.sin(a)} y1={200 - 184 * Math.cos(a)} x2={200 + (184 + l) * Math.sin(a)} y2={200 - (184 + l) * Math.cos(a)} stroke="rgba(197,160,89,.55)" strokeWidth="1"/>; })}
                  </g>
                  <g className="ring-spin-rev"><circle cx="200" cy="200" r="170" fill="none" stroke="rgba(255,255,255,.12)" strokeDasharray="2 7"/></g>
                  {[["N", 200, 22], ["E", 380, 205], ["S", 200, 388], ["W", 20, 205]].map(([t, x, y]) => <text key={t} x={x} y={y} textAnchor="middle" fontSize="15" fill="#C5A059" className="font-mono" fontWeight="600">{t}</text>)}
                </svg>
                {/* where the plot faces */}
                <motion.div className="absolute inset-0 pointer-events-none" animate={{ rotate: ANGLE[facing] }} transition={{ type: "spring", stiffness: 90, damping: 14 }} aria-hidden="true">
                  <div className="absolute left-1/2 top-[1%] -translate-x-1/2 flex flex-col items-center">
                    <span className="relative flex h-3 w-3"><span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-urbanex-gold"/><span className="relative inline-flex h-3 w-3 rounded-full bg-urbanex-gold"/></span>
                  </div>
                </motion.div>

                {/* the nine zones */}
                <div className="absolute inset-[12%] grid grid-cols-3 gap-1.5 md:gap-2" role="group" aria-label="The nine zones of the house">
                  {GRID.map(d => {
                    const here = Object.entries(rooms).filter(([, dirs]) => dirs.includes(d)).map(([k]) => k);
                    return (
                      <button key={d} type="button" onClick={() => place(d)} data-testid={`zone-${d}`} aria-label={`${NAMES[d]}${here.length ? ": " + here.map(k => SHORT[k]).join(", ") : ""}`}
                        className={`relative rounded-xl border text-left p-1.5 md:p-2 flex flex-col overflow-hidden transition-all ${d === "C" ? "border-dashed" : ""} ${here.length ? "bg-white/10 border-white/25" : "bg-white/[0.04] border-white/10 hover:bg-white/10 hover:border-urbanex-gold/60"}`}>
                        <span className="text-[9px] md:text-[10px] tracking-[0.18em] text-urbanex-gold/80 uppercase">{d === "C" ? "Centre" : d}</span>
                        <span className="mt-auto flex flex-wrap gap-1">
                          {here.map(k => <span key={k} className={`rounded-full px-1.5 py-0.5 text-[9px] md:text-[11px] leading-none font-medium ${TONE[verdict[`${k}:${d}`]] || "bg-white/80 text-urbanex-navy"}`}>{SHORT[k]}</span>)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* rooms */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2"><span className="text-[11px] tracking-[0.2em] uppercase text-urbanex-gold">1. Pick a room, 2. tap where it is</span>
                  {has && <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-xs text-urbanex-ivory/60 hover:text-red-300"><Trash2 className="w-3.5 h-3.5"/> Start again</button>}</div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Rooms">
                  {catalog.map(r => {
                    const n = (rooms[r.key] || []).length;
                    return <button key={r.key} type="button" onClick={() => setActive(r.key)} aria-pressed={active === r.key} data-testid={`room-${r.key}`}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${active === r.key ? "bg-urbanex-ivory text-urbanex-navy border-urbanex-ivory" : "border-white/20 text-urbanex-ivory/80 hover:border-urbanex-gold"}`}>{r.label}{n > 0 && <span className="ml-1.5 rounded-full bg-urbanex-gold text-urbanex-navy px-1.5">{n}</span>}</button>;
                  })}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} data-testid="vastu-photo" className="btn-shine inline-flex items-center gap-2 rounded-full bg-urbanex-gold text-urbanex-navy px-5 py-2.5 text-sm font-medium disabled:opacity-50"><Camera className="w-4 h-4"/>{busy ? "Reading your plan…" : "Read my plan from a photo"}</button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={readPhoto}/>
                <button type="button" onClick={() => { setFacing(EXAMPLE.facing); setRooms(EXAMPLE.rooms); setNotes([]); }} data-testid="vastu-example" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-2.5 text-sm text-urbanex-ivory/85 hover:border-urbanex-gold"><Wand2 className="w-4 h-4"/> Try an example</button>
              </div>
              {notes.length > 0 && <ul className="mt-4 text-xs text-amber-200/90 space-y-1">{notes.map((n, i) => <li key={i}>• {n}</li>)}</ul>}
            </div>
          </div>

          {/* the verdict */}
          <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-28">
            <div className="glass-dark rounded-[2rem] p-6 md:p-8" aria-live="polite" data-testid="vastu-result">
              <div className="flex items-center gap-5">
                <Ring score={res?.score ?? null}/>
                <div>
                  <div className="text-[11px] tracking-[0.2em] uppercase text-urbanex-gold">Verdict</div>
                  <div className="font-display text-3xl leading-tight" data-testid="vastu-grade">{res?.grade || "Place a room"}</div>
                  <div className="text-xs text-urbanex-ivory/55 mt-1">{res ? `${res.checked} placement${res.checked === 1 ? "" : "s"} checked` : "The score appears as you place rooms."}</div>
                </div>
              </div>
              {res?.facing_note && <p className="mt-5 text-sm text-urbanex-ivory/70 leading-relaxed border-l-2 border-urbanex-gold/60 pl-3">{res.facing_note}</p>}
              {res && res.must_fix.length > 0 && (
                <div className="mt-6">
                  <div className="text-[11px] tracking-[0.2em] uppercase text-red-300 mb-2">Fix these first</div>
                  <ul className="space-y-2.5">{res.must_fix.map((i, k) => (
                    <li key={k} className="rounded-xl bg-red-500/10 border border-red-400/25 p-3 text-sm"><div className="font-medium">{i.label} in the {i.direction_name}</div><div className="text-urbanex-ivory/70 text-[13px] mt-0.5">{i.fix}</div></li>))}</ul>
                </div>
              )}
              {res && res.must_fix.length === 0 && <p className="mt-5 rounded-xl bg-emerald-400/10 border border-emerald-300/25 p-3 text-sm text-emerald-100">Nothing is badly placed. A few rooms can still be improved, see below.</p>}
              {res && (
                <ul className="mt-5 divide-y divide-white/10 text-sm">{res.items.map((i, k) => (
                  <li key={k} className="py-2 flex items-start gap-3"><span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] ${TONE[i.verdict]}`}>{i.word}</span><div><span>{i.label}, {i.direction_name}</span>{i.fix && i.level === 2 && <div className="text-xs text-urbanex-ivory/55">{i.fix}</div>}</div></li>))}</ul>
              )}
              {res && <p className="mt-4 text-[11px] text-urbanex-ivory/40 leading-relaxed">{res.note}</p>}
            </div>

            <div className="rounded-[2rem] bg-urbanex-gold text-urbanex-navy p-6 md:p-8" data-testid="vastu-cta">
              <div className="flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase"><Compass className="w-4 h-4"/> Vastu first, always</div>
              <h2 className="mt-2 font-display text-3xl leading-tight">Get this as a report on WhatsApp</h2>
              <p className="mt-2 text-sm text-urbanex-navy/75">A page you can keep and forward to family, with every fix listed. Free. We design and build Vastu-first, and we say so when a plan breaks it.</p>
              {sent ? (
                <div className="mt-4 rounded-xl bg-white/60 p-4 text-sm space-y-3" data-testid="vastu-sent">
                  <p>Your report is ready and Ayan will also send it to your WhatsApp.</p>
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/vastu/report/${sent.token}`} className="inline-flex items-center gap-2 rounded-full bg-urbanex-navy text-urbanex-ivory px-5 py-2.5">Open my report <ArrowRight className="w-4 h-4"/></Link>
                    <a href={`https://wa.me/?text=${encodeURIComponent(`My Vastu report from Urbanex Realty: ${sent.score}/100. ${sent.link}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-urbanex-navy/40 px-5 py-2.5"><MessageCircle className="w-4 h-4"/> Share with family</a>
                  </div>
                </div>) : (
                <form onSubmit={send} className="mt-4 space-y-2.5">
                  <input value={lead.name} onChange={(e) => setLead(l => ({ ...l, name: e.target.value }))} placeholder="Your name" autoComplete="name" className="w-full rounded-xl bg-white/70 border border-urbanex-navy/10 px-4 py-3 text-sm placeholder:text-urbanex-navy/45" data-testid="vastu-name"/>
                  <input value={lead.phone} onChange={(e) => setLead(l => ({ ...l, phone: e.target.value }))} placeholder="Phone / WhatsApp" inputMode="tel" autoComplete="tel" className="w-full rounded-xl bg-white/70 border border-urbanex-navy/10 px-4 py-3 text-sm placeholder:text-urbanex-navy/45" data-testid="vastu-phone"/>
                  <Turnstile value={ts} onChange={setTs}/>
                  <div className="flex flex-wrap gap-2">
                    <button disabled={TURNSTILE_ENABLED && !ts} className="inline-flex items-center gap-2 rounded-full bg-urbanex-navy text-urbanex-ivory px-5 py-3 text-sm disabled:opacity-50" data-testid="vastu-send">Send my report <ArrowRight className="w-4 h-4"/></button>
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-urbanex-navy/40 px-5 py-3 text-sm"><MessageCircle className="w-4 h-4"/> WhatsApp</a>
                  </div>
                </form>
              )}
              <Link to="/construction#vastu" className="mt-4 inline-flex items-center gap-1.5 text-xs underline underline-offset-4"><Sparkles className="w-3.5 h-3.5"/> How we build Vastu-first</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
