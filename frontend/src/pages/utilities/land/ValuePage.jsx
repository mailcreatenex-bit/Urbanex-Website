import { useMemo, useState } from "react";
import LandShell from "@/pages/utilities/LandShell";
import KathaSetting, { useKatha } from "@/pages/utilities/land/LandUnitsBar";
import { fmt, fromSqft, toSqft, unitTable } from "@/lib/land";
import { inrFull } from "@/lib/config";
import { useSeo } from "@/lib/seo";
import ShareResults from "@/components/common/ShareResults";

const Field = ({ label, children }) => <label className="block text-xs text-urbanex-navy/60">{label}<div className="mt-1">{children}</div></label>;
const inp = "w-full border border-urbanex-navy/15 rounded-lg px-3 py-2.5 text-sm bg-white";

export default function ValuePage() {
  useSeo({ title: "Land value and buying cost estimator", description: "Estimate what a plot costs from its size and rate per katha, decimal or square foot, with stamp duty and registration." });
  const [katha, setKatha] = useKatha();
  const [size, setSize] = useState("5");
  const [sizeUnit, setSizeUnit] = useState("katha");
  const [rate, setRate] = useState("600000");
  const [rateUnit, setRateUnit] = useState("katha");
  const [stamp, setStamp] = useState("7");
  const [reg, setReg] = useState("1");
  const [other, setOther] = useState("0");
  const units = unitTable(katha);

  const r = useMemo(() => {
    const sqft = toSqft(parseFloat(size) || 0, sizeUnit, katha);
    const perSqft = (parseFloat(rate) || 0) / toSqft(1, rateUnit, katha);
    const value = sqft * perSqft;
    const st = (value * (parseFloat(stamp) || 0)) / 100, rg = (value * (parseFloat(reg) || 0)) / 100, ot = parseFloat(other) || 0;
    return { sqft, perSqft, value, st, rg, ot, total: value + st + rg + ot };
  }, [size, sizeUnit, rate, rateUnit, stamp, reg, other, katha]);

  return (
    <LandShell title="Land value estimator" intro="Size and rate in, price and the extra costs of buying out. Works with the units people really use.">
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-urbanex-navy/5 p-6 space-y-4">
            <Field label="Plot size"><div className="flex gap-2"><input type="number" inputMode="decimal" min="0" step="any" className={inp} value={size} onChange={(e) => setSize(e.target.value)} data-testid="val-size"/><select className={`${inp} w-auto`} value={sizeUnit} onChange={(e) => setSizeUnit(e.target.value)}>{units.map(u => <option key={u.id} value={u.id}>{u.short}</option>)}</select></div></Field>
            <Field label="Rate asked (₹ for one unit)"><div className="flex gap-2"><input type="number" inputMode="decimal" min="0" className={inp} value={rate} onChange={(e) => setRate(e.target.value)} data-testid="val-rate"/><select className={`${inp} w-auto`} value={rateUnit} onChange={(e) => setRateUnit(e.target.value)}>{units.map(u => <option key={u.id} value={u.id}>per {u.short}</option>)}</select></div></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Stamp duty %"><input type="number" min="0" step="0.1" className={inp} value={stamp} onChange={(e) => setStamp(e.target.value)}/></Field>
              <Field label="Registration %"><input type="number" min="0" step="0.1" className={inp} value={reg} onChange={(e) => setReg(e.target.value)}/></Field>
              <Field label="Other costs ₹"><input type="number" min="0" className={inp} value={other} onChange={(e) => setOther(e.target.value)}/></Field>
            </div>
            <p className="text-[11px] text-urbanex-navy/45">Stamp duty and registration rates change, and depend on the area and the value. These two boxes are starting guesses: ask the sub-registrar's office or a deed writer for the rates that apply to you.</p>
          </div>
          <KathaSetting katha={katha} setKatha={setKatha}/>
        </div>
        <div className="rounded-2xl bg-urbanex-navy text-urbanex-ivory p-6 self-start" data-testid="val-result">
          <div className="text-[10px] tracking-[0.28em] uppercase text-urbanex-gold">Price of the land</div>
          <div className="font-display text-5xl" data-testid="val-value">{inrFull(Math.round(r.value))}</div>
          <dl className="mt-5 space-y-2 text-sm">
            {[["Stamp duty", r.st], ["Registration", r.rg], ["Other costs", r.ot]].map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-urbanex-ivory/70">{k}</dt><dd>{inrFull(Math.round(v))}</dd></div>)}
            <div className="flex justify-between border-t border-white/20 pt-3 text-lg font-display"><dt>You will spend about</dt><dd data-testid="val-total">{inrFull(Math.round(r.total))}</dd></div>
          </dl>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
            {["sqft", "decimal", "katha"].map(id => <div key={id} className="rounded-xl bg-white/10 py-2"><div className="font-display text-lg">{fmt(id === "sqft" ? r.perSqft : r.perSqft * units.find(u => u.id === id).f, 0)}</div>₹ per {units.find(u => u.id === id).short}</div>)}
          </div>
          <div className="mt-3 text-xs text-urbanex-ivory/60">Plot size {fmt(r.sqft)} sq ft = {fmt(fromSqft(r.sqft, "katha", katha))} katha</div>
        </div>
      </div>
      <ShareResults title="Plot cost estimate" lines={[`Plot ${fmt(r.sqft)} sq ft`, `Land price ${inrFull(Math.round(r.value))}`, `With stamp duty and registration: about ${inrFull(Math.round(r.total))}`]}/>
    </LandShell>
  );
}
