import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { ArrowLeft, MapPin, MessageCircle, Heart, ShieldCheck, CheckCircle2, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { assetUrl, waLink } from "@/lib/config";
import PriceBlock from "@/components/common/PriceBlock";
import { useSeo } from "@/lib/seo";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useI18n } from "@/context/I18nContext";
import PropertyMap from "@/components/properties/PropertyMap";
import Calculators from "@/components/properties/Calculators";
import VisitBooking from "@/components/properties/VisitBooking";
import ReviewsSection from "@/components/properties/ReviewsSection";
import ShareBar from "@/components/properties/ShareBar";

export default function PropertyDetailPage() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [missing, setMissing] = useState(false);
  const { user, loading } = useAuth();
  const { has, toggle } = useFavorites();
  const { t } = useI18n();
  const uid = user?.user_id;
  const { hash } = useLocation();

  useEffect(() => {
    if (loading) return;
    api.get(`/properties/${id}`).then(r => { setP(r.data); setMissing(false); }).catch(() => setMissing(true));
  }, [id, uid, loading]);

  useEffect(() => {
    if (p && hash === "#book-visit") document.getElementById("book-visit")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [p, hash]);

  // Structured data deliberately omits price: it is gated behind sign-in.
  useSeo(p ? {
    title: p.title,
    description: `${p.zone}, Burdwan · ${p.area_sqft} sqft${p.bedrooms ? ` · ${p.bedrooms} BHK` : ""}. ${p.description}`.slice(0, 200),
    image: assetUrl(p.image),
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "RealEstateListing",
      name: p.title,
      description: p.description,
      image: [p.image, ...(p.gallery || [])].map(assetUrl),
      url: window.location.href,
      address: { "@type": "PostalAddress", addressLocality: p.zone, addressRegion: "West Bengal", addressCountry: "IN" },
      ...(p.latitude != null ? { geo: { "@type": "GeoCoordinates", latitude: p.latitude, longitude: p.longitude } } : {}),
    },
  } : { title: "Property" });

  if (missing) return <div className="max-w-7xl mx-auto px-6 py-24 text-urbanex-navy/60">Property not found. <Link to="/properties" className="underline">{t("detail.back")}</Link></div>;
  if (!p) return <div className="max-w-7xl mx-auto px-6 py-24 text-urbanex-navy/50">{t("common.loading")}</div>;

  const waHref = waLink(`Hi Ayan, I'd like details on "${p.title}" (${p.zone}).`);
  const saved = has(p.id);
  const facts = [
    [t("detail.type"), t(`type.${p.property_type}`)],
    p.bedrooms != null && [t("detail.bedrooms"), p.bedrooms],
    p.bathrooms != null && [t("detail.bathrooms"), p.bathrooms],
    [t("detail.area"), `${p.area_sqft} sqft`],
    [t("detail.status"), t(`status.${p.status}`)],
    p.possession && [t("detail.possession"), t(`possession.${p.possession}`)],
    p.furnishing && [t("detail.furnishing"), t(`furnishing.${p.furnishing}`)],
    p.rera_number && [t("detail.reraNo"), p.rera_number],
  ].filter(Boolean);

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-16">
      <Link to="/properties" className="inline-flex items-center gap-2 text-sm text-urbanex-navy/60 hover:text-urbanex-navy mb-8"><ArrowLeft className="w-4 h-4"/> {t("detail.back")}</Link>

      <div className="grid md:grid-cols-12 gap-10">
        <div className="md:col-span-8">
          <div className="rounded-3xl overflow-hidden aspect-[16/10] bg-urbanex-navy/5">
            <img src={assetUrl(p.image)} alt={p.title} className="w-full h-full object-cover" width="1280" height="800"/>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {(p.gallery || []).map((g, i) => (
              <img key={i} src={assetUrl(g)} alt="" loading="lazy" decoding="async" className="rounded-xl aspect-video object-cover"/>
            ))}
          </div>

          <div className="mt-10">
            <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold flex items-center gap-2"><MapPin className="w-3 h-3"/> {p.zone}</div>
            <h1 className="font-display text-4xl md:text-5xl text-urbanex-navy tracking-tight mt-2 leading-tight text-balance">{p.title}</h1>
            {p.verified && (
              <div className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-full px-4 py-1.5" data-testid="verified-badge">
                <ShieldCheck className="w-4 h-4"/> {t("detail.verifiedBadge")}
              </div>
            )}
            <p className="mt-5 text-urbanex-navy/75 leading-relaxed max-w-2xl">{p.description}</p>

            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              {(p.highlights || []).map(h => (
                <div key={h} className="flex items-start gap-2 text-urbanex-navy/75 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-urbanex-gold mt-2"/>{h}
                </div>
              ))}
            </div>

            {p.amenities?.length > 0 && (
              <div className="mt-10">
                <h2 className="font-display text-2xl text-urbanex-navy mb-3">{t("detail.amenities")}</h2>
                <div className="flex flex-wrap gap-2">
                  {p.amenities.map(a => <span key={a} className="text-xs bg-urbanex-cream rounded-full px-3 py-1.5 text-urbanex-navy/80">{a}</span>)}
                </div>
              </div>
            )}

            {p.documents?.length > 0 && (
              <div className="mt-10" data-testid="doc-checklist">
                <h2 className="font-display text-2xl text-urbanex-navy mb-3">{t("detail.documents")}</h2>
                <ul className="space-y-2">
                  {p.documents.map((d, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-urbanex-navy/80">
                      {d.verified ? <CheckCircle2 className="w-4 h-4 text-emerald-600"/> : <Clock className="w-4 h-4 text-urbanex-navy/40"/>}
                      {d.name} <span className="text-xs text-urbanex-navy/40">· {d.verified ? t("detail.docVerified") : t("detail.docPending")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {p.floor_plan && (
              <div className="mt-10">
                <h2 className="font-display text-2xl text-urbanex-navy mb-3">{t("detail.floorPlan")}</h2>
                <a href={assetUrl(p.floor_plan)} target="_blank" rel="noreferrer">
                  <img src={assetUrl(p.floor_plan)} alt={t("detail.floorPlan")} loading="lazy" className="rounded-xl border border-urbanex-navy/10 max-h-96 object-contain bg-white"/>
                </a>
              </div>
            )}

            {p.latitude != null && (
              <div className="mt-10">
                <h2 className="font-display text-2xl text-urbanex-navy mb-3">{t("detail.location")}</h2>
                <PropertyMap items={[p]} single height={320}/>
                {p.nearby?.length > 0 && (
                  <div className="mt-4" data-testid="nearby">
                    <h3 className="text-sm font-medium text-urbanex-navy">{t("detail.nearby")}</h3>
                    <ul className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-urbanex-navy/75">
                      {p.nearby.map(n => <li key={n.name} className="flex justify-between"><span>{n.name}</span><span className="font-mono text-xs">{n.distance_km} km</span></li>)}
                    </ul>
                    <p className="mt-2 text-xs text-urbanex-navy/40">{t("detail.nearbyNote")}</p>
                  </div>
                )}
              </div>
            )}

            <Calculators property={p}/>
            <ReviewsSection propertyId={p.id}/>
          </div>
        </div>

        <aside className="md:col-span-4">
          <div className="sticky top-28 bg-white rounded-2xl p-7 border border-urbanex-navy/10 shadow-[0_20px_60px_-30px_rgba(10,18,37,0.18)] max-h-[calc(100vh-8rem)] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <PriceBlock type="property" item={p} size="detail"/>
              <button type="button" onClick={() => toggle(p.id)} aria-pressed={saved} aria-label={t("card.shortlist")} data-testid="detail-heart">
                <Heart className={`w-5 h-5 ${saved ? "fill-red-500 text-red-500" : "text-urbanex-navy"}`}/>
              </button>
            </div>
            {p.watch_count >= 2 && <div className="mt-2 text-xs text-urbanex-navy/50" data-testid="watch-count">{t("watch.count", { n: p.watch_count })}</div>}

            <div className="mt-6 space-y-2 text-sm text-urbanex-navy/75">
              {facts.map(([k, v]) => <div key={k} className="flex justify-between"><span>{k}</span><span>{v}</span></div>)}
            </div>

            <a href={waHref} target="_blank" rel="noreferrer"
              className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-urbanex-navy hover:bg-urbanex-navyLight text-urbanex-ivory py-3 rounded-full text-sm">
              <MessageCircle className="w-4 h-4"/> {t("detail.whatsapp")}
            </a>

            {p.status !== "sold" && <div id="book-visit"><VisitBooking propertyId={p.id}/></div>}
            <ShareBar property={p}/>
          </div>
        </aside>
      </div>
    </div>
  );
}
