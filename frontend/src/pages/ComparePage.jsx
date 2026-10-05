import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import { assetUrl, inr } from "@/lib/config";
import { useAuth } from "@/context/AuthContext";
import { useViewer } from "@/context/ViewerContext";
import { useFavorites, MAX_COMPARE } from "@/context/FavoritesContext";
import { useI18n } from "@/context/I18nContext";
import { useSeo } from "@/lib/seo";

export default function ComparePage() {
  const [sp, setSp] = useSearchParams();
  const ids = (sp.get("ids") || "").split(",").filter(Boolean).slice(0, MAX_COMPARE);
  const { user, loading } = useAuth();
  const { unlocked, press } = useViewer();
  const { clearCompare } = useFavorites();
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const key = ids.join(",");
  useSeo({ title: "Compare properties", description: "Compare Urbanex properties side by side." });

  useEffect(() => {
    if (loading) return;
    if (!key) { setItems([]); return; }
    Promise.all(key.split(",").map(id => api.get(`/properties/${id}`).then(r => r.data).catch(() => null)))
      .then(rs => setItems(rs.filter(Boolean)));
  }, [key, user?.user_id, loading]);

  const remove = (id) => {
    const rest = ids.filter(x => x !== id);
    setSp(rest.length ? { ids: rest.join(",") } : {});
  };

  const rows = [
    ["Zone", p => p.zone],
    [t("detail.type"), p => t(`type.${p.property_type}`)],
    [t("card.askPrice"), p => { const i = unlocked("property", p.id); return i ? (i.price_inr ? inr(i.price_inr) : t("interest.onRequestShort")) : <button onClick={() => press("property", p)} className="text-urbanex-gold underline text-sm">{t("interest.btn")}</button>; }],
    [t("detail.area"), p => `${p.area_sqft} sqft`],
    [t("detail.bedrooms"), p => p.bedrooms ?? "—"],
    [t("detail.bathrooms"), p => p.bathrooms ?? "—"],
    [t("detail.status"), p => t(`status.${p.status}`)],
    [t("detail.possession"), p => p.possession ? t(`possession.${p.possession}`) : "—"],
    [t("detail.furnishing"), p => p.furnishing ? t(`furnishing.${p.furnishing}`) : "—"],
    [t("card.verified"), p => p.verified ? "✓" : "—"],
    [t("detail.reraNo"), p => p.rera_number || "—"],
    [t("detail.amenities"), p => (p.amenities || []).join(", ") || "—"],
    [t("detail.nearby"), p => (p.nearby || []).slice(0, 3).map(n => `${n.name} (${n.distance_km} km)`).join("; ") || "—"],
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <h1 className="font-display text-5xl text-urbanex-navy tracking-tight">{t("compare.title")}</h1>
      {!items.length ? (
        <p className="mt-8 text-urbanex-navy/60">{t("compare.empty")} <Link to="/properties" className="underline">{t("nav.properties")}</Link></p>
      ) : (
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm border-collapse" data-testid="compare-table">
            <thead>
              <tr>
                <th className="w-40"/>
                {items.map(p => (
                  <th key={p.id} className="align-top p-3 text-left font-normal">
                    <div className="relative">
                      <button onClick={() => remove(p.id)} aria-label="Remove" className="absolute -top-1 right-0 p-1 rounded-full bg-white shadow"><X className="w-3 h-3"/></button>
                      <img src={assetUrl(p.image, 600)} alt={p.title} loading="lazy" className="w-full aspect-video object-cover rounded-xl"/>
                      <Link to={`/properties/${p.slug || p.id}`} className="mt-2 block font-display text-xl text-urbanex-navy hover:text-urbanex-gold">{p.title}</Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, fn]) => (
                <tr key={label} className="border-t border-urbanex-navy/10">
                  <td className="py-3 pr-3 text-urbanex-navy/50 align-top">{label}</td>
                  {items.map(p => <td key={p.id} className="p-3 text-urbanex-navy align-top capitalize">{fn(p)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => { clearCompare(); setSp({}); }} className="mt-6 text-sm text-urbanex-navy/60 hover:text-urbanex-navy">{t("compare.clear")}</button>
        </div>
      )}
    </div>
  );
}
