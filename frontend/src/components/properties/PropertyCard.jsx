import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Lock, MapPin, BedDouble, Bath, Ruler, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PROP } from "@/constants/testIds";

const inr = (n) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(2)} Cr` : `₹${(n / 100000).toFixed(2)} L`;

export default function PropertyCard({ property, idx = 0 }) {
  const { user, setLoginOpen } = useAuth();
  const isLoggedIn = !!user;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay: (idx % 3) * 0.06 }}
      data-testid={PROP.card(property.id)}
      className="group bg-white rounded-2xl overflow-hidden border border-urbanex-navy/5 hover:border-urbanex-gold/40 shadow-[0_4px_20px_-4px_rgba(10,18,37,0.05)] hover:shadow-[0_20px_50px_-20px_rgba(10,18,37,0.18)] transition-all duration-500"
    >
      <div className="relative aspect-[5/4] overflow-hidden">
        <img
          src={property.image}
          alt={property.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute top-4 left-4 flex gap-2">
          <span className="text-[10px] tracking-[0.24em] uppercase bg-urbanex-navy/85 text-urbanex-ivory px-3 py-1 rounded-full backdrop-blur">
            {property.property_type}
          </span>
          {property.status !== "available" && (
            <span className="text-[10px] tracking-[0.24em] uppercase bg-urbanex-gold text-urbanex-navy px-3 py-1 rounded-full">
              {property.status}
            </span>
          )}
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-2 text-xs text-urbanex-navy/60">
          <MapPin className="w-3.5 h-3.5 text-urbanex-gold"/> {property.zone}
        </div>
        <h3 className="mt-2 font-display text-2xl text-urbanex-navy leading-snug line-clamp-2">{property.title}</h3>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-urbanex-navy/70">
          {property.bedrooms != null && <span className="flex items-center gap-1"><BedDouble className="w-4 h-4 text-urbanex-gold"/> {property.bedrooms} BHK</span>}
          {property.bathrooms != null && <span className="flex items-center gap-1"><Bath className="w-4 h-4 text-urbanex-gold"/> {property.bathrooms} Bath</span>}
          <span className="flex items-center gap-1"><Ruler className="w-4 h-4 text-urbanex-gold"/> {property.area_sqft} sqft</span>
        </div>

        <div className="mt-6 flex items-end justify-between">
          {isLoggedIn ? (
            <div>
              <div className="text-[10px] tracking-[0.28em] uppercase text-urbanex-gold">Ask price</div>
              <div data-testid={PROP.price(property.id)} className="font-display text-3xl text-urbanex-navy">{inr(property.price_inr)}</div>
            </div>
          ) : (
            <button
              data-testid={PROP.gate(property.id)}
              onClick={() => setLoginOpen(true)}
              className="relative overflow-hidden text-left"
            >
              <div className="text-[10px] tracking-[0.28em] uppercase text-urbanex-gold">Ask price</div>
              <div className="relative">
                <span className="font-display text-3xl text-urbanex-navy blur-[6px] select-none">{inr(property.price_inr)}</span>
                <span className="absolute inset-0 flex items-center gap-1.5 text-sm text-urbanex-navy/80 hover:text-urbanex-navy" data-testid={PROP.seePriceBtn(property.id)}>
                  <Lock className="w-3.5 h-3.5 text-urbanex-gold"/> Sign in to see price
                </span>
              </div>
            </button>
          )}
          <Link
            to={`/properties/${property.id}`}
            className="text-sm text-urbanex-navy/70 hover:text-urbanex-gold flex items-center gap-1 group/link"
          >
            Details <ArrowRight className="w-4 h-4 transition-transform group-hover/link:translate-x-1"/>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
