import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Link2, MapPin, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { assetUrl, inr, shareUrl } from "@/lib/config";
import { useAuth } from "@/context/AuthContext";
import { useViewer } from "@/context/ViewerContext";
import { useI18n } from "@/context/I18nContext";
import { useSeo } from "@/lib/seo";
import Turnstile, { TURNSTILE_ENABLED } from "@/components/common/Turnstile";
import { checkPhone, apiError } from "@/lib/phone";

// key -> answer values (labels come from i18n: quiz.a.<value>, with education using quiz.a.edu.<value>)
const QUESTIONS = [
  { key: "budget", options: ["b1", "b2", "b3", "b4", "b5"] },
  { key: "purpose", options: ["live", "invest", "build", "commercial"] },
  { key: "family", options: ["small", "medium", "large"] },
  { key: "commute", options: ["station", "bus", "car", "low"] },
  { key: "vibe", options: ["quiet", "balanced", "lively"] },
  { key: "education", options: ["low", "some", "high"] },
  { key: "timeline", options: ["now", "year", "flexible"] },
  { key: "space", options: ["compact", "comfortable", "spacious"] },
];
const label = (t, q, v) => t(q === "education" ? `quiz.a.edu.${v}` : `quiz.a.${v}`);

function Quiz({ onDone }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const q = QUESTIONS[step];

  const pick = async (v) => {
    const next = { ...answers, [q.key]: v };
    setAnswers(next);
    if (step < QUESTIONS.length - 1) { setStep(step + 1); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/quiz/recommend", next);
      onDone(data);
    } catch (e) {
      toast.error(e?.response?.status === 429 ? "Too many tries, please wait a minute." : "Could not run the quiz. Please try again.");
      setBusy(false);
    }
  };

  if (busy) return <div className="py-24 text-center text-urbanex-navy/60">{t("quiz.working")}</div>;
  return (
    <div data-testid="quiz">
      <div className="text-xs text-urbanex-navy/50 mb-3">{t("quiz.step", { n: step + 1, total: QUESTIONS.length })}</div>
      <div className="h-1.5 rounded-full bg-urbanex-navy/10 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={QUESTIONS.length} aria-valuenow={step + 1}>
        <div className="h-full bg-urbanex-gold transition-all" style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }}/>
      </div>
      <h2 className="mt-8 font-display text-3xl md:text-4xl text-urbanex-navy" data-testid="quiz-question">{t(`quiz.q.${q.key}`)}</h2>
      <div className="mt-6 grid sm:grid-cols-2 gap-3">
        {q.options.map(v => (
          <button key={v} type="button" onClick={() => pick(v)} data-testid={`quiz-opt-${v}`}
            className={`text-left px-5 py-4 rounded-2xl border bg-white hover:border-urbanex-gold transition-colors ${answers[q.key] === v ? "border-urbanex-gold" : "border-urbanex-navy/10"}`}>
            {label(t, q.key, v)}
          </button>
        ))}
      </div>
      {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="mt-6 inline-flex items-center gap-1 text-sm text-urbanex-navy/60 hover:text-urbanex-navy"><ArrowLeft className="w-4 h-4"/> {t("quiz.back")}</button>}
    </div>
  );
}

function LeadForm({ id }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [f, setF] = useState({ name: user?.name || "", phone: "", email: user?.email || "" });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ts, setTs] = useState("");
  const set = (k) => (e) => setF(c => ({ ...c, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    const ph = checkPhone(f.phone);
    if (!ph.ok) { toast.error(ph.error); return; }
    setBusy(true);
    try { await api.post(`/quiz/results/${id}/lead`, { name: f.name, phone: ph.value, email: f.email || null, turnstile_token: ts || undefined }); setDone(true); }
    catch (err) { toast.error(apiError(err, "Please check your phone number and try again.")); }
    finally { setBusy(false); setTs(""); }
  };
  const inp = "w-full border border-urbanex-navy/15 rounded-lg px-3 py-2 text-sm bg-white";
  if (done) return <div className="mt-10 rounded-2xl bg-emerald-50 text-emerald-800 p-6" data-testid="quiz-lead-done">{t("quiz.lead.done")}</div>;
  return (
    <form onSubmit={submit} className="mt-10 rounded-2xl bg-urbanex-navy text-urbanex-ivory p-6 md:p-8 space-y-4" data-testid="quiz-lead-form">
      <h3 className="font-display text-2xl">{t("quiz.lead.title")}</h3>
      <p className="text-sm text-urbanex-ivory/70">{t("quiz.lead.body")}</p>
      <div className="grid sm:grid-cols-2 gap-3 text-urbanex-navy">
        <input required className={inp} placeholder={t("quiz.lead.name")} value={f.name} onChange={set("name")} maxLength={120}/>
        <input required className={inp} placeholder={t("quiz.lead.phone")} value={f.phone} onChange={set("phone")} inputMode="tel" pattern="[0-9+()\-\s]{6,20}"/>
      </div>
      <Turnstile value={ts} onChange={setTs}/>
      <button disabled={busy || (TURNSTILE_ENABLED && !ts)} className="bg-urbanex-gold hover:bg-urbanex-goldHover text-urbanex-navy px-6 py-2.5 rounded-full text-sm font-medium disabled:opacity-50">{t("quiz.lead.submit")}</button>
    </form>
  );
}

function Results({ id, data, onRetake }) {
  const { t } = useI18n();
  const { unlocked } = useViewer();
  const link = shareUrl("quiz", id);
  const top = data.results.map(r => r.zone).join(", ");
  const copy = async () => { try { await navigator.clipboard.writeText(link); toast.success(t("share.copied")); } catch { toast.error(link); } };
  const text = `My best-fit zones in Burdwan: ${top}`;
  const btn = "inline-flex items-center gap-2 text-xs px-4 py-2 rounded-full border border-urbanex-navy/15 hover:border-urbanex-gold text-urbanex-navy/80";
  return (
    <div data-testid="quiz-results">
      <h2 className="font-display text-4xl text-urbanex-navy">{t("quiz.result.title")}</h2>
      <div className="mt-8 space-y-6">
        {data.results.map((r, i) => (
          <section key={r.zone} className="bg-white rounded-3xl border border-urbanex-navy/10 p-6 md:p-8" data-testid={`quiz-zone-${i}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs tracking-[0.28em] uppercase text-urbanex-gold">#{i + 1}</div>
                <h3 className="font-display text-3xl text-urbanex-navy flex items-center gap-2"><MapPin className="w-5 h-5 text-urbanex-gold"/> {r.zone}</h3>
              </div>
              <div className="text-sm font-medium bg-urbanex-gold/15 text-urbanex-navy rounded-full px-4 py-1.5">{t("quiz.result.fit", { n: r.score })}</div>
            </div>
            <ul className="mt-4 space-y-1.5 text-sm text-urbanex-navy/75">
              {r.reasons.map(x => <li key={x} className="flex gap-2"><span className="w-1.5 h-1.5 rounded-full bg-urbanex-gold mt-2 shrink-0"/>{x}</li>)}
            </ul>
            <div className="mt-5 text-xs tracking-[0.2em] uppercase text-urbanex-navy/50">{t("quiz.result.listings")}</div>
            {r.listings.length === 0 ? <div className="mt-2 text-sm text-urbanex-navy/50">{t("quiz.result.none")}</div> : (
              <div className="mt-3 grid sm:grid-cols-3 gap-3">
                {r.listings.map(l => (
                  <Link key={l.id} to={`/properties/${l.slug || l.id}`} className="group block rounded-xl overflow-hidden border border-urbanex-navy/10 hover:border-urbanex-gold">
                    <img src={assetUrl(l.image, 480)} alt="" loading="lazy" className="w-full aspect-video object-cover"/>
                    <div className="p-3">
                      <div className="text-sm font-medium text-urbanex-navy line-clamp-1 group-hover:text-urbanex-gold">{l.title}</div>
                      <div className="text-xs text-urbanex-navy/60">{l.bedrooms ? `${l.bedrooms} BHK · ` : ""}{l.area_sqft} sqft{unlocked("property", l.id)?.price_inr ? ` · ${inr(unlocked("property", l.id).price_inr)}` : ""}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <Link to={`/properties?zone=${encodeURIComponent(r.zone)}`} className="mt-4 inline-block text-sm text-urbanex-navy underline decoration-urbanex-gold underline-offset-4">{t("quiz.result.browse", { zone: r.zone })}</Link>
          </section>
        ))}
      </div>
      <p className="mt-4 text-xs text-urbanex-navy/45">{data.note}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <a className={btn} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${link}`)}`}><MessageCircle className="w-3.5 h-3.5"/> {t("quiz.share")}</a>
        <button type="button" className={btn} onClick={copy}><Link2 className="w-3.5 h-3.5"/> {t("share.copy")}</button>
        {navigator.share && <button type="button" className={btn} onClick={() => navigator.share({ title: "Find your zone", text, url: link }).catch(() => {})}><Share2 className="w-3.5 h-3.5"/> {t("share.title")}</button>}
        <button type="button" className={btn} onClick={onRetake}>{t("quiz.retake")}</button>
      </div>
      <LeadForm id={id}/>
    </div>
  );
}

export default function ZoneQuizPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t } = useI18n();
  const { loading, user } = useAuth();
  const [data, setData] = useState(null);
  const [expired, setExpired] = useState(false);
  const [started, setStarted] = useState(!!id);
  useSeo({ title: "Find your zone in Burdwan", description: "Answer eight quick questions and find the Burdwan zones that fit your budget, family and lifestyle." });

  useEffect(() => {
    if (!id || loading) return;
    api.get(`/quiz/results/${id}`).then(r => { setData(r.data); setExpired(false); }).catch(() => setExpired(true));
  }, [id, loading, user?.user_id]);

  const done = (d) => { setData(d); nav(`/zone-quiz/r/${d.id}`, { replace: true }); };
  const retake = () => { setData(null); setStarted(true); setExpired(false); nav("/zone-quiz", { replace: true }); };

  return (
    <div className="max-w-3xl mx-auto px-6 md:px-12 py-16 md:py-24">
      {!data && !started && !expired && (
        <div>
          <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-4">Urbanex</div>
          <h1 className="font-display text-5xl md:text-6xl text-urbanex-navy leading-[1.05] tracking-tight text-balance">{t("quiz.title")}</h1>
          <p className="mt-6 text-urbanex-navy/70 max-w-xl leading-relaxed">{t("quiz.intro")}</p>
          <button onClick={() => setStarted(true)} data-testid="quiz-start" className="mt-8 bg-urbanex-navy hover:bg-urbanex-navyLight text-urbanex-ivory px-8 py-3 rounded-full">{t("quiz.start")}</button>
        </div>
      )}
      {expired && (
        <div>
          <p className="text-urbanex-navy/70">{t("quiz.expired")}</p>
          <button onClick={retake} className="mt-6 bg-urbanex-navy text-urbanex-ivory px-6 py-2.5 rounded-full text-sm">{t("quiz.retake")}</button>
        </div>
      )}
      {!data && started && !expired && !id && <Quiz onDone={done}/>}
      {data && <Results id={data.id} data={data} onRetake={retake}/>}
    </div>
  );
}
