import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { MapPin, BedDouble, Bath, Ruler, ArrowRight, Heart, ShieldCheck, GitCompareArrows } from "lucide-react";
import { useFavorites, MAX_COMPARE } from "@/context/FavoritesContext";
import { useI18n } from "@/context/I18nContext";
import PriceBlock from "@/components/common/PriceBlock";
import Tilt from "@/components/fx/Tilt";
import { PROP } from "@/constants/testIds";
import { assetUrl } from "@/lib/config";

export default function PropertyCard({ property, idx = 0 }) {
  const { has, toggle, compare, toggleCompare } = useFavorites();
  const { t } = useI18n();
  const saved = has(property.id);
  const comparing = compare.includes(property.id);
  const href = `/properties/${property.slug || property.id}`;

  return (
    <Tilt className="rounded-2xl" max={6}>
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay: (idx % 3) * 0.06 }}
      data-testid={PROP.card(property.id)}
      className="group bg-white rounded-2xl overflow-hidden border border-urbanex-navy/5 hover:border-urbanex-gold/40 shadow-[0_4px_20px_-4px_rgba(10,18,37,0.05)] hover:shadow-[0_20px_50px_-20px_rgba(10,18,37,0.18)] transition-all duration-500"
    >
      <div className="relative aspect-[5/4] overflow-hidden">
        <Link to={href} aria-label={property.title}>
          <img
            src={assetUrl(property.image, 800)}
            alt={property.title}
            loading="lazy"
            decoding="async"
            width="800"
            height="640"
            className="tilt-depth w-full h-full object-cover"
          />
        </Link>
        <div className="absolute top-4 left-4 flex flex-wrap gap-2 pr-16">
          <span className="text-[10px] tracking-[0.24em] uppercase bg-urbanex-navy/85 text-urbanex-ivory px-3 py-1 rounded-full backdrop-blur">
            {t(`type.${property.property_type}`)}
          </span>
          {property.status !== "available" && (
            <span className="text-[10px] tracking-[0.24em] uppercase bg-urbanex-gold text-urbanex-navy px-3 py-1 rounded-full">
              {t(`status.${property.status}`)}
            </span>
          )}
          {property.verified && (
            <span className="text-[10px] tracking-[0.2em] uppercase bg-emerald-600/90 text-white px-3 py-1 rounded-full inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3"/> {t("card.verified")}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => toggle(property.id)}
          aria-pressed={saved}
          aria-label={t("card.shortlist")}
          data-testid={`prop-heart-${property.id}`}
          className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center hover:scale-105 transition-transform"
        >
          <Heart className={`w-5 h-5 ${saved ? "fill-red-500 text-red-500" : "text-urbanex-navy"}`}/>
        </button>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-2 text-xs text-urbanex-navy/60">
          <MapPin className="w-3.5 h-3.5 text-urbanex-gold"/> {property.zone}
          {property.rera_number && <span className="ml-auto font-mono text-[10px] text-urbanex-navy/50">{t("card.rera")} {property.rera_number}</span>}
        </div>
        <h3 className="mt-2 font-display text-2xl text-urbanex-navy leading-snug line-clamp-2">{property.title}</h3>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-urbanex-navy/70">
          {property.bedrooms != null && <span className="flex items-center gap-1"><BedDouble className="w-4 h-4 text-urbanex-gold"/> {property.bedrooms} BHK</span>}
          {property.bathrooms != null && <span className="flex items-center gap-1"><Bath className="w-4 h-4 text-urbanex-gold"/> {property.bathrooms} Bath</span>}
          <span className="flex items-center gap-1"><Ruler className="w-4 h-4 text-urbanex-gold"/> {property.area_sqft} sqft</span>
        </div>

        <div className="mt-6 flex items-end justify-between gap-3">
          <PriceBlock type="property" item={property} testId={PROP.price(property.id)}/>
          <Link
            to={href}
            className="text-sm text-urbanex-navy/70 hover:text-urbanex-gold flex items-center gap-1 group/link shrink-0"
          >
            {t("card.details")} <ArrowRight className="w-4 h-4 transition-transform group-hover/link:translate-x-1"/>
          </Link>
        </div>

        <label className={`mt-4 pt-4 border-t border-urbanex-navy/10 flex items-center gap-2 text-xs cursor-pointer select-none ${!comparing && compare.length >= MAX_COMPARE ? "opacity-40 cursor-not-allowed" : "text-urbanex-navy/70"}`}>
          <input
            type="checkbox"
            checked={comparing}
            disabled={!comparing && compare.length >= MAX_COMPARE}
            onChange={() => toggleCompare(property.id)}
            data-testid={`prop-compare-${property.id}`}
            className="accent-[#C5A059]"
          />
          <GitCompareArrows className="w-3.5 h-3.5 text-urbanex-gold"/> {t("card.compare")}
        </label>
      </div>
    </motion.div>
    </Tilt>
  );
}
