import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { CalendarCheck, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { useSeo } from "@/lib/seo";

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// The page a customer opens from the link Ayan sends on WhatsApp: pick a day, pick a time, done.
export default function BookVisitPage() {
  const { token } = useParams();
  useSeo({ title: "Pick a time for your visit" });
  const [info, setInfo] = useState(null);
  const [gone, setGone] = useState(false);
  const [day, setDay] = useState(null);
  const [slots, setSlots] = useState([]);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const days = useMemo(() => Array.from({ length: 10 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d; }), []);

  useEffect(() => { api.get(`/visit-links/${token}`).then(r => setInfo(r.data)).catch(() => setGone(true)); }, [token]);
  useEffect(() => { if (!day || !info) return; setSlots([]); api.get("/visits/slots", { params: { date: ymd(day), mode: info.mode } }).then(r => setSlots(r.data.slots)).catch(() => setSlots([])); }, [day, info]);

  const book = async (slot) => {
    setBusy(true);
    try { const { data } = await api.post(`/visit-links/${token}/book`, { slot: slot.start }); setDone(data); }
    catch (e) { toast.error(typeof e?.response?.data?.detail === "string" ? e.response.data.detail : "Could not book that time"); }
    finally { setBusy(false); }
  };

  if (gone) return <div className="max-w-xl mx-auto px-6 py-24 text-center text-urbanex-navy/70">This link has expired or was already used. Please ask Ayan to send a new one on WhatsApp.</div>;
  if (!info) return <div className="max-w-xl mx-auto px-6 py-24 text-center text-urbanex-navy/50">Loading…</div>;
  if (done || info.used) return (
    <div className="max-w-xl mx-auto px-6 py-24 text-center" data-testid="book-done">
      <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto"/>
      <h1 className="font-display text-4xl text-urbanex-navy mt-4">{done ? "You are booked" : "Already booked"}</h1>
      {done && <p className="mt-3 text-urbanex-navy/75">{done.title}<br/><b>{done.when}</b></p>}
      <p className="mt-4 text-sm text-urbanex-navy/60">You will get a reminder on WhatsApp before the visit.</p>
    </div>
  );
  return (
    <div className="max-w-2xl mx-auto px-6 py-16" data-testid="book-visit">
      <div className="flex items-center gap-2 text-xs tracking-[0.28em] uppercase text-urbanex-gold"><CalendarCheck className="w-4 h-4"/> Urbanex Realty</div>
      <h1 className="font-display text-4xl text-urbanex-navy mt-2">Hello {(info.name || "").split(" ")[0]}, pick a time</h1>
      <p className="mt-2 text-urbanex-navy/70">{info.mode === "video" ? "A video call with Ayan." : <>A visit to <b>{info.property?.title}</b>{info.property?.zone ? ` (${info.property.zone})` : ""}.</>}</p>
      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">{days.map(d => (
        <button key={ymd(d)} onClick={() => setDay(d)} aria-pressed={day && ymd(day) === ymd(d)} className={`shrink-0 rounded-xl border px-4 py-3 text-center ${day && ymd(day) === ymd(d) ? "bg-urbanex-navy text-urbanex-ivory border-urbanex-navy" : "bg-white hover:border-urbanex-gold"}`}>
          <div className="text-[11px] uppercase">{d.toLocaleDateString("en-IN", { weekday: "short" })}</div><div className="font-display text-2xl">{d.getDate()}</div><div className="text-[11px]">{d.toLocaleDateString("en-IN", { month: "short" })}</div></button>))}</div>
      {day && <div className="mt-5 grid grid-cols-3 sm:grid-cols-4 gap-2" data-testid="slots">{slots.map(s => <button key={s.start} disabled={!s.available || busy} onClick={() => book(s)} className="rounded-lg border bg-white py-3 text-sm hover:border-urbanex-gold disabled:opacity-30 disabled:cursor-not-allowed">{s.label}</button>)}
        {slots.length > 0 && !slots.some(s => s.available) && <div className="col-span-full text-sm text-urbanex-navy/60">Nothing free that day. Please try another day.</div>}</div>}
    </div>
  );
}
