import { useState } from "react";
import { Plus, Trash2, MessageCircle } from "lucide-react";
import LandShell from "@/pages/utilities/LandShell";
import KathaSetting, { useKatha } from "@/pages/utilities/land/LandUnitsBar";
import { LENGTH, LENGTH_LABEL, fmt, fromSqft, kathaChatak, quadArea, rectangleArea, trapeziumArea, triangleArea, unitTable } from "@/lib/land";
import { waLink } from "@/lib/config";
import { useSeo } from "@/lib/seo";

const SHAPES = {
  rect: { label: "Rectangle", fields: [["l", "Length"], ["w", "Width"]], hint: "A plot with four right-angle corners." },
  tri: { label: "Triangle", fields: [["a", "Side 1"], ["b", "Side 2"], ["c", "Side 3"]], hint: "Measure all three sides." },
  quad: { label: "Four-sided plot", fields: [["a", "Side 1"], ["b", "Side 2"], ["c", "Side 3"], ["d", "Side 4"], ["g", "Diagonal"]], hint: "Measure the four sides going round, plus one diagonal. Side 1 and side 2 meet at one end of the diagonal; side 3 and side 4 meet at the other." },
  trap: { label: "Trapezium", fields: [["p", "Parallel side 1"], ["q", "Parallel side 2"], ["h", "Distance between them"]], hint: "Two sides run side by side (like many road-facing plots)." },
};

function areaOf(shape, v) {
  const n = (k) => (parseFloat(v[k]) || 0);
  if (shape === "rect") return rectangleArea(n("l"), n("w"));
  if (shape === "tri") return triangleArea(n("a"), n("b"), n("c"));
  if (shape === "quad") return n("a") && n("b") && n("c") && n("d") && n("g") ? quadArea(n("a"), n("b"), n("c"), n("d"), n("g")) : 0;
  return trapeziumArea(n("p"), n("q"), n("h"));
}

export default function AreaPage() {
  useSeo({ title: "Plot area calculator", description: "Work out the area of a plot from its measurements and see it in katha, decimal, bigha and square feet." });
  const [katha, setKatha] = useKatha();
  const [shape, setShape] = useState("rect");
  const [unit, setUnit] = useState("ft");
  const [vals, setVals] = useState({});
  const [parts, setParts] = useState([]);
  const sqftNow = areaOf(shape, vals) * LENGTH[unit] ** 2;
  const invalid = Number.isNaN(sqftNow);
  const total = parts.reduce((a, p) => a + p.sqft, 0) + (invalid ? 0 : sqftNow);
  const show = ["sqft", "sqm", "decimal", "katha", "bigha", "acre"];
  const units = unitTable(katha);
  const kc = kathaChatak(total, katha);
  const set = (k) => (e) => setVals(x => ({ ...x, [k]: e.target.value }));

  const addPart = () => { if (sqftNow > 0) { setParts(p => [...p, { label: SHAPES[shape].label, sqft: sqftNow }]); setVals({}); } };
  const summary = `Plot area: ${fmt(total)} sq ft = ${kc.katha} katha ${fmt(kc.chatak)} chatak = ${fmt(fromSqft(total, "decimal", katha))} decimal (1 katha = ${katha} sq ft)`;

  return (
    <LandShell title="Plot area calculator" intro="Measure the sides with a tape, type them in, and get the area in the units your seller talks in.">
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2" role="tablist">
            {Object.entries(SHAPES).map(([k, s]) => <button key={k} type="button" onClick={() => { setShape(k); setVals({}); }} aria-pressed={shape === k} data-testid={`shape-${k}`} className={`rounded-full border px-4 py-2 text-sm ${shape === k ? "bg-urbanex-navy text-urbanex-ivory border-urbanex-navy" : "bg-white hover:border-urbanex-gold"}`}>{s.label}</button>)}
          </div>
          <div className="rounded-2xl bg-white border border-urbanex-navy/5 p-6">
            <p className="text-xs text-urbanex-navy/55 mb-4">{SHAPES[shape].hint}</p>
            <label className="block text-xs text-urbanex-navy/60 mb-3">Measured in
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className="mt-1 block border border-urbanex-navy/15 rounded-lg px-3 py-2 bg-white text-sm" data-testid="area-unit">{Object.keys(LENGTH).map(u => <option key={u} value={u}>{LENGTH_LABEL[u]}</option>)}</select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {SHAPES[shape].fields.map(([k, label]) => (
                <label key={k} className="block text-xs text-urbanex-navy/60">{label}
                  <input type="number" inputMode="decimal" min="0" step="any" value={vals[k] ?? ""} onChange={set(k)} data-testid={`dim-${k}`} className="mt-1 w-full border border-urbanex-navy/15 rounded-lg px-3 py-2.5 text-base bg-white"/>
                </label>
              ))}
            </div>
            {invalid && <p className="mt-3 text-sm text-red-600">Those sides cannot form a closed plot. Check the measurements.</p>}
            <button type="button" onClick={addPart} disabled={!(sqftNow > 0)} data-testid="add-part" className="mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm disabled:opacity-40 hover:border-urbanex-gold"><Plus className="w-4 h-4"/> Add this part, then measure another</button>
          </div>
          {parts.length > 0 && (
            <ul className="rounded-2xl bg-white border border-urbanex-navy/5 p-4 text-sm space-y-1">
              {parts.map((p, i) => <li key={i} className="flex justify-between"><span>{i + 1}. {p.label}</span><span className="flex items-center gap-3">{fmt(p.sqft)} sq ft <button type="button" aria-label="Remove" onClick={() => setParts(parts.filter((_, j) => j !== i))} className="text-urbanex-navy/40 hover:text-red-600"><Trash2 className="w-4 h-4"/></button></span></li>)}
            </ul>
          )}
          <KathaSetting katha={katha} setKatha={setKatha}/>
        </div>

        <div className="rounded-2xl bg-urbanex-navy text-urbanex-ivory p-6 self-start" data-testid="area-result">
          <div className="text-[10px] tracking-[0.28em] uppercase text-urbanex-gold">Total area</div>
          <div className="font-display text-5xl mt-1" data-testid="area-katha">{kc.katha} <span className="text-2xl">katha</span> {fmt(kc.chatak)} <span className="text-2xl">chatak</span></div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {show.map(id => { const u = units.find(x => x.id === id); return <div key={id} className="rounded-xl bg-white/10 px-4 py-3"><div className="font-display text-2xl" data-testid={`area-${id}`}>{fmt(fromSqft(total, id, katha), 3)}</div><div className="text-xs text-urbanex-ivory/60">{u.label}</div></div>; })}
          </div>
          <a href={waLink(`${summary}\n\nCan you tell me what plots like this cost in my area?`)} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#25D366] text-white px-5 py-2.5 text-sm"><MessageCircle className="w-4 h-4"/> Ask Urbanex about this size</a>
        </div>
      </div>
      <p className="mt-6 text-xs text-urbanex-navy/45">Measure along the ground, not along a slope. For purchase or registration use the area on the deed and a licensed surveyor's measurement; this is a quick estimate.</p>
    </LandShell>
  );
}
