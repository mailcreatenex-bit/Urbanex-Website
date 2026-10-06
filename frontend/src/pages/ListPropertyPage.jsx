import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BadgeCheck, CalendarClock, Clapperboard, IndianRupee, ShieldCheck } from "lucide-react";
import ListingForm from "@/components/owner/ListingForm";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useSeo } from "@/lib/seo";

const STEPS = [
  [CalendarClock, "List it free", "Fill the form and your property is online straight away, free for the first days."],
  [IndianRupee, "Pay by UPI", "To keep it online, pay the small listing fee by UPI and send us the reference number."],
  [BadgeCheck, "We confirm", "We check the payment and confirm. Your listing stays live for the days you paid for."],
  [Clapperboard, "Get buyers", "Buyers press Interested and we pass you the serious ones. Add a YouTube video to stand out."],
];

export default function ListPropertyPage() {
  const { user, loading, setLoginOpen } = useAuth();
  const nav = useNavigate();
  const [plans, setPlans] = useState(null);
  useSeo({ title: "List your property", description: "List your plot, flat or house in Burdwan with Urbanex Realty. Free for the first days, then a small fee." });
  useEffect(() => { api.get("/listing-plans").then(r => setPlans(r.data)).catch(() => setPlans({ accepting: false, plans: [], trial_days: 3 })); }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-4">For owners and agents</div>
      <h1 className="font-display text-4xl md:text-6xl text-urbanex-navy leading-[1.05] tracking-tight max-w-3xl text-balance">List your property where Burdwan is looking.</h1>
      <p className="mt-6 text-urbanex-navy/70 max-w-2xl leading-relaxed">Your listing goes live at once and stays free for {plans?.trial_days ?? 3} days. Add a YouTube video and your photos, and buyers who press Interested reach us.</p>

      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STEPS.map(([Icon, title, body], i) => (
          <div key={title} className="rounded-2xl bg-white border border-urbanex-navy/5 p-5">
            <div className="flex items-center gap-2 text-xs text-urbanex-gold"><Icon className="w-4 h-4"/> Step {i + 1}</div>
            <div className="mt-2 font-display text-xl text-urbanex-navy">{title}</div>
            <p className="mt-1 text-sm text-urbanex-navy/65 leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      {plans?.plans?.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-3" data-testid="listing-prices">
          {plans.plans.map(p => (
            <div key={p.id} className="rounded-2xl border border-urbanex-gold/40 bg-urbanex-cream px-6 py-4">
              <div className="font-display text-3xl text-urbanex-navy">₹{p.amount.toLocaleString("en-IN")}</div>
              <div className="text-xs text-urbanex-navy/60">to stay online for {p.label}</div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-urbanex-navy/50 flex items-start gap-2 max-w-2xl"><ShieldCheck className="w-4 h-4 shrink-0 text-urbanex-gold"/> Owner listings are marked “Listed by owner” and are not verified by Urbanex. If the fee is not paid within {plans?.trial_days ?? 3} days the listing is taken offline.</p>

      <div className="mt-12 rounded-3xl bg-white border border-urbanex-navy/5 p-6 md:p-10">
        {loading || !plans ? <div className="text-urbanex-navy/50">Loading…</div>
          : !plans.accepting ? <div className="text-urbanex-navy/70">We are not taking new owner listings right now. Please check back soon, or <Link to="/contact" className="underline">contact us</Link>.</div>
          : !user ? (
            <div className="text-center py-8">
              <div className="font-display text-2xl text-urbanex-navy">Sign in to list your property</div>
              <p className="mt-2 text-sm text-urbanex-navy/60">It takes one tap with Google.</p>
              <button onClick={() => setLoginOpen(true)} className="mt-5 bg-urbanex-navy text-urbanex-ivory rounded-full px-7 py-3 text-sm">Sign in</button>
            </div>
          ) : (
            <>
              <h2 className="font-display text-3xl text-urbanex-navy mb-6">Tell us about your property</h2>
              <ListingForm onSaved={() => nav("/my-listings")}/>
            </>
          )}
      </div>
      {user && <p className="mt-6 text-sm"><Link to="/my-listings" className="underline text-urbanex-navy/70">See my listings</Link></p>}
    </div>
  );
}
