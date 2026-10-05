import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useViewer } from "@/context/ViewerContext";
import { useI18n } from "@/context/I18nContext";
import { inr } from "@/lib/config";

const BURDWAN = [23.235, 87.865];

// Gold pin built from CSS so we don't depend on Leaflet's bundled marker images.
const pin = (active) => L.divIcon({
  className: "",
  html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${active ? "#0A1225" : "#C5A059"};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 22],
  popupAnchor: [0, -20],
});

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// OpenStreetMap tiles (no API key). `items` need latitude/longitude. Pass onSearchArea to show the "search this area" button.
export default function PropertyMap({ items, height = 480, single = false, onSearchArea, onShowAll }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const { prices } = useViewer();
  const { t } = useI18n();

  useEffect(() => {
    map.current = L.map(el.current, { scrollWheelZoom: false }).setView(BURDWAN, 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    layer.current.clearLayers();
    const pts = [];
    (items || []).filter(p => p.latitude != null && p.longitude != null).forEach(p => {
      const unlockedPrice = prices[`property:${p.id}`]?.price_inr;
      const price = unlockedPrice ? `<div style="color:#C5A059;margin-top:2px">${esc(inr(unlockedPrice))}</div>` : "";
      L.marker([p.latitude, p.longitude], { icon: pin(single) })
        .bindPopup(`<a href="/properties/${esc(p.slug || p.id)}" style="font-weight:600;color:#0A1225">${esc(p.title)}</a><div style="font-size:12px;color:#555">${esc(p.zone)} · ${esc(p.area_sqft)} sqft</div>${price}`)
        .addTo(layer.current);
      pts.push([p.latitude, p.longitude]);
    });
    if (single && pts.length === 1) map.current.setView(pts[0], 15);
    else if (pts.length) map.current.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
  }, [items, prices, single]);

  const searchArea = () => {
    const b = map.current.getBounds();
    onSearchArea?.(`${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`);
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-urbanex-navy/10" style={{ height }}>
      <div ref={el} className="w-full h-full z-0" data-testid="property-map"/>
      {(onSearchArea || onShowAll) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] flex gap-2">
          {onSearchArea && <button onClick={searchArea} className="bg-white text-urbanex-navy text-xs px-4 py-2 rounded-full shadow border border-urbanex-navy/10 hover:border-urbanex-gold">{t("props.searchArea")}</button>}
          {onShowAll && <button onClick={onShowAll} className="bg-white text-urbanex-navy text-xs px-4 py-2 rounded-full shadow border border-urbanex-navy/10 hover:border-urbanex-gold">{t("props.allArea")}</button>}
        </div>
      )}
    </div>
  );
}
