import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PropertyCard from "@/components/properties/PropertyCard";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useI18n } from "@/context/I18nContext";
import { useSeo } from "@/lib/seo";

export default function ShortlistPage() {
  const { ids } = useFavorites();
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  useSeo({ title: "Your shortlist", description: "Properties you saved on Urbanex Realty." });

  useEffect(() => {
    if (loading) return;
    api.get("/properties").then(r => setItems((r.data || []).filter(p => ids.includes(p.id)))).catch(() => {});
  }, [ids, user?.user_id, loading]);

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <h1 className="font-display text-5xl text-urbanex-navy tracking-tight">{t("shortlist.title")}</h1>
      {items.length === 0 ? (
        <p className="mt-8 text-urbanex-navy/60">{t("shortlist.empty")} <Link to="/properties" className="underline">{t("nav.properties")}</Link></p>
      ) : (
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {items.map((p, i) => <PropertyCard key={p.id} property={p} idx={i}/>)}
        </div>
      )}
    </div>
  );
}
