import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { useAuth } from "@/context/AuthContext";
import Turnstile, { TURNSTILE_ENABLED } from "@/components/common/Turnstile";
import { checkPhone, apiError } from "@/lib/phone";

const ymd = (d) => {
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

export default function VisitBooking({ propertyId }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; }), []);
  const [day, setDay] = useState(ymd(days[1]));
  const [slots, setSlots] = useState([]);
  const [slot, setSlot] = useState(null);
  const [form, setForm] = useState({ name: user?.name || "", phone: "", email: user?.email || "", note: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [ts, setTs] = useState("");

  useEffect(() => {
    let live = true;
    setSlot(null);
    api.get("/visits/slots", { params: { date: day } }).then(r => { if (live) setSlots(r.data.slots || []); }).catch(() => { if (live) setSlots([]); });
    return () => { live = false; };
  }, [day]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!slot) return;
    const ph = checkPhone(form.phone);
    if (!ph.ok) { toast.error(ph.error); return; }
    setBusy(true);
    try {
      await api.post("/visits", {
        property_id: propertyId, name: form.name, phone: ph.value,
        email: form.email || null, note: form.note || null, slot, turnstile_token: ts || undefined,
      });
      setDone(true);
      toast.success(t("visit.done"));
    } catch (err) {
      toast.error(apiError(err, "Please check your details."));
      api.get("/visits/slots", { params: { date: day } }).then(r => setSlots(r.data.slots || [])).catch(() => {});
    } finally { setBusy(false); setTs(""); }
  };

  if (done) return <div className="mt-6 rounded-xl bg-emerald-50 text-emerald-800 p-4 text-sm" data-testid="visit-done">{t("visit.done")}</div>;

  const input = "w-full border border-urbanex-navy/15 rounded-lg px-3 py-2 text-sm bg-white";
  return (
    <form onSubmit={submit} className="mt-6 space-y-4" data-testid="visit-form">
      <h3 className="font-display text-2xl text-urbanex-navy flex items-center gap-2"><CalendarCheck className="w-5 h-5 text-urbanex-gold"/> {t("visit.title")}</h3>
      <div>
        <div className="text-xs text-urbanex-navy/60 mb-2">{t("visit.pickDate")}</div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.slice(1).map(d => (
            <button type="button" key={ymd(d)} onClick={() => setDay(ymd(d))}
              className={`shrink-0 w-14 py-2 rounded-xl border text-center text-xs ${day === ymd(d) ? "bg-urbanex-navy text-urbanex-ivory border-urbanex-navy" : "border-urbanex-navy/15 hover:border-urbanex-gold"}`}>
              <div>{d.toLocaleDateString("en-IN", { weekday: "short" })}</div>
              <div className="text-base font-medium">{d.getDate()}</div>
              <div>{d.toLocaleDateString("en-IN", { month: "short" })}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs text-urbanex-navy/60 mb-2">{t("visit.pickTime")}</div>
        {slots.some(s => s.available) ? (
          <div className="grid grid-cols-3 gap-2">
            {slots.map(s => (
              <button type="button" key={s.start} disabled={!s.available} onClick={() => setSlot(s.start)}
                data-testid={`visit-slot-${s.label.replace(/[: ]/g, "")}`}
                className={`py-2 rounded-lg text-xs border ${slot === s.start ? "bg-urbanex-gold text-urbanex-navy border-urbanex-gold" : s.available ? "border-urbanex-navy/15 hover:border-urbanex-gold" : "border-urbanex-navy/5 text-urbanex-navy/30 line-through cursor-not-allowed"}`}>
                {s.label}
              </button>
            ))}
          </div>
        ) : <div className="text-sm text-urbanex-navy/50">{t("visit.noSlots")}</div>}
      </div>
      <input required className={input} placeholder={t("visit.name")} value={form.name} onChange={set("name")} maxLength={120} data-testid="visit-name"/>
      <input required className={input} placeholder={t("visit.phone")} value={form.phone} onChange={set("phone")} inputMode="tel" pattern="[0-9+()\-\s]{6,20}" data-testid="visit-phone"/>
      <input type="email" className={input} placeholder={t("visit.email")} value={form.email} onChange={set("email")} maxLength={200}/>
      <textarea className={input} placeholder={t("visit.note")} value={form.note} onChange={set("note")} maxLength={500} rows={2}/>
      <Turnstile value={ts} onChange={setTs}/>
      <button type="submit" disabled={!slot || busy || (TURNSTILE_ENABLED && !ts)} data-testid="visit-submit"
        className="w-full bg-urbanex-gold hover:bg-urbanex-goldHover text-urbanex-navy py-3 rounded-full text-sm font-medium disabled:opacity-50">
        {t("visit.submit")}
      </button>
    </form>
  );
}
