import { useState } from "react";
import { Play } from "lucide-react";

// Click-to-load: no YouTube cookies or scripts until the visitor presses play.
export default function YouTubeClip({ id, title, thumbnail, autoPlay = false, className = "" }) {
  const [on, setOn] = useState(autoPlay);
  if (on) {
    return <iframe className={`w-full aspect-video rounded-xl ${className}`} src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
      title={title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen/>;
  }
  return (
    <button type="button" onClick={() => setOn(true)} className={`relative w-full aspect-video rounded-xl overflow-hidden group ${className}`} aria-label={`Play: ${title}`} data-testid={`play-${id}`}>
      <img src={thumbnail || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" loading="lazy" decoding="async"
        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`; }} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"/>
      <span className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/5 transition-colors">
        <span className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg"><Play className="w-6 h-6 text-urbanex-navy fill-urbanex-navy ml-0.5"/></span>
      </span>
    </button>
  );
}
