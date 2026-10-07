import { Link } from "react-router-dom";
import { BedDouble, Heart, MapPin, Ruler } from "lucide-react";
import { useFavorites } from "@/context/FavoritesContext";
import PriceBlock from "@/components/common/PriceBlock";
import CardActions from "@/components/common/CardActions";
import YouTubeClip from "@/components/videos/YouTubeClip";
import Tilt from "@/components/fx/Tilt";
import { useI18n } from "@/context/I18nContext";

export default function VideoCard({ video }) {
  const { t } = useI18n();
  const { has, toggle } = useFavorites();
  const saved = has(video.video_id);
  const dur = video.duration_seconds ? `${Math.floor(video.duration_seconds / 60)}:${String(video.duration_seconds % 60).padStart(2, "0")}` : null;
  return (
    <Tilt className="rounded-2xl" max={5}>
    <article className="group bg-white rounded-2xl overflow-hidden border border-urbanex-navy/5 hover:border-urbanex-gold/40 shadow-[0_4px_20px_-4px_rgba(10,18,37,0.05)] hover:shadow-[0_20px_50px_-20px_rgba(10,18,37,0.18)] transition-all duration-500" data-testid={`video-card-${video.video_id}`}>
      <div className="relative">
        <YouTubeClip id={video.video_id} title={video.title} thumbnail={video.thumbnail} className="rounded-none"/>
        <div className="absolute top-3 left-3 flex gap-2 pointer-events-none">
          {video.is_short && <span className="text-[10px] tracking-[0.2em] uppercase bg-urbanex-navy/85 text-urbanex-ivory px-3 py-1 rounded-full">{t("videos.short")}</span>}
          {video.status && video.status !== "available" && <span className="text-[10px] tracking-[0.2em] uppercase bg-urbanex-gold text-urbanex-navy px-3 py-1 rounded-full">{t(`status.${video.status}`)}</span>}
        </div>
        <button type="button" onClick={() => toggle(video.video_id)} aria-pressed={saved} aria-label={t("card.shortlist")} data-testid={`video-heart-${video.video_id}`}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow transition-transform active:scale-90">
          <Heart className={`w-5 h-5 ${saved ? "fill-red-500 text-red-500" : "text-urbanex-navy"}`}/>
        </button>
        {dur && <span className="absolute bottom-3 right-3 text-[11px] bg-black/70 text-white rounded px-1.5 py-0.5 pointer-events-none">{dur}</span>}
      </div>
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-urbanex-navy/60">
          <span className="flex items-center gap-1" data-testid="video-card-zone"><MapPin className="w-3.5 h-3.5 text-urbanex-gold"/> {video.zone || "Burdwan"}</span>
          {video.bedrooms != null && <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5 text-urbanex-gold"/> {video.bedrooms} BHK</span>}
          {video.area_sqft && <span className="flex items-center gap-1"><Ruler className="w-3.5 h-3.5 text-urbanex-gold"/> {video.area_sqft} sqft</span>}
          {video.property_type && <span className="capitalize bg-urbanex-gold/15 text-urbanex-navy rounded-full px-2.5 py-0.5" data-testid="video-card-type">{t(`type.${video.property_type}`)}</span>}
        </div>
        <Link to={`/properties/video/${video.video_id}`} className="mt-2 block font-display text-xl text-urbanex-navy leading-snug line-clamp-2 hover:text-urbanex-gold transition-colors">{video.title}</Link>
        <div className="mt-4"><PriceBlock type="video" item={video}/></div>
        <CardActions kind="videos" id={video.video_id} title={video.title} zone={video.zone}/>
      </div>
    </article>
    </Tilt>
  );
}
