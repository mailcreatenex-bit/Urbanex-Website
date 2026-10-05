import { Facebook, Instagram, Youtube } from "lucide-react";
import { SOCIAL } from "@/lib/social";

// lucide has no Threads glyph, so it is drawn inline (tiny)
export const ThreadsIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.5 8.6C16.8 5.9 14.9 4.5 12.1 4.5 8.6 4.5 6.4 7 6.4 12s2.2 7.5 5.7 7.5c3.1 0 5-1.6 5-3.9 0-2.5-2.2-3.6-4.8-3.4-2 .1-3.1.9-3.1 2.2 0 1.2 1 2 2.4 2 2 0 3.4-1.2 3.6-3.9.1-1.6-.1-3-1.3-3.9"/>
    <path d="M12.6 10.3c1.4 0 2.6.3 3.6 1"/>
  </svg>
);

// The recognisable YouTube play-button mark
export const YouTubeLogo = ({ className = "w-8 h-6" }) => (
  <svg viewBox="0 0 28 20" className={className} aria-hidden="true">
    <rect width="28" height="20" rx="5.6" fill="#FF0000"/>
    <path d="M11.2 5.6v8.8L19 10z" fill="#fff"/>
  </svg>
);

const ICONS = { facebook: Facebook, instagram: Instagram, threads: ThreadsIcon, youtube: Youtube };
export const SOCIAL_KEYS = ["facebook", "instagram", "youtube", "threads"];

// Round icon buttons that open each profile in a new tab. tone: "dark" (for navy backgrounds) | "light"
export default function SocialButtons({ tone = "dark", size = "w-10 h-10", className = "" }) {
  const base = tone === "dark"
    ? "border-white/20 text-urbanex-ivory/70 hover:text-urbanex-navy hover:bg-urbanex-gold hover:border-urbanex-gold"
    : "border-urbanex-navy/15 text-urbanex-navy/70 hover:text-urbanex-navy hover:bg-urbanex-gold hover:border-urbanex-gold";
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {SOCIAL_KEYS.map(k => {
        const Icon = ICONS[k];
        return (
          <a key={k} href={SOCIAL[k].url} target="_blank" rel="noopener noreferrer" aria-label={`Urbanex on ${SOCIAL[k].name}`} title={SOCIAL[k].name}
            data-testid={`social-${k}`} className={`${size} rounded-full border flex items-center justify-center transition-all hover:-translate-y-0.5 ${base}`}>
            <Icon className="w-[18px] h-[18px]"/>
          </a>
        );
      })}
    </div>
  );
}
