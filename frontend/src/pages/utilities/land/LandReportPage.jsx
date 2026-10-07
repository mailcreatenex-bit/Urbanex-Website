import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Clock, Copy, Download, FileText, MessageCircle } from "lucide-react";
import LandShell from "@/pages/utilities/LandShell";
import Turnstile, { TURNSTILE_ENABLED } from "@/components/common/Turnstile";
import { api } from "@/lib/api";
import { assetUrl, inrFull, waLink } from "@/lib/config";
import { checkPhone } from "@/lib/phone";
import { useSeo } from "@/lib/seo";

const KEY = "urbanex_land_report";
const inp = "w-full border border-urbanex-navy/15 rounded-lg px-3 py-2.5 text-sm bg-white";
const errText = (err, fallback) => { const d = err?.response?.data?.detail; return typeof d === "string" ? d : Array.isArray(d) ? d.map(x => x.msg?.replace(/^Value error, /, "")).join("; ") : fallback; };

function RequestForm({ info }) {
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", phone: "", district: "Purba Bardhaman", block: "", mouza: "", jl_no: "", plot_no: "", khatian_no: "", note: "" });
  const [ts, setTs] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(() => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } });
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const ph = checkPhone(f.phone);
    if (!ph.ok) return toast.error(ph.error);
    setBusy(true);
    try {
      const body = Object.fromEntries(Object.entries({ ...f, phone: ph.value, turnstile_token: ts || undefined }).map(([k, v]) => [k, v === "" ? null : v]));
      const { data } = await api.post("/land-reports", body);
      try { localStorage.setItem(KEY, JSON.stringify({ id: data.id, token: data.token })); } catch { /* storage blocked */ }
      nav(`/utilities/land-report/${data.id}?t=${data.token}`);
    } catch (err) { toast.error(errText(err, "Could not send the request")); } finally { setBusy(false); setTs(""); }
  };

  if (info && !info.enabled) return <div className="rounded-2xl bg-white border p-8 text-urbanex-navy/70">This service is not taking requests right now. You can still <Link to="/utilities/khatian-reader" className="underline">read a record you already have with AI</Link>, or <Link to="/contact" className="underline">contact us</Link>.</div>;
  return (
    <div className="grid lg:grid-cols-5 gap-8">
      <form onSubmit={submit} className="lg:col-span-3 rounded-2xl bg-white border border-urbanex-navy/5 p-6 grid grid-cols-2 gap-3 text-xs text-urbanex-navy/60" data-testid="land-report-form">
        <label className="col-span-2">Your name<input required className={`${inp} mt-1`} value={f.name} onChange={set("name")}/></label>
        <label className="col-span-2">Your phone / WhatsApp<input required type="tel" inputMode="tel" className={`${inp} mt-1`} value={f.phone} onChange={set("phone")} placeholder="98300 12345" data-testid="lr-phone"/></label>
        <label className="col-span-2">District<input required className={`${inp} mt-1`} value={f.district} onChange={set("district")}/></label>
        <label>Block<input className={`${inp} mt-1`} value={f.block} onChange={set("block")}/></label>
        <label>Mouza<input required className={`${inp} mt-1`} value={f.mouza} onChange={set("mouza")} data-testid="lr-mouza"/></label>
        <label>JL no<input className={`${inp} mt-1`} value={f.jl_no} onChange={set("jl_no")}/></label>
        <label>Plot (dag) no<input className={`${inp} mt-1`} value={f.plot_no} onChange={set("plot_no")} data-testid="lr-plot"/></label>
        <label className="col-span-2">Khatian no<input className={`${inp} mt-1`} value={f.khatian_no} onChange={set("khatian_no")}/></label>
        <label className="col-span-2">Anything else we should know<textarea rows={2} className={`${inp} mt-1`} maxLength={500} value={f.note} onChange={set("note")}/></label>
        <div className="col-span-2"><Turnstile value={ts} onChange={setTs}/></div>
        <button disabled={busy || (TURNSTILE_ENABLED && !ts)} data-testid="lr-submit" className="col-span-2 bg-urbanex-navy text-urbanex-ivory rounded-full py-3 text-sm disabled:opacity-50">{busy ? "Sending…" : `Continue to pay ${info ? inrFull(info.price) : ""}`}</button>
      </form>
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-2xl bg-urbanex-navy text-urbanex-ivory p-6">
          <div className="font-display text-4xl">{info ? inrFull(info.price) : "…"}</div>
          <div className="text-sm text-urbanex-ivory/70">per record, {info?.turnaround}</div>
          <ul className="mt-4 space-y-2 text-sm text-urbanex-ivory/85 list-disc pl-5">
            <li>We fetch the official Banglar Bhumi record for your plot or khatian.</li>
            <li>You get it as a PDF plus a plain-language summary in English and Bengali.</li>
            <li>We point out anything worth checking before you pay for the land.</li>
          </ul>
        </div>
        {saved && <Link to={`/utilities/land-report/${saved.id}?t=${saved.token}`} className="block rounded-2xl border bg-white p-4 text-sm hover:border-urbanex-gold">See your earlier request →</Link>}
        <p className="text-xs text-urbanex-navy/45">Have the record already? <Link to="/utilities/khatian-reader" className="underline">Read it with AI</Link> for free.</p>
      </div>
    </div>
  );
}

function PayPanel({ r, token, onDone }) {
  const [utr, setUtr] = useState("");
  const [payer, setPayer] = useState("");
  const [busy, setBusy] = useState(false);
  const pay = r.pay;
  const upi = `upi://pay?pa=${encodeURIComponent(pay.upi_id)}&pn=${encodeURIComponent(pay.upi_name || "Urbanex Realty")}&am=${pay.amount}&cu=INR&tn=${encodeURIComponent(`Land report ${r.id.slice(-6)}`)}`;
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const { data } = await api.post(`/land-reports/${r.id}/payment`, { utr: utr.trim(), payer_upi: payer.trim() || null }, { params: { t: token } }); toast.success("Thank you! We will confirm it shortly."); onDone(data); }
    catch (err) { toast.error(errText(err, "Enter the 12-digit UPI reference number")); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-2xl bg-urbanex-cream p-6 grid md:grid-cols-[auto_1fr] gap-6" data-testid="lr-pay">
      <div className="text-center">
        {pay.qr_image ? <img src={assetUrl(pay.qr_image, 400)} alt="UPI QR code" className="w-44 h-44 object-contain rounded-xl bg-white p-2 mx-auto"/> : <div className="w-44 h-44 rounded-xl bg-white flex items-center justify-center text-xs text-gray-400">QR coming soon</div>}
        <div className="mt-2 text-xs text-urbanex-navy/60">Scan with any UPI app</div>
      </div>
      <div>
        <div className="text-xs tracking-[0.2em] uppercase text-urbanex-gold mb-1">1. Pay {inrFull(pay.amount)}</div>
        <div className="text-sm flex flex-wrap items-center gap-2">UPI ID <b>{pay.upi_id}</b>
          <button type="button" onClick={() => navigator.clipboard?.writeText(pay.upi_id).then(() => toast.success("Copied")).catch(() => {})} className="inline-flex items-center gap-1 text-xs border rounded-full px-2.5 py-1"><Copy className="w-3 h-3"/> Copy</button>
          <a href={upi} className="text-xs bg-urbanex-navy text-urbanex-ivory rounded-full px-3 py-1.5 md:hidden">Open my UPI app</a></div>
        {r.status === "payment_rejected" && <div className="mt-2 rounded-lg bg-red-50 text-red-700 text-sm p-3">We could not confirm your last payment: {r.reject_reason}. Please check and send the reference again.</div>}
        <form onSubmit={submit} className="mt-4">
          <div className="text-xs tracking-[0.2em] uppercase text-urbanex-gold mb-1">2. Send us the reference</div>
          <div className="flex flex-wrap gap-2">
            <input required value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="UPI reference / UTR (12 digits)" inputMode="numeric" maxLength={30} className={`${inp} flex-1 min-w-[200px]`} data-testid="lr-utr"/>
            <input value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="Your UPI ID (optional)" maxLength={100} className={`${inp} flex-1 min-w-[160px]`}/>
          </div>
          <button disabled={busy || !utr.trim()} data-testid="lr-pay-submit" className="mt-3 bg-urbanex-navy text-urbanex-ivory rounded-full px-6 py-2.5 text-sm disabled:opacity-50">{busy ? "Sending…" : "I have paid"}</button>
        </form>
      </div>
    </div>
  );
}

function Status({ id, token }) {
  const [r, setR] = useState(null);
  const [missing, setMissing] = useState(false);
  const load = useCallback(() => api.get(`/land-reports/${id}`, { params: { t: token } }).then(x => setR(x.data)).catch(() => setMissing(true)), [id, token]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {      // check back while we are working on it
    if (!r || ["delivered"].includes(r.status)) return undefined;
    const h = setInterval(load, 25000);
    return () => clearInterval(h);
  }, [r, load]);

  if (missing) return <div className="rounded-2xl bg-white border p-8">We could not find this report. Check the link, or <Link to="/utilities/land-report" className="underline">start a new request</Link>.</div>;
  if (!r) return <div className="text-urbanex-navy/50">Loading…</div>;
  const where = [r.mouza, r.block, r.district].filter(Boolean).join(", ");
  const steps = [["awaiting_payment", "Pay"], ["payment_submitted", "We check the payment"], ["paid", "We fetch the record"], ["delivered", "Ready"]];
  const at = r.status === "payment_rejected" ? 0 : Math.max(0, steps.findIndex(s => s[0] === r.status));

  return (
    <div className="space-y-6" data-testid="lr-status">
      <div className="rounded-2xl bg-white border border-urbanex-navy/5 p-5">
        <div className="text-xs text-urbanex-navy/50">Your request</div>
        <div className="font-display text-2xl text-urbanex-navy">{where}</div>
        <div className="text-sm text-urbanex-navy/70">Plot {r.plot_no || "-"} · Khatian {r.khatian_no || "-"}{r.jl_no ? ` · JL ${r.jl_no}` : ""}</div>
        <ol className="mt-4 grid grid-cols-4 gap-2 text-[11px]">{steps.map(([k, l], i) => <li key={k} className={`rounded-lg px-2 py-2 text-center ${i <= at ? "bg-urbanex-gold/25 text-urbanex-navy" : "bg-gray-100 text-gray-400"}`}>{l}</li>)}</ol>
      </div>

      {(r.status === "awaiting_payment" || r.status === "payment_rejected") && <PayPanel r={r} token={token} onDone={setR}/>}
      {r.status === "payment_submitted" && <div className="rounded-2xl bg-amber-50 border border-amber-200 p-6 flex gap-3"><Clock className="w-5 h-5 text-amber-700 shrink-0"/><div><b>We are checking your payment.</b><div className="text-sm text-urbanex-navy/70">This usually takes a short while. This page updates by itself, and you can come back to this link any time.</div></div></div>}
      {r.status === "paid" && <div className="rounded-2xl bg-sky-50 border border-sky-200 p-6 flex gap-3"><Clock className="w-5 h-5 text-sky-700 shrink-0"/><div><b>Payment confirmed. We are getting your record.</b><div className="text-sm text-urbanex-navy/70">Expect it {r.turnaround}. Bookmark this page, the report will appear here.</div></div></div>}
      {r.status === "delivered" && (
        <div className="space-y-4" data-testid="lr-delivered">
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6"><div className="flex items-center gap-2 font-medium text-emerald-800"><CheckCircle2 className="w-5 h-5"/> Your report is ready</div>{r.message && <p className="mt-2 text-sm text-urbanex-navy/80">{r.message}</p>}</div>
          <div className="grid sm:grid-cols-2 gap-3">{(r.files || []).map((f, i) => <a key={i} href={assetUrl(f.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl bg-white border p-4 hover:border-urbanex-gold"><FileText className="w-6 h-6 text-urbanex-gold"/><span className="flex-1 truncate text-sm">{f.name}</span><Download className="w-4 h-4"/></a>)}</div>
          {r.ai && (
            <div className="rounded-2xl bg-white border p-5 space-y-3">
              <div className="text-xs tracking-[0.2em] uppercase text-urbanex-gold">In plain words</div>
              <p className="text-urbanex-navy/85 leading-relaxed">{r.ai.summary_en}</p>
              {r.ai.summary_bn && <p className="text-urbanex-navy/85 leading-relaxed">{r.ai.summary_bn}</p>}
              {r.ai.concerns?.length > 0 && <ul className="list-disc pl-5 text-sm text-urbanex-navy/80">{r.ai.concerns.map((c, i) => <li key={i}><b>{c.title}.</b> {c.why}</li>)}</ul>}
              <p className="text-xs text-urbanex-navy/45">{r.ai.disclaimer}</p>
            </div>
          )}
          <a href={waLink(`Hi Ayan, I have my land report for ${where} (plot ${r.plot_no || "-"}). Can we talk about it?`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#25D366] text-white px-6 py-3 text-sm"><MessageCircle className="w-4 h-4"/> Talk to Ayan about this plot</a>
        </div>
      )}
    </div>
  );
}

export default function LandReportPage() {
  useSeo({ title: "Get a land record report", description: "We fetch the official West Bengal land record for your plot or khatian and explain it in plain English and Bengali." });
  const { id } = useParams();
  const [sp] = useSearchParams();
  const [info, setInfo] = useState(null);
  useEffect(() => { if (!id) api.get("/land-reports/info").then(r => setInfo(r.data)).catch(() => setInfo({ enabled: false })); }, [id]);
  return (
    <LandShell title="Land record report" intro={id ? "Follow your report here." : "Give us the plot or khatian number. We get the official record for you, and explain what it says."}>
      {id ? <Status id={id} token={sp.get("t") || ""}/> : <RequestForm info={info}/>}
    </LandShell>
  );
}
