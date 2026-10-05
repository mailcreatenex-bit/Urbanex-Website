import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { buildGreeting } from "@/lib/greeting";

const SEEN = "urbanex_seen";
const NAMED = "urbanex_greet_named";

// Uses the name on roughly every other visit; the choice is kept for the browser session so it does not flip while browsing.
function callByName() {
  try {
    const v = sessionStorage.getItem(NAMED);
    if (v !== null) return v === "1";
    const pick = Math.random() < 0.5;
    sessionStorage.setItem(NAMED, pick ? "1" : "0");
    return pick;
  } catch { return true; }
}

// A friendly line under the hero: time of day in Burdwan, the visitor's name when signed in, and a wish on festival days.
export default function GreetingBand() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const [returning, setReturning] = useState(false);
  const [useName] = useState(callByName);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    try { setReturning(!!localStorage.getItem(SEEN)); localStorage.setItem(SEEN, "1"); } catch { /* storage blocked */ }
    const tick = setInterval(() => setNow(new Date()), 5 * 60 * 1000);   // follows the clock if the tab stays open
    return () => clearInterval(tick);
  }, []);

  const g = useMemo(() => buildGreeting({ now, lang, name: user?.name || null, returning, useName }),
    [now, lang, user?.name, returning, useName]);
  const cta = lang === "bn" ? "নতুন বাড়ি দেখুন" : "See the new homes";

  return (
    <section data-testid="greeting" className={`px-6 md:px-12 ${g.special ? "bg-gradient-to-r from-urbanex-gold/20 via-urbanex-cream to-urbanex-gold/20" : "bg-urbanex-cream"}`}>
      <div className="max-w-7xl mx-auto py-6 md:py-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <span className="text-3xl md:text-4xl" aria-hidden="true">{g.emoji}</span>
        <div className="flex-1 min-w-[240px]">
          <h2 className="font-display text-2xl md:text-3xl text-urbanex-navy leading-tight" data-testid="greeting-title">{g.title}</h2>
          <p className="mt-1 text-sm md:text-base text-urbanex-navy/70" data-testid="greeting-text">{g.text}</p>
        </div>
        <Link to="/properties" className="group inline-flex items-center gap-2 text-sm text-urbanex-navy hover:text-urbanex-gold">
          {cta} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1"/>
        </Link>
      </div>
    </section>
  );
}
