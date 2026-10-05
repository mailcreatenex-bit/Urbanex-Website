import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import VideoCard from "@/components/videos/VideoCard";
import { useI18n } from "@/context/I18nContext";

// The three newest uploads from the YouTube channel, straight under the hero. New uploads show up here
// automatically (the backend syncs the channel); each card has the same "Interested" price gate as the Properties page.
export default function LatestVideos() {
  const { t } = useI18n();
  const [items, setItems] = useState(null);

  useEffect(() => {
    api.get("/video-listings", { params: { limit: 3, sort: "newest" } })
      .then(r => setItems(r.data.items || []))
      .catch(() => setItems([]));
  }, []);

  if (items && items.length === 0) return null;   // nothing synced yet (or YouTube not configured): no empty gap

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 pt-20 pb-6" data-testid="latest-videos">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
        <div>
          <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-3">{t("latest.eyebrow")}</div>
          <h2 className="font-display text-4xl md:text-5xl text-urbanex-navy leading-tight tracking-tight">{t("latest.title")}</h2>
        </div>
        <Link to="/properties" data-testid="latest-all" className="group inline-flex items-center gap-2 text-sm text-urbanex-navy hover:text-urbanex-gold">
          {t("videos.browseAll")} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1"/>
        </Link>
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        {items === null
          ? [0, 1, 2].map(i => <div key={i} className="rounded-2xl bg-urbanex-navy/5 aspect-[4/5] animate-pulse"/>)   // keeps the layout steady while loading
          : items.map(v => <VideoCard key={v.video_id} video={v}/>)}
      </div>
    </section>
  );
}
