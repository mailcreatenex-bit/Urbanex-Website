import { useEffect, useState } from "react";
import { Play, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function VideoShowcase() {
  const [videos, setVideos] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    api.get("/videos").then(r => setVideos(r.data || [])).catch(() => setVideos([]));
  }, []);

  if (!videos.length) return null;

  return (
    <section className="max-w-7xl mx-auto px-6 md:px-12 py-24">
      <div className="flex items-end justify-between mb-10 flex-wrap gap-6">
        <div>
          <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-3">Site walkthroughs</div>
          <h2 className="font-display text-4xl md:text-5xl text-urbanex-navy leading-tight tracking-tight max-w-2xl">
            Watch every property before you visit.
          </h2>
        </div>
        <div className="flex items-center gap-5 text-sm"><Link to="/properties" data-testid="home-browse-videos" className="text-urbanex-navy hover:text-urbanex-gold">Browse all videos →</Link><a href="https://www.youtube.com/@urbanexbyayandey" target="_blank" rel="noreferrer" className="text-urbanex-navy/60 hover:text-urbanex-gold">Full channel →</a></div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {videos.slice(0, 6).map((v, idx) => (
          <motion.button
            key={v.video_id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.05, duration: 0.5 }}
            onClick={() => setActive(v)}
            data-testid={`video-card-${v.video_id}`}
            className="group relative overflow-hidden rounded-2xl bg-urbanex-navy text-left"
          >
            <img src={v.thumbnail} alt={v.title} className="w-full h-64 object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"/>
            <div className="absolute inset-0 bg-gradient-to-t from-urbanex-navy via-urbanex-navy/40 to-transparent"/>
            <div className="absolute top-4 left-4 w-12 h-12 rounded-full bg-urbanex-gold text-urbanex-navy flex items-center justify-center">
              <Play className="w-5 h-5 fill-current"/>
            </div>
            <div className="absolute bottom-4 left-4 right-4">
              <div className="text-xs tracking-[0.2em] uppercase text-urbanex-gold mb-1">{v.published}</div>
              <div className="text-urbanex-ivory font-display text-lg leading-tight line-clamp-2">{v.title}</div>
            </div>
          </motion.button>
        ))}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-5xl bg-urbanex-navy border-none p-0 overflow-hidden">
          {active && (
            <div className="aspect-video">
              <iframe
                width="100%" height="100%"
                src={`https://www.youtube.com/embed/${active.video_id}?autoplay=1`}
                title={active.title} frameBorder="0"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
