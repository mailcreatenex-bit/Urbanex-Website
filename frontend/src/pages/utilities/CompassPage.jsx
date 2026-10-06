import { useState } from "react";
import { toast } from "sonner";
import UtilityShell from "@/pages/utilities/UtilityShell";
import SensorGate from "@/pages/utilities/SensorGate";
import { CARDINALS, CARDINAL_NAMES, cardinal, useOrientation } from "@/lib/sensors";
import { useSeo } from "@/lib/seo";

export default function CompassPage() {
  useSeo({ title: "Compass for plot facing", description: "Use your phone as a compass to find which direction a plot or house faces." });
  const sensor = useOrientation();
  const [saved, setSaved] = useState([]);
  const h = sensor.o.heading;
  const live = sensor.status === "live";
  const dir = h == null ? null : cardinal(h);

  const lock = () => {
    if (h == null) return;
    setSaved(s => [{ deg: Math.round(h), dir: cardinal(h), at: new Date() }, ...s].slice(0, 5));
  };
  const copy = () => navigator.clipboard?.writeText(saved.map(s => `${CARDINAL_NAMES[s.dir]} ${s.deg}°`).join(", ")).then(() => toast.success("Copied")).catch(() => {});

  return (
    <UtilityShell title="Compass" intro="Stand at the gate, face the road and read the direction. That is the way your plot or house faces.">
      <SensorGate sensor={sensor} what="compass">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="relative mx-auto w-[300px] h-[300px] md:w-[340px] md:h-[340px]" data-testid="compass">
            <svg viewBox="0 0 200 200" className="w-full h-full" role="img" aria-label={h == null ? "Compass" : `Heading ${Math.round(h)} degrees ${dir}`}>
              <circle cx="100" cy="100" r="96" fill="#0A1225"/>
              <circle cx="100" cy="100" r="92" fill="none" stroke="#C5A059" strokeOpacity=".5"/>
              <g style={{ transform: `rotate(${h == null ? 0 : -h}deg)`, transformOrigin: "100px 100px", transition: "transform 0.15s linear" }}>
                {Array.from({ length: 72 }).map((_, i) => <line key={i} x1="100" y1="10" x2="100" y2={i % 9 === 0 ? 22 : 16} stroke="#fff" strokeOpacity={i % 9 === 0 ? 0.9 : 0.35} transform={`rotate(${i * 5} 100 100)`}/>)}
                {CARDINALS.map((c, i) => <text key={c} x="100" y={c.length === 1 ? 42 : 40} fontSize={c.length === 1 ? 15 : 9} fontWeight="700" textAnchor="middle" fill={c === "N" ? "#ff5a4d" : "#C5A059"} transform={`rotate(${i * 45} 100 100)`}>{c}</text>)}
              </g>
              <polygon points="100,22 95,36 105,36" fill="#fff"/>
              <circle cx="100" cy="100" r="3" fill="#C5A059"/>
            </svg>
          </div>
          <div>
            <div className="text-[10px] tracking-[0.28em] uppercase text-urbanex-gold">You are facing</div>
            <div className="font-display text-6xl text-urbanex-navy" data-testid="compass-reading">{h == null ? "—" : `${Math.round(h)}°`}</div>
            <div className="font-display text-3xl text-urbanex-navy/80">{dir ? CARDINAL_NAMES[dir] : "Waiting for the sensor…"}</div>
            {live && !sensor.o.absolute && <p className="mt-3 text-xs text-amber-700">This phone does not give a true compass reading. Move it in a figure of eight, or try another phone.</p>}
            <div className="mt-6 flex flex-wrap gap-2">
              <button onClick={lock} disabled={h == null} className="rounded-full bg-urbanex-navy text-urbanex-ivory px-6 py-2.5 text-sm disabled:opacity-40">Note this direction</button>
              <button onClick={sensor.stop} className="rounded-full border px-5 py-2.5 text-sm">Stop</button>
            </div>
            {saved.length > 0 && (
              <div className="mt-5 text-sm">
                <ul className="space-y-1">{saved.map((s, i) => <li key={i}><b>{CARDINAL_NAMES[s.dir]}</b> {s.deg}° <span className="text-urbanex-navy/40 text-xs">{s.at.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span></li>)}</ul>
                <button onClick={copy} className="mt-2 text-xs underline text-urbanex-navy/60">Copy</button>
              </div>
            )}
          </div>
        </div>
        <ul className="mt-8 text-sm text-urbanex-navy/65 space-y-1 list-disc pl-5 max-w-2xl">
          <li>Hold the phone flat and away from magnets, metal gates and car bodies.</li>
          <li>A house “faces” the direction its main door looks out to. In Vastu, east and north facing are usually preferred.</li>
          <li>Readings can be off by 10° or so. For an important decision, confirm with a surveyor.</li>
        </ul>
      </SensorGate>
    </UtilityShell>
  );
}
