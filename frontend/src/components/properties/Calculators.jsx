import { useMemo, useState } from "react";
import { useViewer } from "@/context/ViewerContext";
import { useI18n } from "@/context/I18nContext";
import { inrFull } from "@/lib/config";

const num = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);

export function emi(principal, annualRatePct, years) {
  const n = Math.round(years * 12);
  if (principal <= 0 || n <= 0) return 0;
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / n;
  const f = Math.pow(1 + r, n);
  return (principal * r * f) / (f - 1);
}

function Field({ label, value, onChange, step = "any" }) {
  return (
    <label className="block text-xs text-urbanex-navy/60">
      {label}
      <input type="number" inputMode="decimal" min="0" step={step} value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-urbanex-navy/15 rounded-lg px-3 py-2 text-sm text-urbanex-navy bg-white"/>
    </label>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className={`flex justify-between text-sm ${strong ? "font-semibold text-urbanex-navy" : "text-urbanex-navy/70"}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

// Stamp duty / registration defaults are editable estimates, not legal advice: rates depend on
// property value, location and buyer category, and change over time.
function CalculatorsBody({ price }) {
  const { t } = useI18n();
  const [tab, setTab] = useState("emi");
  const [p, setP] = useState(price ? String(price) : "");
  const [down, setDown] = useState("20");
  const [rate, setRate] = useState("8.75");
  const [years, setYears] = useState("20");
  const [stamp, setStamp] = useState("6");
  const [reg, setReg] = useState("1");
  const [other, setOther] = useState("50000");
  const [rent, setRent] = useState("");
  const [maint, setMaint] = useState("0");

  const price_ = num(p);
  const loan = price_ * (1 - num(down) / 100);
  const monthly = emi(loan, num(rate), num(years));
  const totalPay = monthly * Math.round(num(years) * 12);
  const costs = useMemo(() => {
    const s = price_ * num(stamp) / 100, r = price_ * num(reg) / 100;
    return { s, r, total: price_ + s + r + num(other) };
  }, [price_, stamp, reg, other]);
  const annualRent = num(rent) * 12;
  const gross = price_ ? (annualRent / price_) * 100 : 0;
  const net = price_ ? ((annualRent - num(maint)) / price_) * 100 : 0;

  const tabs = [["emi", t("calc.emi")], ["costs", t("calc.costs")], ["roi", t("calc.roi")]];

  return (
    <>
        <div className="mt-4 bg-white rounded-2xl border border-urbanex-navy/10 p-6">
          <div className="flex gap-2 flex-wrap mb-5" role="tablist">
            {tabs.map(([k, label]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`px-4 py-1.5 rounded-full text-sm border ${tab === k ? "bg-urbanex-navy text-urbanex-ivory border-urbanex-navy" : "border-urbanex-navy/20 text-urbanex-navy/70 hover:border-urbanex-gold"}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="grid grid-cols-2 gap-3 content-start">
              <div className="col-span-2"><Field label={t("calc.price")} value={p} onChange={setP}/></div>
              {tab === "emi" && <>
                <Field label={t("calc.down")} value={down} onChange={setDown}/>
                <Field label={t("calc.rate")} value={rate} onChange={setRate}/>
                <div className="col-span-2"><Field label={t("calc.years")} value={years} onChange={setYears}/></div>
              </>}
              {tab === "costs" && <>
                <Field label={t("calc.stamp")} value={stamp} onChange={setStamp}/>
                <Field label={t("calc.reg")} value={reg} onChange={setReg}/>
                <div className="col-span-2"><Field label={t("calc.other")} value={other} onChange={setOther}/></div>
              </>}
              {tab === "roi" && <>
                <Field label={t("calc.rent")} value={rent} onChange={setRent}/>
                <Field label={t("calc.maint")} value={maint} onChange={setMaint}/>
              </>}
            </div>
            <div className="bg-urbanex-cream rounded-xl p-5 space-y-2 self-start">
              {tab === "emi" && <>
                <div className="text-xs tracking-[0.2em] uppercase text-urbanex-gold">{t("calc.emiMonthly")}</div>
                <div className="font-display text-4xl text-urbanex-navy" data-testid="calc-emi">{inrFull(monthly)}</div>
                <Row label={t("calc.loanAmt")} value={inrFull(loan)}/>
                <Row label={t("calc.totalInterest")} value={inrFull(Math.max(0, totalPay - loan))}/>
                <Row label={t("calc.totalPay")} value={inrFull(totalPay)} strong/>
              </>}
              {tab === "costs" && <>
                <Row label={t("calc.stamp")} value={inrFull(costs.s)}/>
                <Row label={t("calc.reg")} value={inrFull(costs.r)}/>
                <Row label={t("calc.other")} value={inrFull(num(other))}/>
                <Row label={t("calc.totalCost")} value={inrFull(costs.total)} strong/>
              </>}
              {tab === "roi" && <>
                <Row label={t("calc.gross")} value={`${gross.toFixed(2)}%`}/>
                <Row label={t("calc.net")} value={`${net.toFixed(2)}%`} strong/>
                <Row label={t("calc.annualNet")} value={inrFull(annualRent - num(maint))}/>
              </>}
            </div>
          </div>
          <p className="mt-5 text-xs text-urbanex-navy/50">{t("calc.disclaimer")}</p>
        </div>
    </>
  );
}

// The calculators use the property's price, which only appears once the visitor has pressed Interested.
export default function Calculators({ property }) {
  const { unlocked, press } = useViewer();
  const { t } = useI18n();
  const info = unlocked("property", property.id);
  return (
    <section className="mt-12" data-testid="calculators">
      <h2 className="font-display text-3xl text-urbanex-navy">{t("calc.title")}</h2>
      {!info ? (
        <button onClick={() => press("property", property)} className="mt-4 text-sm text-urbanex-navy/70 underline decoration-urbanex-gold underline-offset-4" data-testid="calc-unlock">
          {t("calc.signin")}
        </button>
      ) : (
        <CalculatorsBody key={info.price_inr ?? "none"} price={info.price_inr}/>
      )}
    </section>
  );
}
