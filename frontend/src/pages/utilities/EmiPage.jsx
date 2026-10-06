import { useMemo, useState } from "react";
import UtilityShell from "@/pages/utilities/UtilityShell";
import { emi } from "@/components/properties/Calculators";
import { useSeo } from "@/lib/seo";
import { inrFull } from "@/lib/config";

const num = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);
const Field = ({ label, value, onChange, suffix, step = "any", testId }) => (
  <label className="block text-xs text-urbanex-navy/60">{label}
    <div className="mt-1 flex items-center border border-urbanex-navy/15 rounded-lg bg-white overflow-hidden">
      <input type="number" inputMode="decimal" min="0" step={step} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId} className="w-full px-3 py-2.5 text-sm text-urbanex-navy bg-transparent outline-none"/>
      {suffix && <span className="px-3 text-xs text-urbanex-navy/50">{suffix}</span>}
    </div>
  </label>
);

// Months to clear a loan when paying `pay` a month at rate r (monthly), principal P.
const monthsToClear = (P, r, pay) => (r === 0 ? Math.ceil(P / pay) : pay <= P * r ? Infinity : Math.ceil(-Math.log(1 - (P * r) / pay) / Math.log(1 + r)));

export default function EmiPage() {
  useSeo({ title: "EMI calculator", description: "Home loan EMI calculator with total interest, yearly schedule and how much loan you can afford." });
  const [mode, setMode] = useState("emi");
  const [amount, setAmount] = useState("3500000");
  const [rate, setRate] = useState("8.75");
  const [years, setYears] = useState("20");
  const [extra, setExtra] = useState("0");
  const [income, setIncome] = useState("80000");
  const [other, setOther] = useState("0");

  const calc = useMemo(() => {
    const P = num(amount), y = num(years), r = num(rate) / 12 / 100;
    const m = emi(P, num(rate), y), n = Math.round(y * 12);
    const total = m * n;
    // yearly schedule (with optional extra monthly payment)
    const rows = [];
    let bal = P, month = 0, interestAll = 0;
    const pay = m + num(extra);
    while (bal > 0.5 && month < n + 1 && pay > 0) {
      let paidP = 0, paidI = 0;
      for (let k = 0; k < 12 && bal > 0.5; k++) {
        const i = bal * r; const p = Math.min(bal, pay - i);
        if (p <= 0) { bal = 0; break; }
        bal -= p; paidP += p; paidI += i; month++;
      }
      interestAll += paidI;
      rows.push({ year: rows.length + 1, principal: paidP, interest: paidI, balance: Math.max(0, bal) });
      if (rows.length > 40) break;
    }
    const base = monthsToClear(P, r, m);
    const withExtra = num(extra) > 0 ? monthsToClear(P, r, pay) : base;
    return { m, total, interest: total - P, rows, saved: Math.max(0, base - withExtra), interestWith: interestAll, P };
  }, [amount, rate, years, extra]);

  const afford = useMemo(() => {
    const maxEmi = Math.max(0, num(income) * 0.4 - num(other));        // banks usually allow about 40% of income
    const r = num(rate) / 12 / 100, n = Math.round(num(years) * 12);
    const loan = r === 0 ? maxEmi * n : (maxEmi * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n));
    return { maxEmi, loan };
  }, [income, other, rate, years]);

  const pct = calc.total > 0 ? (calc.P / calc.total) * 100 : 0;
  const C = 2 * Math.PI * 42;

  return (
    <UtilityShell title="EMI calculator" intro="Work out your monthly home-loan payment, the interest you will pay, and how a little extra each month shortens the loan.">
      <div className="inline-flex rounded-full border overflow-hidden bg-white text-sm mb-6">
        {[["emi", "My EMI"], ["afford", "How much can I borrow?"]].map(([k, l]) => <button key={k} onClick={() => setMode(k)} className={`px-5 py-2 ${mode === k ? "bg-urbanex-navy text-urbanex-ivory" : ""}`}>{l}</button>)}
      </div>

      {mode === "emi" ? (
        <div className="grid md:grid-cols-2 gap-8" data-testid="emi-calc">
          <div className="space-y-4 rounded-2xl bg-white border border-urbanex-navy/5 p-6">
            <Field label="Loan amount" value={amount} onChange={setAmount} suffix="₹" testId="emi-amount"/>
            <input type="range" min="100000" max="30000000" step="50000" value={num(amount)} onChange={(e) => setAmount(e.target.value)} className="w-full accent-[#C5A059]" aria-label="Loan amount"/>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Interest rate (per year)" value={rate} onChange={setRate} suffix="%" step="0.05" testId="emi-rate"/>
              <Field label="Tenure" value={years} onChange={setYears} suffix="years" step="1" testId="emi-years"/>
            </div>
            <Field label="Extra you can pay every month (optional)" value={extra} onChange={setExtra} suffix="₹"/>
          </div>
          <div className="rounded-2xl bg-urbanex-navy text-urbanex-ivory p-6 flex flex-col gap-5">
            <div className="flex items-center gap-6">
              <svg viewBox="0 0 100 100" className="w-32 h-32 -rotate-90 shrink-0" aria-hidden="true">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#C5A059" strokeWidth="14"/>
                <circle cx="50" cy="50" r="42" fill="none" stroke="#ffffff" strokeOpacity=".9" strokeWidth="14" strokeDasharray={`${(pct / 100) * C} ${C}`}/>
              </svg>
              <div>
                <div className="text-[10px] tracking-[0.28em] uppercase text-urbanex-gold">Monthly EMI</div>
                <div className="font-display text-4xl" data-testid="emi-result">{inrFull(Math.round(calc.m))}</div>
                <div className="mt-2 text-xs text-urbanex-ivory/70"><span className="inline-block w-2 h-2 rounded-full bg-white mr-1"/>Principal <span className="inline-block w-2 h-2 rounded-full bg-urbanex-gold ml-3 mr-1"/>Interest</div>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-urbanex-ivory/60 text-xs">Total interest</dt><dd className="text-lg">{inrFull(Math.round(num(extra) > 0 ? calc.interestWith : calc.interest))}</dd></div>
              <div><dt className="text-urbanex-ivory/60 text-xs">Total you pay</dt><dd className="text-lg">{inrFull(Math.round(calc.P + (num(extra) > 0 ? calc.interestWith : calc.interest)))}</dd></div>
            </dl>
            {num(extra) > 0 && calc.saved > 0 && <div className="rounded-xl bg-white/10 p-3 text-sm">Paying {inrFull(num(extra))} extra clears the loan <b>{Math.floor(calc.saved / 12)} years {calc.saved % 12} months</b> sooner and saves about <b>{inrFull(Math.round(calc.interest - calc.interestWith))}</b> in interest.</div>}
          </div>
          <div className="md:col-span-2 rounded-2xl bg-white border border-urbanex-navy/5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-urbanex-navy/55 border-b"><tr><th className="p-3">Year</th><th>Principal paid</th><th>Interest paid</th><th>Balance left</th></tr></thead>
              <tbody>{calc.rows.map(r => <tr key={r.year} className="border-b last:border-0"><td className="p-3">{r.year}</td><td>{inrFull(Math.round(r.principal))}</td><td>{inrFull(Math.round(r.interest))}</td><td>{inrFull(Math.round(r.balance))}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8" data-testid="afford-calc">
          <div className="space-y-4 rounded-2xl bg-white border border-urbanex-navy/5 p-6">
            <Field label="Your monthly income (take-home)" value={income} onChange={setIncome} suffix="₹"/>
            <Field label="EMIs you already pay each month" value={other} onChange={setOther} suffix="₹"/>
            <div className="grid grid-cols-2 gap-4"><Field label="Interest rate" value={rate} onChange={setRate} suffix="%" step="0.05"/><Field label="Tenure" value={years} onChange={setYears} suffix="years" step="1"/></div>
          </div>
          <div className="rounded-2xl bg-urbanex-navy text-urbanex-ivory p-6">
            <div className="text-[10px] tracking-[0.28em] uppercase text-urbanex-gold">You can borrow about</div>
            <div className="font-display text-5xl mt-1" data-testid="afford-result">{inrFull(Math.round(afford.loan / 10000) * 10000)}</div>
            <p className="mt-3 text-sm text-urbanex-ivory/75">with an EMI of up to {inrFull(Math.round(afford.maxEmi))} a month. Banks usually allow EMIs up to about 40% of your income. The exact limit depends on your bank, credit score and the property.</p>
          </div>
        </div>
      )}
      <p className="mt-6 text-xs text-urbanex-navy/45">An estimate only. Your bank's offer, fees and rate changes will differ.</p>
    </UtilityShell>
  );
}
