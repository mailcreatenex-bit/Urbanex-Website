import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import DigestSignup from "@/components/common/DigestSignup";
import { Bookmark, Map as MapIcon, LayoutGrid, Search, X } from "lucide-react";
import { toast } from "sonner";
import PropertyCard from "@/components/properties/PropertyCard";
import PropertyMap from "@/components/properties/PropertyMap";
import VideoTours from "@/components/videos/VideoTours";
import { api } from "@/lib/api";
import { PROP } from "@/constants/testIds";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useI18n } from "@/context/I18nContext";
import { useSeo } from "@/lib/seo";

const EMPTY = { q: "", listing_type: "", zone: "", property_type: "", status: "", min_bedrooms: "", furnishing: "", possession: "",
  min_area: "", max_area: "", budget: "", sort: "newest" };
const TYPES = ["apartment", "villa", "plot", "commercial"];
const sel = "bg-white border border-urbanex-navy/20 rounded-full px-4 py-2 text-sm text-urbanex-navy max-w-full";

export default function PropertiesPage() {
  const { user, loading, setLoginOpen } = useAuth();
  const { compare } = useFavorites();
  const { t } = useI18n();
  const uid = user?.user_id;
  useSeo({
    title: "Properties in Burdwan",
    description: "Apartments, villas, plots and commercial spaces across Burdwan, personally verified by Urbanex Realty.",
  });

  const [sp] = useSearchParams();
  const [f, setF] = useState(() => ({ ...EMPTY, zone: sp.get("zone") || "", property_type: sp.get("property_type") || "", min_bedrooms: sp.get("min_bedrooms") || "", listing_type: sp.get("listing_type") || "" }));
  const [bbox, setBbox] = useState(null);
  const [view, setView] = useState("list");
  const [zones, setZones] = useState([]);
  const [items, setItems] = useState([]);
  const [saved, setSaved] = useState([]);
  const [videoCount, setVideoCount] = useState(0);

  useEffect(() => { api.get("/config/public").then(r => setZones(r.data.zones || [])).catch(() => {}); }, []);

  const params = useMemo(() => {
    const p = {};
    Object.entries(f).forEach(([k, v]) => { if (v !== "" && !(k === "sort" && v === "newest")) p[k] = v; });
    if (bbox) p.bbox = bbox;
    return p;
  }, [f, bbox]);

  // Refetch on filter change (debounced) and on sign-in/out: prices only come back for authenticated users.
  useEffect(() => {
    if (loading) return;
    let live = true;
    const h = setTimeout(() => {
      api.get("/properties", { params })
        .then(r => { if (live) setItems(r.data || []); })
        .catch(e => { if (e?.response?.status === 401) setLoginOpen(true); });
    }, 250);
    return () => { live = false; clearTimeout(h); };
  }, [params, uid, loading, setLoginOpen]);

  const loadSaved = useCallback(() => {
    if (!uid) { setSaved([]); return; }
    api.get("/me/saved-searches").then(r => setSaved(r.data || [])).catch(() => {});
  }, [uid]);
  useEffect(loadSaved, [loadSaved]);

  const set = (k) => (e) => setF(cur => ({ ...cur, [k]: e.target.value }));

  const saveSearch = async () => {
    if (!user) return setLoginOpen(true);
    const name = window.prompt(t("props.saveName"), f.zone || f.property_type || "My search");
    if (!name) return;
    try {
      const { bbox: _ignored, ...plain } = params; // eslint-disable-line no-unused-vars
      await api.post("/me/saved-searches", { name, params: plain, notify: true });
      toast.success(t("props.saveDone"));
      loadSaved();
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not save"); }
  };
  const applySaved = (s) => { setBbox(null); setF({ ...EMPTY, ...Object.fromEntries(Object.entries(s.params).map(([k, v]) => [k, String(v)])) }); };
  const removeSaved = async (id) => { await api.delete(`/me/saved-searches/${id}`).catch(() => {}); loadSaved(); };

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-4">{t("props.eyebrow")}</div>
      <h1 className="font-display text-4xl md:text-6xl text-urbanex-navy leading-[1.05] tracking-tight max-w-3xl text-balance">{t("props.title")}</h1>
      <p className="mt-6 text-urbanex-navy/70 max-w-xl leading-relaxed">{t("props.sub")}</p>

      <div className="mt-10 space-y-3 pb-4 border-b border-urbanex-navy/10">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-urbanex-navy/40"/>
          <input value={f.q} onChange={set("q")} placeholder={t("props.search")} maxLength={100} data-testid="filter-q"
            className="w-full bg-white border border-urbanex-navy/20 rounded-full pl-11 pr-4 py-2 text-sm"/>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select aria-label="Buy or rent" value={f.listing_type} onChange={set("listing_type")} className={sel} data-testid="filter-listing">
            <option value="">{t("props.anyListing")}</option>
            <option value="sale">{t("props.buy")}</option>
            <option value="rent">{t("props.rent")}</option>
          </select>
          <select aria-label="Zone" data-testid={PROP.filterZone} value={f.zone} onChange={set("zone")} className={sel}>
            <option value="">{t("props.allZones")}</option>
            {zones.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
          <select aria-label="Type" data-testid={PROP.filterType} value={f.property_type} onChange={set("property_type")} className={sel}>
            <option value="">{t("props.allTypes")}</option>
            {TYPES.map(x => <option key={x} value={x}>{t(`type.${x}`)}</option>)}
          </select>
          <select aria-label="BHK" value={f.min_bedrooms} onChange={set("min_bedrooms")} className={sel}>
            <option value="">{t("props.anyBeds")}</option>
            {[1, 2, 3, 4].map(n => <option key={n} value={n}>{`${n}+ BHK`}</option>)}
          </select>
          <select aria-label="Status" value={f.status} onChange={set("status")} className={sel}>
            <option value="">{t("props.anyStatus")}</option>
            {["available", "upcoming", "sold"].map(x => <option key={x} value={x}>{t(`status.${x}`)}</option>)}
          </select>
          <select aria-label="Possession" value={f.possession} onChange={set("possession")} className={sel}>
            <option value="">{t("props.anyPossession")}</option>
            {["ready", "under_construction", "upcoming"].map(x => <option key={x} value={x}>{t(`possession.${x}`)}</option>)}
          </select>
          <select aria-label="Furnishing" value={f.furnishing} onChange={set("furnishing")} className={sel}>
            <option value="">{t("props.anyFurnish")}</option>
            {["unfurnished", "semi_furnished", "furnished"].map(x => <option key={x} value={x}>{t(`furnishing.${x}`)}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input type="number" min="0" value={f.min_area} onChange={set("min_area")} placeholder={t("props.minArea")} className={`${sel} w-32`}/>
          <input type="number" min="0" value={f.max_area} onChange={set("max_area")} placeholder={t("props.maxArea")} className={`${sel} w-32`}/>
          <select aria-label="Budget" value={f.budget} onChange={set("budget")} className={sel} data-testid="filter-budget">
            <option value="">{t("videos.anyBudget")}</option>
            {["b1", "b2", "b3", "b4", "b5"].map(b => <option key={b} value={b}>{t(`quiz.a.${b}`)}</option>)}
          </select>
          <select aria-label={t("props.sort")} value={f.sort} onChange={set("sort")} className={sel}>
            {["newest", "area_asc", "area_desc"].map(x => <option key={x} value={x}>{t(`props.sort.${x}`)}</option>)}
          </select>
          <button type="button" data-testid={PROP.clearFilters} onClick={() => { setF(EMPTY); setBbox(null); }} className="text-sm text-urbanex-navy/60 hover:text-urbanex-navy px-2">{t("props.clear")}</button>
          <button type="button" onClick={saveSearch} data-testid="save-search" className="inline-flex items-center gap-1.5 text-sm text-urbanex-navy border border-urbanex-gold rounded-full px-4 py-2 hover:bg-urbanex-gold/10">
            <Bookmark className="w-3.5 h-3.5"/> {user ? t("props.saveSearch") : t("props.signinSave")}
          </button>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-urbanex-navy/50 font-mono">{t("props.results", { n: items.length + videoCount })}</span>
            <div className="flex rounded-full border border-urbanex-navy/20 overflow-hidden">
              {[["list", LayoutGrid, t("props.list")], ["map", MapIcon, t("props.map")]].map(([k, Icon, label]) => (
                <button key={k} type="button" onClick={() => setView(k)} aria-pressed={view === k} data-testid={`view-${k}`}
                  className={`px-4 py-2 text-xs inline-flex items-center gap-1.5 ${view === k ? "bg-urbanex-navy text-urbanex-ivory" : "bg-white text-urbanex-navy/70"}`}>
                  <Icon className="w-3.5 h-3.5"/> {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {saved.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1" data-testid="saved-searches">
            <span className="text-xs text-urbanex-navy/50">{t("props.saved")}:</span>
            {saved.map(s => (
              <span key={s.id} className="inline-flex items-center gap-1 text-xs bg-urbanex-cream rounded-full pl-3 pr-1 py-1">
                <button type="button" onClick={() => applySaved(s)} className="hover:text-urbanex-gold">{s.name}</button>
                <button type="button" aria-label="Delete saved search" onClick={() => removeSaved(s.id)} className="p-1 hover:text-red-600"><X className="w-3 h-3"/></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {view === "map" && (
        <div className="mt-8">
          <PropertyMap items={items} height={520} onSearchArea={setBbox} onShowAll={bbox ? () => setBbox(null) : undefined}/>
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" data-testid={PROP.grid}>
        {items.map((p, i) => <PropertyCard key={p.id} property={p} idx={i}/>)}
      </div>

      {!items.length && !videoCount && <div className="py-24 text-center text-urbanex-navy/50">{t("props.none")}</div>}

      <VideoTours filters={f} onTotal={setVideoCount}/>

      <div className="mt-20 pt-10 border-t border-urbanex-navy/10"><DigestSignup/></div>

      {compare.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-urbanex-navy text-urbanex-ivory rounded-full shadow-xl px-6 py-3 flex items-center gap-4 text-sm" data-testid="compare-bar">
          <Link to={`/compare?ids=${compare.join(",")}`} className="font-medium hover:text-urbanex-gold">{t("compare.go", { n: compare.length })} →</Link>
        </div>
      )}
    </div>
  );
}
