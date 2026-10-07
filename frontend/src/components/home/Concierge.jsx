import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Mic, Play, Search, Square, Volume2 } from "lucide-react";
import { api } from "@/lib/api";
import { assetUrl } from "@/lib/config";

const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const LANGS = [["en-IN", "English"], ["bn-IN", "বাংলা"], ["hi-IN", "हिन्दी"]];
const IDEAS = ["3BHK flat near Goda under 60 lakh", "plot in Borehat", "villa with a garden", "গোদায় ২ বিএইচকে ভাড়া", "shop for rent in Kalibazar"];
const KEY = { en: "en-IN", bn: "bn-IN", hi: "hi-IN" };

// "Just say what you want": speak or type it in any of three languages and the site finds the homes and video tours.
export default function Concierge() {
  const [text, setText] = useState("");
  const [lang, setLang] = useState("en-IN");
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null);
  const [error, setError] = useState("");
  const [talk, setTalk] = useState(false);
  const rec = useRef(null);
  const sendRef = useRef(null);

  useEffect(() => () => { rec.current?.abort?.(); window.speechSynthesis?.cancel?.(); }, []);

  const ask = async (q) => {
    const t = (q ?? text).trim();
    if (t.length < 2) return;
    setBusy(true); setError(""); setOut(null);
    try {
      const { data } = await api.post("/concierge", { text: t });
      setOut(data);
      if (talk && window.speechSynthesis) {
        try { const u = new SpeechSynthesisUtterance(data.reply); u.lang = KEY[data.language] || "en-IN"; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch { /* no voice for this language */ }
      }
    } catch (e) { setError(e?.response?.status === 429 ? "Many people are asking right now. Try again in a minute." : "Could not search just now. Please try again."); }
    finally { setBusy(false); }
  };
  sendRef.current = ask;

  const listen = () => {
    if (!SR) return;
    const r = new SR();
    r.lang = lang; r.interimResults = true; r.continuous = false;
    let said = "";
    r.onresult = (e) => { said = [...e.results].map(x => x[0].transcript).join(" "); setText(said); };
    r.onerror = () => setOn(false);
    r.onend = () => { setOn(false); if (said.trim().length > 1) sendRef.current(said); };
    try { r.start(); rec.current = r; setOn(true); setOut(null); } catch { setOn(false); }
  };
  const stop = () => rec.current?.stop();

  const u = out?.understood || {};
  const chips = [u.bedrooms && `${u.bedrooms} BHK`, u.property_type, u.zone, u.listing_type === "rent" ? "for rent" : null, u.max_budget_inr && `up to ₹${(u.max_budget_inr / 100000).toLocaleString("en-IN", { maximumFractionDigits: 1 })} L`, out?.vastu && "Vastu-first"].filter(Boolean);

  return (
    <section id="concierge" className="sec-dark" data-testid="concierge">
      <div className="aurora"/>
      <div className="max-w-5xl mx-auto px-5 md:px-10 py-24 md:py-32 text-center">
        <div className="chapter" data-n="01">Ask Urbanex</div>
        <h2 className="mt-5 font-display text-5xl md:text-7xl leading-[0.98] tracking-tight text-balance">Just <em className="italic text-gold-gradient">say</em> what you want.</h2>
        <p className="mt-5 text-urbanex-ivory/65 max-w-xl mx-auto">Speak or type, in English, বাংলা or हिन्दी. We understand the area, the size and the budget, and show you what fits.</p>

        <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="mt-10 glass-dark rounded-full p-2 pl-6 flex items-center gap-2 max-w-3xl mx-auto focus-within:border-urbanex-gold/70 transition-colors" role="search">
          <Search className="w-5 h-5 text-urbanex-gold shrink-0" aria-hidden="true"/>
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder={on ? "Listening…" : "e.g. 3BHK flat near Goda under 60 lakh"} aria-label="What are you looking for?" data-testid="concierge-input"
            className="flex-1 min-w-0 bg-transparent outline-none text-base md:text-lg text-urbanex-ivory placeholder:text-urbanex-ivory/40 py-3"/>
          {SR && (
            <button type="button" onClick={on ? stop : listen} aria-label={on ? "Stop listening" : "Speak"} aria-pressed={on} data-testid="concierge-mic"
              className={`relative grid place-items-center h-12 w-12 rounded-full shrink-0 ${on ? "bg-red-500 text-white" : "bg-white/10 text-urbanex-gold hover:bg-white/20"}`}>
              {on && <span className="pulse-ring absolute inset-0 rounded-full bg-red-500/60"/>}
              {on ? <Square className="relative w-4 h-4"/> : <Mic className="relative w-5 h-5"/>}
            </button>
          )}
          <button disabled={busy || text.trim().length < 2} data-testid="concierge-go" className="btn-shine shrink-0 inline-flex items-center gap-2 rounded-full bg-urbanex-gold text-urbanex-navy px-5 md:px-7 h-12 text-sm font-medium disabled:opacity-50">{busy ? "Finding…" : "Find"} <ArrowRight className="w-4 h-4"/></button>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
          {SR && <div className="inline-flex rounded-full border border-white/15 overflow-hidden" role="group" aria-label="Speaking language">{LANGS.map(([k, l]) => <button key={k} type="button" onClick={() => setLang(k)} aria-pressed={lang === k} className={`px-3 py-1.5 ${lang === k ? "bg-urbanex-gold text-urbanex-navy" : "text-urbanex-ivory/70 hover:text-urbanex-ivory"}`}>{l}</button>)}</div>}
          <button type="button" onClick={() => setTalk(v => !v)} aria-pressed={talk} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${talk ? "border-urbanex-gold text-urbanex-gold" : "border-white/15 text-urbanex-ivory/60"}`}><Volume2 className="w-3.5 h-3.5"/> Read answers aloud</button>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {IDEAS.map(i => <button key={i} type="button" onClick={() => { setText(i); ask(i); }} className="rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-xs text-urbanex-ivory/70 hover:border-urbanex-gold hover:text-urbanex-ivory transition-colors">{i}</button>)}
        </div>
        {!SR && <p className="mt-4 text-[11px] text-urbanex-ivory/40">Voice works in Chrome and Edge. You can type here in any browser.</p>}

        <div aria-live="polite" className="mt-10 text-left">
          {error && <p className="text-center text-red-300 text-sm">{error}</p>}
          <AnimatePresence mode="wait">
            {out && (
              <motion.div key={out.reply + chips.join()} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} data-testid="concierge-out">
                <p className="text-center font-display text-3xl md:text-4xl text-urbanex-ivory">{out.reply}</p>
                {chips.length > 0 && <div className="mt-3 flex flex-wrap justify-center gap-2">{chips.map(c => <span key={c} className="rounded-full bg-urbanex-gold/15 border border-urbanex-gold/40 text-urbanex-gold px-3 py-1 text-xs">{c}</span>)}</div>}
                <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {out.properties.map((p, i) => (
                    <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                      <Link to={`/properties/${p.slug || p.id}`} className="group block rounded-2xl overflow-hidden glass-dark hover:border-urbanex-gold/60 transition-colors">
                        <div className="aspect-[4/3] overflow-hidden bg-white/5">{p.image && <img src={assetUrl(p.image, 600)} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/>}</div>
                        <div className="p-4"><div className="font-display text-xl leading-tight">{p.title}</div><div className="mt-1 text-xs text-urbanex-ivory/60">{[p.zone, p.bedrooms ? `${p.bedrooms} BHK` : null, p.area_sqft ? `${p.area_sqft} sqft` : null].filter(Boolean).join(" · ")}</div></div>
                      </Link>
                    </motion.div>
                  ))}
                  {out.videos.map((v, i) => (
                    <motion.div key={v.video_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (out.properties.length + i) * 0.06 }}>
                      <Link to={`/properties/video/${v.video_id}`} className="group block rounded-2xl overflow-hidden glass-dark hover:border-urbanex-gold/60 transition-colors">
                        <div className="relative aspect-video overflow-hidden"><img src={v.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/><span className="absolute inset-0 grid place-items-center"><span className="grid place-items-center h-12 w-12 rounded-full bg-black/55 backdrop-blur"><Play className="w-5 h-5 text-white"/></span></span></div>
                        <div className="p-4"><div className="text-sm line-clamp-2">{v.title}</div><div className="mt-1 text-xs text-urbanex-gold">Video tour{v.zone ? ` · ${v.zone}` : ""}</div></div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Link to={out.url} className="inline-flex items-center gap-2 rounded-full bg-urbanex-gold text-urbanex-navy px-6 py-3 text-sm font-medium">See all matches <ArrowRight className="w-4 h-4"/></Link>
                  {out.vastu && <Link to="/vastu" className="inline-flex items-center gap-2 rounded-full border border-urbanex-gold/60 text-urbanex-gold px-6 py-3 text-sm">Check a plan on the Vastu Compass</Link>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
