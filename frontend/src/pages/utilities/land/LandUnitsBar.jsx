import { useEffect, useState } from "react";
import { DEFAULT_KATHA } from "@/lib/land";

const KEY = "urbanex_katha_sqft";

// How big is a katha where you are? The answer changes from place to place, so every land tool uses this one setting.
export function useKatha() {
  const [katha, setKatha] = useState(() => { try { const v = Number(localStorage.getItem(KEY)); return v >= 300 && v <= 2000 ? v : DEFAULT_KATHA; } catch { return DEFAULT_KATHA; } });
  useEffect(() => { try { localStorage.setItem(KEY, String(katha)); } catch { /* storage blocked */ } }, [katha]);
  return [katha, setKatha];
}

export default function KathaSetting({ katha, setKatha }) {
  return (
    <div className="rounded-xl bg-urbanex-cream px-4 py-3 text-sm flex flex-wrap items-center gap-3" data-testid="katha-setting">
      <span className="text-urbanex-navy/70">1 katha =</span>
      <input type="number" min="300" max="2000" value={katha} onChange={(e) => setKatha(Number(e.target.value) || DEFAULT_KATHA)} className="w-24 border border-urbanex-navy/15 rounded-lg px-2 py-1.5 bg-white" aria-label="Square feet in one katha"/>
      <span className="text-urbanex-navy/70">sq ft</span>
      <button type="button" onClick={() => setKatha(DEFAULT_KATHA)} className="text-xs underline text-urbanex-navy/50">Reset to {DEFAULT_KATHA}</button>
      <span className="text-xs text-urbanex-navy/50 basis-full">The size of a katha differs from place to place. 720 sq ft is common around Burdwan, so check what your deed or seller means. 1 bigha = 20 katha and 1 katha = 16 chatak.</span>
    </div>
  );
}
