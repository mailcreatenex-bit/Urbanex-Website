import Marquee from "react-fast-marquee";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function ZonesMarquee() {
  const [zones, setZones] = useState([]);
  useEffect(() => {
    api.get("/config/public").then(r => setZones(r.data.zones || [])).catch(() => {});
  }, []);
  if (!zones.length) return null;
  return (
    <section className="border-y border-urbanex-navy/10 bg-urbanex-ivory py-6">
      <div className="text-[10px] tracking-[0.32em] uppercase text-urbanex-gold text-center mb-3">
        Serving 19 zones across Burdwan
      </div>
      <Marquee gradient={false} speed={40} pauseOnHover>
        {zones.map(z => (
          <span key={z} className="mx-8 text-urbanex-navy/70 font-display text-2xl md:text-3xl">
            {z} <span className="text-urbanex-gold mx-4">·</span>
          </span>
        ))}
      </Marquee>
    </section>
  );
}
