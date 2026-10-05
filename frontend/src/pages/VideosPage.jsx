import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import VideoCard from "@/components/videos/VideoCard";
import DigestSignup from "@/components/common/DigestSignup";
import { api } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { useSeo } from "@/lib/seo";

const EMPTY = { q: "", zone: "", property_type: "", min_bedrooms: "", budget: "", sort: "newest" };
const TYPES = ["apartment", "villa", "plot", "commercial"];
const BUDGETS = ["b1", "b2", "b3", "b4", "b5"];
const sel = "bg-white border border-urbanex-navy/20 rounded-full px-4 py-2 text-sm text-urbanex-navy max-w-full";

export default function VideosPage() {
  const { t } = useI18n();
  const [f, setF] = useState(EMPTY);
  const [facets, setFacets] = useState({ zones: [], total: 0 });
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [understood, setUnderstood] = useState(null);
  const [loading, setLoading] = useState(true);
  useSeo({ title: "Property video tours in Burdwan", description: "Watch every Urbanex property video tour and filter by location, type, bedrooms and budget." });

  useEffect(() => { api.get("/video-listings/facets").then(r => setFacets(r.data)).catch(() => {}); }, []);

  const params = useCallback((p) => {
    const q = { page: p, limit: 12 };
    Object.entries(f).forEach(([k, v]) => { if (v !== "" && !(k === "sort" && v === "newest")) q[k] = v; });
    return q;
  }, [f]);

  // new filters: start again from page 1 (debounced for the search box)
  useEffect(() => {
    let live = true;
    setLoading(true);
    const h = setTimeout(() => {
      api.get("/video-listings", { params: params(1) })
        .then(r => { if (!live) return; setItems(r.data.items); setPage(1); setPages(r.data.pages); setTotal(r.data.total); setUnderstood(r.data.interpreted || null); })
        .catch(() => { if (live) { setItems([]); setTotal(0); setUnderstood(null); } })
        .finally(() => { if (live) setLoading(false); });
    }, 250);
    return () => { live = false; clearTimeout(h); };
  }, [params]);

  const more = async () => {
    const next = page + 1;
    const { data } = await api.get("/video-listings", { params: params(next) });
    setItems(cur => [...cur, ...data.items]);
    setPage(next); setPages(data.pages);
  };

  const set = (k) => (e) => setF(c => ({ ...c, [k]: e.target.value }));
  const dirty = JSON.stringify(f) !== JSON.stringify(EMPTY);

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-4">YouTube</div>
      <h1 className="font-display text-4xl md:text-6xl text-urbanex-navy leading-[1.05] tracking-tight max-w-3xl text-balance">{t("videos.title")}</h1>
      <p className="mt-6 text-urbanex-navy/70 max-w-2xl leading-relaxed">{t("videos.sub")}</p>

      <div className="mt-10 space-y-3 pb-4 border-b border-urbanex-navy/10">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-urbanex-navy/40"/>
          <input value={f.q} onChange={set("q")} placeholder={t("videos.search")} maxLength={100} data-testid="video-filter-q" className="w-full bg-white border border-urbanex-navy/20 rounded-full pl-11 pr-4 py-2 text-sm"/>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select aria-label="Location" value={f.zone} onChange={set("zone")} className={sel} data-testid="video-filter-zone">
            <option value="">{t("videos.allZones")}</option>
            {facets.zones.map(z => <option key={z.zone} value={z.zone}>{`${z.zone} (${z.count})`}</option>)}
          </select>
          <select aria-label="Type" value={f.property_type} onChange={set("property_type")} className={sel} data-testid="video-filter-type">
            <option value="">{t("videos.allTypes")}</option>
            {TYPES.map(x => <option key={x} value={x}>{t(`type.${x}`)}</option>)}
          </select>
          <select aria-label="BHK" value={f.min_bedrooms} onChange={set("min_bedrooms")} className={sel}>
            <option value="">{t("videos.anyBeds")}</option>
            {[1, 2, 3, 4].map(n => <option key={n} value={n}>{`${n}+ BHK`}</option>)}
          </select>
          <select aria-label="Budget" value={f.budget} onChange={set("budget")} className={sel} data-testid="video-filter-budget">
            <option value="">{t("videos.anyBudget")}</option>
            {BUDGETS.map(b => <option key={b} value={b}>{t(`quiz.a.${b}`)}</option>)}
          </select>
          <select aria-label="Sort" value={f.sort} onChange={set("sort")} className={sel}>
            <option value="newest">{t("videos.newest")}</option>
            <option value="oldest">{t("videos.oldest")}</option>
          </select>
          {dirty && <button type="button" onClick={() => setF(EMPTY)} className="text-sm text-urbanex-navy/60 hover:text-urbanex-navy px-2">{t("props.clear")}</button>}
          <span className="ml-auto text-xs text-urbanex-navy/50 font-mono" data-testid="video-total">{t("videos.results", { n: total })}</span>
        </div>
      </div>

      {f.q.trim() && understood && (
        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-urbanex-navy/70" data-testid="video-understood">
          <span>{understood.source === "ai" ? t("videos.aiUnderstood") : t("videos.understood")}</span>
          {understood.bedrooms != null && <span className="bg-urbanex-gold/15 rounded-full px-3 py-1">{understood.bedrooms} BHK</span>}
          {understood.property_type && <span className="bg-urbanex-gold/15 rounded-full px-3 py-1">{t(`type.${understood.property_type}`)}</span>}
          {understood.zone && <span className="bg-urbanex-gold/15 rounded-full px-3 py-1">{understood.zone}</span>}
          {understood.budget && <span className="bg-urbanex-gold/15 rounded-full px-3 py-1">{t(`quiz.a.${understood.budget}`)}</span>}
          {(understood.keywords || []).map(k => <span key={k} className="bg-urbanex-navy/5 rounded-full px-3 py-1">{k}</span>)}
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" data-testid="video-grid">
        {items.map(v => <VideoCard key={v.video_id} video={v}/>)}
      </div>
      {!loading && items.length === 0 && <div className="py-24 text-center text-urbanex-navy/50">{t("videos.none")}</div>}
      {page < pages && (
        <div className="mt-12 text-center">
          <button onClick={more} data-testid="video-more" className="border border-urbanex-navy/20 hover:border-urbanex-gold rounded-full px-8 py-3 text-sm text-urbanex-navy">{t("videos.more")}</button>
        </div>
      )}
      <div className="mt-20 pt-10 border-t border-urbanex-navy/10"><DigestSignup/></div>
    </div>
  );
}
