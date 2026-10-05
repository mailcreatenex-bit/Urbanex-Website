import { useCallback, useEffect, useRef, useState } from "react";
import VideoCard from "@/components/videos/VideoCard";
import { api } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";

// Every YouTube video of the channel, shown below the property listings and filtered by the same filter bar.
// The next page loads by itself while scrolling, so there is no "load more" button.
export default function VideoTours({ filters, onTotal }) {
  const { t } = useI18n();
  const f = {
    q: filters.q, zone: filters.zone, property_type: filters.property_type, min_bedrooms: filters.min_bedrooms, budget: filters.budget,
    sort: filters.sort === "oldest" ? "oldest" : "newest",
  };
  const fKey = JSON.stringify(f);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [understood, setUnderstood] = useState(null);
  const [loading, setLoading] = useState(true);
  const params = useCallback((p) => {
    const q = { page: p, limit: 24 };
    Object.entries(f).forEach(([k, v]) => { if (v !== "" && !(k === "sort" && v === "newest")) q[k] = v; });
    return q;
  }, [fKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
  useEffect(() => { onTotal?.(total); }, [total, onTotal]);

  // No "load more" button: the next page loads by itself as the visitor scrolls near the end of the list.
  const loadingMore = useRef(false);
  const more = useCallback(async () => {
    if (loadingMore.current) return;
    loadingMore.current = true;
    try {
      const next = page + 1;
      const { data } = await api.get("/video-listings", { params: params(next) });
      setItems(cur => [...cur, ...data.items]);
      setPage(next); setPages(data.pages);
    } catch { /* the next scroll tries again */ } finally { loadingMore.current = false; }
  }, [page, params]);
  const sentinel = useRef(null);
  const hasMore = !loading && page < pages;
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) more(); }, { rootMargin: "900px 0px" });
    io.observe(node);
    return () => io.disconnect();
  }, [hasMore, more, items.length]);


  if (!loading && items.length === 0) return null;
  return (
    <section className="mt-20" data-testid="video-tours">
      <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-3">YouTube</div>
      <h2 className="font-display text-3xl md:text-4xl text-urbanex-navy tracking-tight">{t("videos.title")}</h2>
      <p className="mt-3 text-urbanex-navy/60 text-sm font-mono" data-testid="video-total">{t("videos.results", { n: total })}</p>
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
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" data-testid="video-grid">
        {items.map(v => <VideoCard key={v.video_id} video={v}/>)}
      </div>
      {hasMore && <div ref={sentinel} className="h-24 mt-8 flex items-center justify-center text-xs text-urbanex-navy/40" data-testid="video-sentinel">{t("common.loading")}</div>}
    </section>
  );
}
