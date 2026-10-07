import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import LandShell from "@/pages/utilities/LandShell";
import KathaSetting, { useKatha } from "@/pages/utilities/land/LandUnitsBar";
import { fmt, fromSqft, kathaChatak, toSqft, unitTable } from "@/lib/land";
import { useSeo } from "@/lib/seo";
import ShareResults from "@/components/common/ShareResults";

export default function ConverterPage() {
  useSeo({ title: "Land unit converter: katha, bigha, decimal, acre", description: "Convert between katha, chatak, bigha, decimal, acre, square feet and square metres." });
  const [katha, setKatha] = useKatha();
  const [value, setValue] = useState("5");
  const [unit, setUnit] = useState("katha");
  const units = unitTable(katha);
  const sqft = toSqft(parseFloat(value) || 0, unit, katha);
  const kc = kathaChatak(sqft, katha);

  return (
    <LandShell title="Land unit converter" intro="Katha, chatak, bigha, decimal or acre. Type it in any one and see all the others.">
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-5">
          <div className="rounded-2xl bg-white border border-urbanex-navy/5 p-6">
            <label className="block text-xs text-urbanex-navy/60">I have
              <div className="mt-1 flex gap-2">
                <input type="number" inputMode="decimal" min="0" step="any" value={value} onChange={(e) => setValue(e.target.value)} data-testid="conv-value" className="w-full border border-urbanex-navy/15 rounded-lg px-3 py-3 text-xl bg-white"/>
                <select value={unit} onChange={(e) => setUnit(e.target.value)} data-testid="conv-unit" className="border border-urbanex-navy/15 rounded-lg px-3 bg-white text-sm">{units.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}</select>
              </div>
            </label>
            <div className="mt-4 flex items-center gap-2 text-sm text-urbanex-navy/70"><ArrowLeftRight className="w-4 h-4 text-urbanex-gold"/> that is <b data-testid="conv-katha-words">{kc.katha} katha {fmt(kc.chatak)} chatak</b></div>
          </div>
          <KathaSetting katha={katha} setKatha={setKatha}/>
        </div>
        <div className="rounded-2xl bg-urbanex-navy text-urbanex-ivory p-2" data-testid="conv-table">
          {units.map(u => (
            <button key={u.id} type="button" onClick={() => { setValue(String(Math.round(fromSqft(sqft, u.id, katha) * 1e6) / 1e6)); setUnit(u.id); }} className={`w-full flex items-center justify-between rounded-xl px-4 py-3 text-left hover:bg-white/10 ${u.id === unit ? "bg-white/10" : ""}`}>
              <span className="text-sm text-urbanex-ivory/70">{u.label}</span>
              <span className="font-display text-xl" data-testid={`conv-${u.id}`}>{fmt(fromSqft(sqft, u.id, katha), 4)}</span>
            </button>
          ))}
        </div>
      </div>
      <ShareResults title="Land size converted" lines={[`${value || 0} ${units.find(u => u.id === unit)?.label || unit} = ${kc.katha} katha ${fmt(kc.chatak)} chatak`, ...units.filter(u => u.id !== unit).slice(0, 4).map(u => `${fmt(fromSqft(sqft, u.id, katha), 3)} ${u.label}`)]}/>
    </LandShell>
  );
}
