import { useState } from "react";
import UtilityShell from "@/pages/utilities/UtilityShell";
import SensorGate from "@/pages/utilities/SensorGate";
import { useOrientation } from "@/lib/sensors";
import { useSeo } from "@/lib/seo";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (v, d = 1) => (v == null ? "—" : v.toFixed(d));

export default function GyroscopePage() {
  useSeo({ title: "Gyroscope and spirit level", description: "Live phone gyroscope readings and a spirit level to check whether a floor, wall or plot is level." });
  const sensor = useOrientation();
  const { alpha, beta, gamma, rate } = sensor.o;
  const [zero, setZero] = useState({ beta: 0, gamma: 0 });
  const b = beta == null ? 0 : beta - zero.beta;
  const g = gamma == null ? 0 : gamma - zero.gamma;
  const tilt = Math.hypot(b, g);
  const level = tilt < 1;
  const x = clamp(g / 30, -1, 1) * 80, y = clamp(b / 30, -1, 1) * 80;       // bubble travels up to 80 units from the centre

  return (
    <UtilityShell title="Gyroscope and spirit level" intro="See what your phone's motion sensors report, and use it as a spirit level: lay it on a floor, slab or table to see if the surface is level.">
      <SensorGate sensor={sensor} what="gyroscope">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="mx-auto" data-testid="level">
            <svg viewBox="0 0 200 200" className="w-[300px] h-[300px]" role="img" aria-label={`Tilt ${fmt(tilt)} degrees`}>
              <circle cx="100" cy="100" r="96" fill={level ? "#0f5132" : "#0A1225"} style={{ transition: "fill .3s" }}/>
              <circle cx="100" cy="100" r="80" fill="none" stroke="#C5A059" strokeOpacity=".5"/>
              <circle cx="100" cy="100" r="40" fill="none" stroke="#C5A059" strokeOpacity=".3"/>
              <line x1="100" y1="12" x2="100" y2="188" stroke="#fff" strokeOpacity=".15"/><line x1="12" y1="100" x2="188" y2="100" stroke="#fff" strokeOpacity=".15"/>
              <circle cx="100" cy="100" r="9" fill="none" stroke="#fff" strokeOpacity=".6"/>
              <circle cx={100 + x} cy={100 + y} r="14" fill={level ? "#6ee7b7" : "#C5A059"} fillOpacity=".9" style={{ transition: "cx .08s linear, cy .08s linear" }}/>
            </svg>
            <div className={`text-center font-display text-3xl ${level ? "text-emerald-600" : "text-urbanex-navy"}`} data-testid="tilt">{level ? "Level" : `${fmt(tilt)}° off`}</div>
            <div className="text-center mt-3"><button onClick={() => setZero({ beta: beta || 0, gamma: gamma || 0 })} className="rounded-full border px-5 py-2 text-sm">Set this surface as level</button></div>
          </div>
          <div>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[["Tilt front/back", fmt(beta), "beta"], ["Tilt left/right", fmt(gamma), "gamma"], ["Turn (z)", fmt(alpha, 0), "alpha"]].map(([k, v]) => <div key={k} className="rounded-xl bg-white border p-3"><div className="font-display text-2xl">{v}°</div><div className="text-[11px] text-urbanex-navy/55">{k}</div></div>)}
            </div>
            <div className="mt-4 text-xs tracking-[0.2em] uppercase text-urbanex-gold">Rotation speed (degrees per second)</div>
            <div className="mt-2 grid grid-cols-3 gap-3 text-center">
              {["alpha", "beta", "gamma"].map(k => <div key={k} className="rounded-xl bg-urbanex-cream p-3"><div className="font-mono text-lg">{rate ? rate[k].toFixed(0) : "—"}</div><div className="text-[11px] text-urbanex-navy/55">{k}</div></div>)}
            </div>
            <ul className="mt-6 text-sm text-urbanex-navy/65 space-y-1 list-disc pl-5">
              <li>Lay the phone flat on the surface, screen up, and wait for the bubble to settle.</li>
              <li>Under 1° off shows green. Tilt a finished floor or slab by more than that and water will not drain evenly.</li>
              <li>To check a wall, stand the phone on its long edge. Use “Set as level” on a surface you trust first.</li>
            </ul>
            <button onClick={sensor.stop} className="mt-5 rounded-full border px-5 py-2 text-sm">Stop</button>
          </div>
        </div>
      </SensorGate>
    </UtilityShell>
  );
}
