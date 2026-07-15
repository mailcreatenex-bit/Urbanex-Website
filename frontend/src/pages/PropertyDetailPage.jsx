import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { ArrowLeft, MapPin, Lock, MessageCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const inr = (n) => n >= 10000000 ? `₹${(n / 10000000).toFixed(2)} Cr` : `₹${(n / 100000).toFixed(2)} L`;

export default function PropertyDetailPage() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const { user, setLoginOpen } = useAuth();

  useEffect(() => {
    api.get(`/properties/${id}`).then(r => setP(r.data)).catch(() => {});
  }, [id]);

  if (!p) return <div className="max-w-7xl mx-auto px-6 py-24 text-urbanex-navy/50">Loading…</div>;

  const waMsg = encodeURIComponent(`Hi Ayan, I'd like details on "${p.title}" (${p.zone}).`);

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-16">
      <Link to="/properties" className="inline-flex items-center gap-2 text-sm text-urbanex-navy/60 hover:text-urbanex-navy mb-8"><ArrowLeft className="w-4 h-4"/> Back to inventory</Link>

      <div className="grid md:grid-cols-12 gap-10">
        <div className="md:col-span-8">
          <div className="rounded-3xl overflow-hidden aspect-[16/10] bg-urbanex-navy/5">
            <img src={p.image} alt={p.title} className="w-full h-full object-cover"/>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {(p.gallery || []).map((g, i) => (
              <img key={i} src={g} alt="" className="rounded-xl aspect-video object-cover"/>
            ))}
          </div>

          <div className="mt-10">
            <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold flex items-center gap-2"><MapPin className="w-3 h-3"/> {p.zone}</div>
            <h1 className="font-display text-4xl md:text-5xl text-urbanex-navy tracking-tight mt-2 leading-tight text-balance">{p.title}</h1>
            <p className="mt-5 text-urbanex-navy/75 leading-relaxed max-w-2xl">{p.description}</p>

            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              {(p.highlights || []).map(h => (
                <div key={h} className="flex items-start gap-2 text-urbanex-navy/75 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-urbanex-gold mt-2"/>{h}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="md:col-span-4">
          <div className="sticky top-28 bg-white rounded-2xl p-7 border border-urbanex-navy/10 shadow-[0_20px_60px_-30px_rgba(10,18,37,0.18)]">
            <div className="text-xs tracking-[0.28em] uppercase text-urbanex-gold">Ask price</div>
            {user ? (
              <div className="mt-1 font-display text-4xl text-urbanex-navy">{inr(p.price_inr)}</div>
            ) : (
              <button onClick={() => setLoginOpen(true)} className="mt-1 text-left relative">
                <span className="font-display text-4xl text-urbanex-navy blur-[8px] select-none">{inr(p.price_inr)}</span>
                <span className="absolute inset-0 flex items-center gap-1.5 text-sm text-urbanex-navy/80"><Lock className="w-3.5 h-3.5 text-urbanex-gold"/> Sign in to see price</span>
              </button>
            )}

            <div className="mt-6 space-y-2 text-sm text-urbanex-navy/75">
              <div className="flex justify-between"><span>Type</span><span className="capitalize">{p.property_type}</span></div>
              {p.bedrooms != null && <div className="flex justify-between"><span>Bedrooms</span><span>{p.bedrooms}</span></div>}
              {p.bathrooms != null && <div className="flex justify-between"><span>Bathrooms</span><span>{p.bathrooms}</span></div>}
              <div className="flex justify-between"><span>Area</span><span>{p.area_sqft} sqft</span></div>
              <div className="flex justify-between"><span>Status</span><span className="capitalize">{p.status}</span></div>
            </div>

            <a href={`https://wa.me/919933333333?text=${waMsg}`} target="_blank" rel="noreferrer"
              className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-urbanex-navy hover:bg-urbanex-navyLight text-urbanex-ivory py-3 rounded-full text-sm">
              <MessageCircle className="w-4 h-4"/> WhatsApp Ayan
            </a>
            <Button variant="outline" onClick={() => setLoginOpen(true)} className="mt-3 w-full border-urbanex-gold text-urbanex-navy hover:bg-urbanex-gold/10 rounded-full">
              Book a site visit
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
