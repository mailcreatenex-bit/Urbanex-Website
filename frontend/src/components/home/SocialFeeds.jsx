import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Facebook, Instagram, Youtube } from "lucide-react";
import { api } from "@/lib/api";
import { assetUrl } from "@/lib/config";
import { SOCIAL, facebookEmbed, instagramEmbed } from "@/lib/social";
import { ThreadsIcon } from "@/components/common/SocialIcons";
import { useI18n } from "@/context/I18nContext";

// The third-party frames are only created once the section scrolls into view, so they cost nothing on first load.
function LazyFrame({ src, title, height }) {
  const box = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { rootMargin: "200px" });
    io.observe(box.current);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={box} style={{ height }} className="rounded-xl overflow-hidden bg-urbanex-navy/5">
      {on && <iframe src={src} title={title} loading="lazy" width="100%" height={height} style={{ border: 0 }} scrolling="no"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer-when-downgrade"/>}
    </div>
  );
}

function Window({ icon: Icon, tint, p, children, testid }) {
  const { t } = useI18n();
  return (
    <article className="bg-white rounded-3xl border border-urbanex-navy/10 shadow-[0_10px_40px_-25px_rgba(10,18,37,0.3)] overflow-hidden flex flex-col" data-testid={testid}>
      <header className="flex items-center gap-3 px-5 py-4 border-b border-urbanex-navy/10">
        <span className={`w-9 h-9 rounded-full flex items-center justify-center text-white ${tint}`}><Icon className="w-[18px] h-[18px]"/></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-urbanex-navy">{p.name}</div>
          <div className="text-xs text-urbanex-navy/50 truncate">{p.handle}</div>
        </div>
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs inline-flex items-center gap-1 rounded-full border border-urbanex-navy/15 hover:border-urbanex-gold hover:bg-urbanex-gold/10 px-3 py-1.5 text-urbanex-navy">
          {t("social.follow")} <ArrowUpRight className="w-3 h-3"/>
        </a>
      </header>
      <div className="p-4 flex-1">{children}</div>
    </article>
  );
}

// "Latest posts" windows: Facebook page feed and Instagram profile (embedded), YouTube (our own synced list),
// Threads (it offers no profile widget, so a card that opens the profile).
export default function SocialFeeds() {
  const { t } = useI18n();
  const [videos, setVideos] = useState([]);
  useEffect(() => { api.get("/video-listings", { params: { limit: 3 } }).then(r => setVideos(r.data.items || [])).catch(() => {}); }, []);

  return (
    <section className="cv-auto max-w-7xl mx-auto px-6 md:px-12 py-24" data-testid="social-feeds">
      <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-3">{t("social.eyebrow")}</div>
      <h2 className="font-display text-4xl md:text-5xl text-urbanex-navy leading-tight tracking-tight max-w-2xl text-balance">{t("social.title")}</h2>
      <div className="mt-12 grid sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <Window icon={Facebook} tint="bg-[#1877F2]" p={SOCIAL.facebook} testid="feed-facebook">
          <LazyFrame src={facebookEmbed(340, 420)} title="Urbanex Realty on Facebook" height={420}/>
        </Window>
        <Window icon={Instagram} tint="bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]" p={SOCIAL.instagram} testid="feed-instagram">
          <LazyFrame src={instagramEmbed} title="Urbanex on Instagram" height={420}/>
        </Window>
        <Window icon={Youtube} tint="bg-[#FF0000]" p={SOCIAL.youtube} testid="feed-youtube">
          <div className="space-y-3">
            {videos.length === 0 && <div className="text-sm text-urbanex-navy/50 py-10 text-center">{t("social.noVideos")}</div>}
            {videos.map(v => (
              <Link key={v.video_id} to={`/videos/${v.video_id}`} className="group flex gap-3 items-center rounded-xl hover:bg-urbanex-cream/60 p-1.5 -m-1.5 transition-colors">
                <img src={assetUrl(v.thumbnail)} alt="" loading="lazy" className="w-28 aspect-video object-cover rounded-lg shrink-0"/>
                <div className="min-w-0">
                  <div className="text-sm text-urbanex-navy leading-snug line-clamp-2 group-hover:text-urbanex-gold transition-colors">{v.title}</div>
                  <div className="text-[11px] text-urbanex-navy/45 mt-1">{(v.published_at || "").slice(0, 10)}</div>
                </div>
              </Link>
            ))}
          </div>
        </Window>
        <Window icon={ThreadsIcon} tint="bg-black" p={SOCIAL.threads} testid="feed-threads">
          <div className="h-[420px] rounded-xl bg-gradient-to-b from-urbanex-cream to-white flex flex-col items-center justify-center text-center px-6 gap-4">
            <ThreadsIcon className="w-14 h-14 text-urbanex-navy"/>
            <p className="text-sm text-urbanex-navy/65 leading-relaxed">{t("social.threadsBody")}</p>
            <a href={SOCIAL.threads.url} target="_blank" rel="noopener noreferrer" className="bg-urbanex-navy text-urbanex-ivory rounded-full px-6 py-2.5 text-sm hover:bg-urbanex-navyLight">{t("social.threadsBtn")}</a>
          </div>
        </Window>
      </div>
    </section>
  );
}
