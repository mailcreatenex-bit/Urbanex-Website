import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PropertyCard from "@/components/properties/PropertyCard";
import VideoCard from "@/components/videos/VideoCard";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useI18n } from "@/context/I18nContext";
import { useSeo } from "@/lib/seo";

export default function ShortlistPage() {
  const { ids, prune } = useFavorites();
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [videos, setVideos] = useState([]);
  useSeo({ title: "Your shortlist", description: "Properties you saved on Urbanex Realty." });

  useEffect(() => {
    if (loading) return;
    let live = true;
    const wantVideos = ids.length ? api.get("/video-listings", { params: { ids: ids.slice(0, 100).join(","), limit: 100 } }) : Promise.resolve({ data: { items: [] } });
    Promise.all([api.get("/properties"), wantVideos]).then(([p, v]) => {
      if (!live) return;
      const props = (p.data || []).filter(x => ids.includes(x.id));
      const vids = v.data.items || [];
      setItems(props); setVideos(vids);
      const found = new Set([...props.map(x => x.id), ...vids.map(x => x.video_id)]);
      const gone = ids.filter(x => !found.has(x));
      if (gone.length) prune(gone);
    }).catch(() => {});
    return () => { live = false; };
  }, [ids, user?.user_id, loading, prune]);

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <h1 className="font-display text-5xl text-urbanex-navy tracking-tight">{t("shortlist.title")}</h1>
      {items.length === 0 && videos.length === 0 ? (
        <p className="mt-8 text-urbanex-navy/60">{t("shortlist.empty")} <Link to="/properties" className="underline">{t("nav.properties")}</Link></p>
      ) : (
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {items.map((p, i) => <PropertyCard key={p.id} property={p} idx={i}/>)}
        </div>
      )}
      {videos.length > 0 && (
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" data-testid="shortlist-videos">
          {videos.map(v => <VideoCard key={v.video_id} video={v}/>)}
        </div>
      )}
    </div>
  );
}
