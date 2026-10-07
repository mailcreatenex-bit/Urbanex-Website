import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, MapPin, Play, X } from "lucide-react";
import { api } from "@/lib/api";
import { assetUrl } from "@/lib/config";
import { useSeo } from "@/lib/seo";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const bubble = (z, on, mode) => {
  const n = mode === "homes" ? z.properties : mode === "videos" ? z.videos : z.properties + z.videos;
  const d = Math.round(30 + Math.sqrt(n) * 11);
  return L.divIcon({
    className: "", iconSize: [d, d], iconAnchor: [d / 2, d / 2],
    html: `<div style="width:${d}px;height:${d}px;border-radius:50%;display:grid;place-items:center;position:relative;color:#0A1225;font:600 13px Outfit,sans-serif;background:${on ? "#FDFBF7" : "#C5A059"};box-shadow:0 0 0 ${on ? 8 : 5}px rgba(197,160,89,.28),0 0 ${on ? 40 : 26}px rgba(197,160,89,.65);transition:all .3s">${n}</div>`,
  });
};
const dot = L.divIcon({ className: "", iconSize: [14, 14], iconAnchor: [7, 7], html: `<div style="width:14px;height:14px;border-radius:50%;background:#7dd3fc;border:2px solid #0A1225;box-shadow:0 0 14px rgba(125,211,252,.9)"></div>` });
const house = (on) => L.divIcon({ className: "", iconSize: [16, 16], iconAnchor: [8, 8], html: `<div style="width:16px;height:16px;border-radius:4px;transform:rotate(45deg);background:${on ? "#fff" : "#fbbf24"};border:2px solid #0A1225;box-shadow:0 0 16px rgba(251,191,36,.9)"></div>` });

export default function MapPage() {
  useSeo({ title: "Map of Burdwan: homes and video tours", description: "Every home and video tour on a live map of Burdwan. Tap a place to fly there." });
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const [data, setData] = useState(null);
  const [mode, setMode] = useState("all");
  const [sel, setSel] = useState(null);
  const [vids, setVids] = useState([]);

  useEffect(() => { api.get("/map/data").then(r => setData(r.data)).catch(() => setData({ zones: [], properties: [], landmarks: [], center: [23.235, 87.865], totals: { properties: 0, videos: 0 } })); }, []);

  useEffect(() => {
    const m = L.map(el.current, { zoomControl: false, scrollWheelZoom: true, zoomSnap: 0.25 }).setView([23.235, 87.865], 13);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, className: "dark-tiles", attribution: "&copy; OpenStreetMap contributors" }).addTo(m);   // the standard tiles, turned dark with a CSS filter (no key needed)
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, []);

  const props = useMemo(() => (data?.properties || []).filter(p => sel && p.zone === sel.zone), [data, sel]);

  useEffect(() => {
    if (!map.current || !data) return;
    layer.current.clearLayers();
    const bounds = [];
    data.zones.forEach(z => {
      const n = mode === "homes" ? z.properties : mode === "videos" ? z.videos : z.properties + z.videos;
      if (!n) return;
      const on = sel?.zone === z.zone;
      L.marker([z.lat, z.lng], { icon: bubble(z, on, mode), keyboard: true, title: `${z.zone}: ${z.properties} homes, ${z.videos} video tours`, zIndexOffset: on ? 1000 : 0 })
        .on("click", () => pick(z)).addTo(layer.current);
      bounds.push([z.lat, z.lng]);
    });
    if (mode !== "videos" && sel) (data.properties || []).filter(p => p.zone === sel.zone).forEach(p => {
      L.marker([p.lat, p.lng], { icon: house(false) }).bindPopup(`<a href="/properties/${esc(p.slug)}" style="font-weight:600;color:#0A1225">${esc(p.title)}</a><div style="font-size:12px;color:#555">${esc(p.zone)}${p.area_sqft ? ` · ${esc(p.area_sqft)} sqft` : ""}</div>`).addTo(layer.current);
    });
    (data.landmarks || []).forEach(l => L.marker([l.lat, l.lng], { icon: dot, interactive: true, title: l.name }).bindTooltip(l.name, { direction: "top" }).addTo(layer.current));
    if (!sel && bounds.length > 1) map.current.fitBounds(bounds, { padding: [90, 90], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, mode, sel]);

  function pick(z) {
    setSel(z);
    map.current?.flyTo([z.lat, z.lng], 15.25, { duration: 1.6, easeLinearity: 0.2 });
    setVids([]);
    api.get("/video-listings", { params: { zone: z.zone, limit: 6 } }).then(r => setVids(r.data.items || [])).catch(() => {});
  }
  const reset = () => { setSel(null); setVids([]); map.current?.flyTo(data?.center || [23.235, 87.865], 13, { duration: 1.2 }); };
  const zones = (data?.zones || []).slice().sort((a, b) => (b.properties + b.videos) - (a.properties + a.videos));

  return (
    <div className="relative h-[100svh] min-h-[560px] bg-[#060d1c]" data-testid="map-page">
      <div ref={el} className="absolute inset-0 z-0" aria-label="Map of Burdwan with homes and video tours"/>
      <div className="absolute inset-0 pointer-events-none z-[1] shadow-[inset_0_120px_120px_-60px_#060d1c,inset_0_-80px_100px_-60px_#060d1c]"/>

      {/* title and layers */}
      <div className="absolute z-[500] left-3 md:left-8 top-24 md:top-28 max-w-[calc(100%-1.5rem)] pointer-events-none">
        <div className="chapter pointer-events-auto" data-n="◎">Map of Burdwan</div>
        <h1 className="mt-3 font-display text-4xl md:text-6xl leading-[0.98] text-urbanex-ivory pointer-events-auto">Fly to your <em className="italic text-gold-gradient">neighbourhood.</em></h1>
        <div className="mt-4 flex gap-1.5 pointer-events-auto" role="group" aria-label="What to show">
          {[["all", "Everything"], ["homes", "Homes"], ["videos", "Video tours"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setMode(k)} aria-pressed={mode === k} data-testid={`map-mode-${k}`}
              className={`rounded-full px-4 py-1.5 text-xs border backdrop-blur ${mode === k ? "bg-urbanex-gold text-urbanex-navy border-urbanex-gold" : "bg-urbanex-navy/60 text-urbanex-ivory/80 border-white/20 hover:border-urbanex-gold"}`}>{l}</button>
          ))}
        </div>
        {data && <div className="mt-3 text-xs text-urbanex-ivory/60 pointer-events-auto">{data.totals.properties} homes · {data.totals.videos} video tours · {data.zones.length} places</div>}
      </div>

      {/* places list (scrolls sideways on phones) */}
      <div className="absolute z-[500] left-0 right-0 bottom-0 md:left-8 md:right-auto md:bottom-8 md:w-72 p-3 md:p-0">
        <div className="md:glass-dark md:rounded-2xl md:max-h-[42vh] md:overflow-y-auto md:p-2 flex md:block gap-2 overflow-x-auto no-scrollbar" data-testid="map-zones">
          {zones.map(z => (
            <button key={z.zone} type="button" onClick={() => pick(z)} aria-pressed={sel?.zone === z.zone}
              className={`shrink-0 md:w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm backdrop-blur ${sel?.zone === z.zone ? "bg-urbanex-gold text-urbanex-navy" : "bg-urbanex-navy/70 md:bg-transparent text-urbanex-ivory hover:bg-white/10"}`}>
              <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5"/>{z.zone}</span>
              <span className="text-[11px] opacity-75 whitespace-nowrap">{z.properties}<Building2 className="inline w-3 h-3 mx-0.5 -mt-0.5"/>{z.videos}<Play className="inline w-3 h-3 ml-0.5 -mt-0.5"/></span>
            </button>
          ))}
        </div>
      </div>

      {/* the chosen place */}
      <AnimatePresence>
        {sel && (
          <motion.aside key={sel.zone} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute z-[600] right-3 md:right-8 top-[52%] md:top-28 bottom-24 md:bottom-8 w-[min(22rem,calc(100%-1.5rem))] glass-dark rounded-3xl p-5 overflow-y-auto text-urbanex-ivory" data-testid="map-panel">
            <div className="flex items-start justify-between gap-3">
              <div><div className="text-[11px] tracking-[0.2em] uppercase text-urbanex-gold">Burdwan</div><h2 className="font-display text-3xl leading-tight">{sel.zone}</h2><div className="text-xs text-urbanex-ivory/60">{sel.properties} homes · {sel.videos} video tours</div></div>
              <button type="button" onClick={reset} aria-label="Close" className="p-1.5 rounded-full bg-white/10 hover:bg-white/20"><X className="w-4 h-4"/></button>
            </div>
            {props.length > 0 && <div className="mt-4"><div className="text-[11px] tracking-[0.2em] uppercase text-urbanex-ivory/50 mb-2">Homes here</div>
              <ul className="space-y-2">{props.map(p => (
                <li key={p.id}><Link to={`/properties/${p.slug}`} className="flex gap-3 rounded-xl bg-white/5 hover:bg-white/10 p-2">
                  {p.image ? <img src={assetUrl(p.image, 160)} alt="" loading="lazy" className="w-16 h-12 object-cover rounded-lg"/> : <div className="w-16 h-12 rounded-lg bg-white/10"/>}
                  <div className="min-w-0"><div className="text-sm truncate">{p.title}</div><div className="text-[11px] text-urbanex-ivory/55">{[p.bedrooms ? `${p.bedrooms} BHK` : null, p.property_type, p.area_sqft ? `${p.area_sqft} sqft` : null].filter(Boolean).join(" · ")}</div></div></Link></li>))}</ul></div>}
            {vids.length > 0 && <div className="mt-4"><div className="text-[11px] tracking-[0.2em] uppercase text-urbanex-ivory/50 mb-2">Video tours</div>
              <ul className="space-y-2">{vids.map(v => (
                <li key={v.video_id}><Link to={`/properties/video/${v.video_id}`} className="flex gap-3 rounded-xl bg-white/5 hover:bg-white/10 p-2">
                  <div className="relative shrink-0"><img src={v.thumbnail} alt="" loading="lazy" className="w-20 h-12 object-cover rounded-lg"/><Play className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow"/></div>
                  <div className="min-w-0 text-sm line-clamp-2">{v.title}</div></Link></li>))}</ul></div>}
            <Link to={`/properties?zone=${encodeURIComponent(sel.zone)}`} className="mt-5 inline-flex w-full justify-center rounded-full bg-urbanex-gold text-urbanex-navy py-2.5 text-sm font-medium">See everything in {sel.zone}</Link>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
