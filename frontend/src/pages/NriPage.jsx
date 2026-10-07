import PrivacyConsent from "@/components/common/PrivacyConsent";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { inrFull } from "@/lib/config";
import YouTubeClip from "@/components/videos/YouTubeClip";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useSeo } from "@/lib/seo";
import Turnstile, { TURNSTILE_ENABLED } from "@/components/common/Turnstile";
import { checkPhone, apiError } from "@/lib/phone";

const FALLBACK_TZ = ["America/New_York", "America/Chicago", "America/Los_Angeles", "America/Toronto", "Europe/London", "Europe/Berlin",
  "Asia/Dubai", "Asia/Singapore", "Australia/Sydney", "Asia/Kolkata"];
const timeZones = () => { try { return Intl.supportedValuesOf("timeZone"); } catch { return FALLBACK_TZ; } };
const localTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"; } catch { return "Asia/Kolkata"; } };
const inp = "w-full border border-urbanex-navy/15 rounded-lg px-3 py-2 text-sm bg-white";

// General information only. Have an advocate and a chartered accountant review this before launch.
const GUIDE = [
  { q: "Can an NRI or OCI buy property in India?",
    a: "Generally yes: NRIs and OCIs can buy residential and commercial property without special RBI permission. Agricultural land, plantation property and farmhouses are generally off-limits. Ask us to check a specific plot before you pay anything." },
  { q: "How should I pay?",
    a: "Through normal banking channels: inward remittance from abroad, or funds from your NRE, NRO or FCNR(B) account. Keep every transfer receipt. Large cash payments are restricted under Indian law, and a clean paper trail protects you when you later sell or repatriate." },
  { q: "Do I need a Power of Attorney?",
    a: "Only if you cannot be present. A POA lets a trusted person sign or follow up for you in India. Signed abroad, it normally needs notarisation or attestation by the Indian embassy or consulate (or an apostille, depending on the country), and must be stamped under the state's rules once in India. Give narrow, property-specific powers, and prefer a registered POA. A lawyer should draft it." },
  { q: "What about taxes and sending money back?",
    a: "Rental income and gains are taxable in India, and tax deducted at source when an NRI sells is higher than for residents. Sale proceeds can usually be repatriated within RBI limits and with tax paperwork (such as Forms 15CA/15CB). Treaty relief may apply depending on where you live. A chartered accountant who works with NRIs can give you the exact numbers." },
  { q: "What is 'eyes on the ground'?",
    a: "Ayan visits your plot, flat or construction site and sends you photos or a short video update, so you can see progress and spot problems early without flying in." },
];

function Converter() {
  const { t } = useI18n();
  const [rates, setRates] = useState(null);
  const [err, setErr] = useState(false);
  const [amount, setAmount] = useState("5000000");
  const [cur, setCur] = useState("USD");

  useEffect(() => { api.get("/nri/rates").then(r => (r.data.rates ? setRates(r.data) : setErr(true))).catch(() => setErr(true)); }, []);
  const rate = rates?.rates?.[cur];
  const num = parseFloat(amount);
  const out = rate && Number.isFinite(num) ? num * rate : null;

  return (
    <section className="bg-white rounded-3xl border border-urbanex-navy/10 p-6 md:p-8" data-testid="converter">
      <h2 className="font-display text-3xl text-urbanex-navy">{t("nri.fx.title")}</h2>
      {err ? <p className="mt-4 text-sm text-urbanex-navy/60">{t("nri.fx.error")}</p> : !rates ? <p className="mt-4 text-sm text-urbanex-navy/50">{t("common.loading")}</p> : (
        <>
          <div className="mt-5 grid sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
            <label className="text-xs text-urbanex-navy/60">{t("nri.fx.amount")}
              <input type="number" min="0" className={`${inp} mt-1`} value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="fx-amount"/>
            </label>
            <div className="hidden sm:block pb-2 text-urbanex-navy/40">=</div>
            <label className="text-xs text-urbanex-navy/60">
              <select className={`${inp} mt-1`} value={cur} onChange={(e) => setCur(e.target.value)} data-testid="fx-currency">
                {Object.keys(rates.rates).map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 font-display text-4xl text-urbanex-navy" data-testid="fx-result">
            {out == null ? "—" : `${out.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${cur}`}
          </div>
          <div className="mt-1 text-xs text-urbanex-navy/50">{Number.isFinite(num) ? inrFull(num) : ""}</div>
          <p className="mt-4 text-xs text-urbanex-navy/45">{t("nri.fx.rate", { date: rates.date || "", source: rates.source || "" })}</p>
        </>
      )}
    </section>
  );
}

function VideoBooking() {
  const { t } = useI18n();
  const { user } = useAuth();
  const zones = useMemo(timeZones, []);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    // IST calendar dates (the slots are defined in IST)
    const d = new Date(Date.now() + i * 86400000);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
  }), []);
  const [tz, setTz] = useState(localTz());
  const [day, setDay] = useState(days[1]);
  const [slots, setSlots] = useState([]);
  const [slot, setSlot] = useState(null);
  const [props, setProps] = useState([]);
  const [form, setForm] = useState({ property_id: "", name: user?.name || "", phone: "", email: user?.email || "", note: "" });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ts, setTs] = useState("");
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => { api.get("/properties").then(r => setProps(r.data || [])).catch(() => {}); }, []);
  useEffect(() => {
    let live = true;
    setSlot(null);
    api.get("/visits/slots", { params: { date: day, mode: "video" } }).then(r => { if (live) setSlots(r.data.slots || []); }).catch(() => { if (live) setSlots([]); });
    return () => { live = false; };
  }, [day]);

  const fmtLocal = (iso) => new Date(iso).toLocaleString("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

  const submit = async (e) => {
    e.preventDefault();
    if (!slot) return;
    const ph = checkPhone(form.phone);
    if (!ph.ok) { toast.error(ph.error); return; }
    setBusy(true);
    try {
      await api.post("/visits", { mode: "video", tz, slot, property_id: form.property_id || null, name: form.name, phone: ph.value, email: form.email, note: form.note || null, turnstile_token: ts || undefined });
      setDone(true); toast.success(t("nri.video.done"));
    } catch (err) {
      toast.error(apiError(err, "Please check your details (email is required)."));
    } finally { setBusy(false); setTs(""); }
  };

  if (done) return <div className="rounded-3xl bg-emerald-50 text-emerald-800 p-8" data-testid="nri-video-done">{t("nri.video.done")}</div>;
  return (
    <form onSubmit={submit} className="bg-white rounded-3xl border border-urbanex-navy/10 p-6 md:p-8 space-y-5" data-testid="nri-video-form">
      <h2 className="font-display text-3xl text-urbanex-navy">{t("nri.video.title")}</h2>
      <label className="block text-xs text-urbanex-navy/60">{t("nri.video.tz")}
        <select className={`${inp} mt-1`} value={tz} onChange={(e) => setTz(e.target.value)} data-testid="nri-tz">
          {(zones.includes(tz) ? zones : [tz, ...zones]).map(z => <option key={z}>{z}</option>)}
        </select>
      </label>
      <div>
        <div className="text-xs text-urbanex-navy/60 mb-2">{t("nri.video.day")}</div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.slice(1).map(d => (
            <button type="button" key={d} onClick={() => setDay(d)} className={`shrink-0 px-3 py-2 rounded-xl border text-xs ${day === d ? "bg-urbanex-navy text-urbanex-ivory border-urbanex-navy" : "border-urbanex-navy/15 hover:border-urbanex-gold"}`}>{d.slice(5)}</button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs text-urbanex-navy/60 mb-2">{t("nri.video.times")}</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {slots.filter(s => s.available).map(s => (
            <button type="button" key={s.start} onClick={() => setSlot(s.start)} data-testid="nri-slot"
              className={`py-2 px-2 rounded-lg text-xs border ${slot === s.start ? "bg-urbanex-gold text-urbanex-navy border-urbanex-gold" : "border-urbanex-navy/15 hover:border-urbanex-gold"}`}>{fmtLocal(s.start)}</button>
          ))}
          {!slots.some(s => s.available) && <div className="col-span-full text-sm text-urbanex-navy/50">{t("visit.noSlots")}</div>}
        </div>
      </div>
      <select className={inp} value={form.property_id} onChange={set("property_id")} aria-label={t("nri.video.property")}>
        <option value="">{t("nri.video.general")}</option>
        {props.filter(p => p.status !== "sold").map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
      <div className="grid sm:grid-cols-2 gap-3">
        <input required className={inp} placeholder={t("visit.name")} value={form.name} onChange={set("name")} maxLength={120}/>
        <input required className={inp} placeholder={t("visit.phone")} value={form.phone} onChange={set("phone")} inputMode="tel" pattern="[0-9+()\-\s]{6,20}"/>
      </div>
      <input required type="email" className={inp} placeholder={t("nri.video.email")} value={form.email} onChange={set("email")} maxLength={200}/>
      <textarea className={inp} rows={2} placeholder={t("visit.note")} value={form.note} onChange={set("note")} maxLength={500}/>
      <Turnstile value={ts} onChange={setTs}/>
      <PrivacyConsent tone="light"/>
      <button disabled={!slot || busy || (TURNSTILE_ENABLED && !ts)} data-testid="nri-video-submit" className="bg-urbanex-gold hover:bg-urbanex-goldHover text-urbanex-navy px-8 py-3 rounded-full text-sm font-medium disabled:opacity-50">{t("nri.video.submit")}</button>
    </form>
  );
}

function Updates() {
  const { t } = useI18n();
  const [posts, setPosts] = useState(null);
  useEffect(() => { api.get("/posts", { params: { category: "site-update" } }).then(r => setPosts(r.data)).catch(() => setPosts([])); }, []);
  return (
    <section>
      <h2 className="font-display text-3xl text-urbanex-navy">{t("nri.updates.title")}</h2>
      {posts && posts.length === 0 && <p className="mt-3 text-sm text-urbanex-navy/60">{t("nri.updates.empty")}</p>}
      <div className="mt-5 grid md:grid-cols-2 gap-6">
        {(posts || []).slice(0, 4).map(p => (
          <article key={p.id} className="bg-white rounded-2xl border border-urbanex-navy/10 p-4">
            {p.video_id && <YouTubeClip id={p.video_id} title={p.title}/>}
            <h3 className="mt-3 font-display text-xl text-urbanex-navy">{p.title}</h3>
            <div className="text-xs text-urbanex-navy/45">{(p.created_at || "").slice(0, 10)}</div>
            {p.excerpt && <p className="mt-2 text-sm text-urbanex-navy/70">{p.excerpt}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function LeadForm() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [f, setF] = useState({ name: user?.name || "", email: user?.email || "", phone: "", country: "", interest: "buy", message: "" });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ts, setTs] = useState("");
  const set = (k) => (e) => setF(c => ({ ...c, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    let phoneValue = null;
    if (f.phone.trim()) {
      const ph = checkPhone(f.phone);
      if (!ph.ok) { toast.error(ph.error); return; }
      phoneValue = ph.value;
    }
    setBusy(true);
    try {
      await api.post("/leads", {
        turnstile_token: ts || undefined,
        name: f.name, email: f.email || null, phone: phoneValue, source_page: "nri",
        property_interest: t(`nri.lead.${f.interest}`),
        message: `NRI enquiry from ${f.country || "abroad"}. ${f.message}`.slice(0, 2000),
      });
      setDone(true);
    } catch (err) { toast.error(apiError(err, "Please check your details and try again.")); }
    finally { setBusy(false); setTs(""); }
  };
  if (done) return <div className="rounded-3xl bg-emerald-50 text-emerald-800 p-8">{t("nri.lead.done")}</div>;
  return (
    <form onSubmit={submit} className="bg-urbanex-navy text-urbanex-ivory rounded-3xl p-6 md:p-8 space-y-4" data-testid="nri-lead-form">
      <h2 className="font-display text-3xl">{t("nri.lead.title")}</h2>
      <div className="grid sm:grid-cols-2 gap-3 text-urbanex-navy">
        <input required className={inp} placeholder={t("common.name")} value={f.name} onChange={set("name")} maxLength={120}/>
        <input required type="email" className={inp} placeholder={t("common.email")} value={f.email} onChange={set("email")} maxLength={200}/>
        <input className={inp} placeholder={`${t("common.phone")} / WhatsApp (+country code)`} value={f.phone} onChange={set("phone")} inputMode="tel" pattern="[0-9+()\-\s]{6,20}"/>
        <input className={inp} placeholder={t("nri.lead.country")} value={f.country} onChange={set("country")} maxLength={60}/>
        <select className={`${inp} sm:col-span-2`} value={f.interest} onChange={set("interest")} aria-label={t("nri.lead.interest")}>
          {["buy", "build", "care", "sell"].map(k => <option key={k} value={k}>{t(`nri.lead.${k}`)}</option>)}
        </select>
        <textarea className={`${inp} sm:col-span-2`} rows={3} placeholder={t("nri.lead.message")} value={f.message} onChange={set("message")} maxLength={1500}/>
      </div>
      <Turnstile value={ts} onChange={setTs}/>
      <PrivacyConsent tone="dark"/>
      <button disabled={busy || (TURNSTILE_ENABLED && !ts)} className="bg-urbanex-gold hover:bg-urbanex-goldHover text-urbanex-navy px-8 py-3 rounded-full text-sm font-medium disabled:opacity-50">{t("nri.lead.submit")}</button>
    </form>
  );
}

export default function NriPage() {
  const { t } = useI18n();
  useSeo({ title: "NRI desk: buy property in Burdwan from abroad", description: "Video visits in your time zone, currency conversion and on-the-ground updates for NRIs buying, building or managing property in Burdwan." });
  return (
    <div className="max-w-5xl mx-auto px-6 md:px-12 py-16 md:py-24 space-y-14">
      <header>
        <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-4">NRI</div>
        <h1 className="font-display text-5xl md:text-6xl text-urbanex-navy leading-[1.05] tracking-tight text-balance">{t("nri.title")}</h1>
        <p className="mt-6 text-urbanex-navy/70 max-w-2xl leading-relaxed">{t("nri.sub")}</p>
      </header>
      <VideoBooking/>
      <Converter/>
      <Updates/>
      <section>
        <h2 className="font-display text-3xl text-urbanex-navy">{t("nri.guide.title")}</h2>
        <div className="mt-5 divide-y divide-urbanex-navy/10 border border-urbanex-navy/10 rounded-2xl bg-white">
          {GUIDE.map(g => (
            <details key={g.q} className="group p-5">
              <summary className="cursor-pointer font-medium text-urbanex-navy list-none flex justify-between gap-4">{g.q}<span className="text-urbanex-gold group-open:rotate-45 transition-transform">+</span></summary>
              <p className="mt-3 text-sm text-urbanex-navy/75 leading-relaxed">{g.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-4 text-xs text-urbanex-navy/50" data-testid="nri-disclaimer">{t("nri.guide.disclaimer")}</p>
      </section>
      <LeadForm/>
    </div>
  );
}
