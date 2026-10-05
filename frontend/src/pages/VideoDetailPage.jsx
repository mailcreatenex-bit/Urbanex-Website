import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BedDouble, MapPin, MessageCircle, Ruler, Youtube } from "lucide-react";
import { api } from "@/lib/api";
import { shareUrl } from "@/lib/config";
import { useI18n } from "@/context/I18nContext";
import { useSeo } from "@/lib/seo";
import PriceBlock from "@/components/common/PriceBlock";
import YouTubeClip from "@/components/videos/YouTubeClip";
import VideoCard from "@/components/videos/VideoCard";

export default function VideoDetailPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const [v, setV] = useState(null);
  const [missing, setMissing] = useState(false);
  const [related, setRelated] = useState([]);

  useEffect(() => {
    setV(null); setMissing(false);
    api.get(`/video-listings/${id}`).then(r => setV(r.data)).catch(() => setMissing(true));
  }, [id]);
  useEffect(() => {
    if (!v?.zone) { setRelated([]); return; }
    api.get("/video-listings", { params: { zone: v.zone, limit: 4 } })
      .then(r => setRelated(r.data.items.filter(x => x.video_id !== v.video_id).slice(0, 3))).catch(() => {});
  }, [v]);

  // Structured data and meta deliberately leave out any price: it is unlocked by "Interested".
  useSeo(v ? {
    title: v.title, description: [v.zone, v.bedrooms ? `${v.bedrooms} BHK` : null, v.description].filter(Boolean).join(" · ").slice(0, 200), image: v.thumbnail,
    jsonLd: { "@context": "https://schema.org", "@type": "VideoObject", name: v.title, description: v.description || v.title,
      thumbnailUrl: v.thumbnail, uploadDate: v.published_at, embedUrl: `https://www.youtube.com/embed/${v.video_id}` },
  } : { title: "Video" });

  if (missing) return <div className="max-w-3xl mx-auto px-6 py-24 text-urbanex-navy/60">Video not found. <Link to="/videos" className="underline">{t("videos.back")}</Link></div>;
  if (!v) return <div className="max-w-3xl mx-auto px-6 py-24 text-urbanex-navy/50">{t("common.loading")}</div>;

  const link = shareUrl("videos", v.video_id);
  return (
    <div className="max-w-6xl mx-auto px-6 md:px-12 py-12 md:py-16">
      <Link to="/videos" className="inline-flex items-center gap-2 text-sm text-urbanex-navy/60 hover:text-urbanex-navy mb-8"><ArrowLeft className="w-4 h-4"/> {t("videos.back")}</Link>
      <div className="grid md:grid-cols-12 gap-10">
        <div className="md:col-span-8">
          <YouTubeClip id={v.video_id} title={v.title} thumbnail={v.thumbnail} className="rounded-3xl"/>
          <h1 className="mt-8 font-display text-3xl md:text-5xl text-urbanex-navy leading-tight text-balance">{v.title}</h1>
          {v.description && <p className="mt-5 text-urbanex-navy/75 leading-relaxed whitespace-pre-line max-w-2xl">{v.description}</p>}
          <a href={`https://www.youtube.com/watch?v=${v.video_id}`} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 text-sm text-urbanex-navy/60 hover:text-urbanex-gold"><Youtube className="w-4 h-4"/> {t("videos.watchOnYouTube")}</a>
        </div>
        <aside className="md:col-span-4">
          <div className="sticky top-28 bg-white rounded-2xl p-7 border border-urbanex-navy/10 shadow-[0_20px_60px_-30px_rgba(10,18,37,0.18)] space-y-5">
            <PriceBlock type="video" item={v} size="detail"/>
            <div className="space-y-2 text-sm text-urbanex-navy/75">
              {v.zone && <div className="flex justify-between"><span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-urbanex-gold"/> {t("detail.location")}</span><span>{v.zone}</span></div>}
              {v.property_type && <div className="flex justify-between"><span>{t("detail.type")}</span><span>{t(`type.${v.property_type}`)}</span></div>}
              {v.bedrooms != null && <div className="flex justify-between"><span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5 text-urbanex-gold"/> {t("detail.bedrooms")}</span><span>{v.bedrooms}</span></div>}
              {v.area_sqft && <div className="flex justify-between"><span className="flex items-center gap-1"><Ruler className="w-3.5 h-3.5 text-urbanex-gold"/> {t("detail.area")}</span><span>{v.area_sqft} sqft</span></div>}
              {v.status && <div className="flex justify-between"><span>{t("detail.status")}</span><span>{t(`status.${v.status}`)}</span></div>}
            </div>
            <a href={`https://wa.me/?text=${encodeURIComponent(`${v.title}\n${link}`)}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs px-4 py-2 rounded-full border border-urbanex-navy/15 hover:border-urbanex-gold text-urbanex-navy/80"><MessageCircle className="w-3.5 h-3.5"/> {t("share.whatsapp")}</a>
          </div>
        </aside>
      </div>
      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="font-display text-3xl text-urbanex-navy mb-6">{t("videos.more.zone", { zone: v.zone })}</h2>
          <div className="grid md:grid-cols-3 gap-8">{related.map(r => <VideoCard key={r.video_id} video={r}/>)}</div>
        </section>
      )}
    </div>
  );
}
