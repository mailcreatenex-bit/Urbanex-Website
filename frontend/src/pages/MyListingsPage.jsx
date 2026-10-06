import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Copy, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import ListingForm from "@/components/owner/ListingForm";
import { api } from "@/lib/api";
import { assetUrl } from "@/lib/config";
import { useAuth } from "@/context/AuthContext";
import { useSeo } from "@/lib/seo";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const STATE = {
  trial: { label: "Free days", cls: "bg-sky-100 text-sky-700" },
  payment_submitted: { label: "Checking payment", cls: "bg-amber-100 text-amber-700" },
  paid: { label: "Live (paid)", cls: "bg-emerald-100 text-emerald-700" },
  expired: { label: "Offline", cls: "bg-gray-200 text-gray-600" },
};
const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

function PayPanel({ listing, info, onDone }) {
  const [plan, setPlan] = useState(info.plans[0]?.id);
  const [utr, setUtr] = useState("");
  const [payer, setPayer] = useState("");
  const [busy, setBusy] = useState(false);
  const chosen = info.plans.find(p => p.id === plan);
  const upi = `upi://pay?pa=${encodeURIComponent(info.upi_id)}&pn=${encodeURIComponent(info.upi_name || "Urbanex Realty")}&am=${chosen?.amount}&cu=INR&tn=${encodeURIComponent(`Listing ${listing.id.slice(-6)}`)}`;
  const copy = () => navigator.clipboard?.writeText(info.upi_id).then(() => toast.success("UPI ID copied")).catch(() => {});

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { const { data } = await api.post(`/owner/listings/${listing.id}/payment`, { plan_id: plan, utr: utr.trim(), payer_upi: payer.trim() || null }); toast.success("Thank you! We will confirm it shortly."); onDone(data); }
    catch (err) { const d = err?.response?.data?.detail; toast.error(Array.isArray(d) ? "Enter the 12-digit UPI reference number" : d || "Could not send"); }
    finally { setBusy(false); }
  };

  return (
    <div className="mt-4 rounded-2xl bg-urbanex-cream p-5 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6" data-testid="pay-panel">
      <div className="text-center">
        {info.qr_image ? <img src={assetUrl(info.qr_image, 400)} alt="UPI QR code" className="w-44 h-44 object-contain rounded-xl bg-white p-2 mx-auto"/> : <div className="w-44 h-44 rounded-xl bg-white flex items-center justify-center text-xs text-gray-400">QR coming soon</div>}
        <div className="mt-2 text-xs text-urbanex-navy/60">Scan with any UPI app</div>
      </div>
      <div>
        <div className="text-xs tracking-[0.2em] uppercase text-urbanex-gold mb-2">1. Pay</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {info.plans.map(p => (
            <button key={p.id} type="button" onClick={() => setPlan(p.id)} aria-pressed={plan === p.id}
              className={`rounded-xl border px-4 py-2 text-left ${plan === p.id ? "border-urbanex-navy bg-white" : "border-urbanex-navy/15 hover:border-urbanex-gold"}`}>
              <div className="font-display text-xl">₹{p.amount.toLocaleString("en-IN")}</div><div className="text-xs text-urbanex-navy/60">{p.label}</div>
            </button>
          ))}
        </div>
        <div className="text-sm flex flex-wrap items-center gap-2">
          <span className="text-urbanex-navy/60">UPI ID</span> <b data-testid="upi-id">{info.upi_id}</b>
          <button type="button" onClick={copy} className="inline-flex items-center gap-1 text-xs border rounded-full px-2.5 py-1 hover:border-urbanex-gold"><Copy className="w-3 h-3"/> Copy</button>
          <a href={upi} className="inline-flex items-center gap-1 text-xs bg-urbanex-navy text-urbanex-ivory rounded-full px-3 py-1.5 md:hidden"><ExternalLink className="w-3 h-3"/> Pay ₹{chosen?.amount} in my UPI app</a>
        </div>
        <div className="mt-1 text-xs text-urbanex-navy/55">Paying to {info.upi_name}. Put “{listing.title.slice(0, 24)}” in the note if you can.</div>
        <form onSubmit={submit} className="mt-4">
          <div className="text-xs tracking-[0.2em] uppercase text-urbanex-gold mb-2">2. Send us the reference</div>
          <div className="flex flex-wrap gap-2">
            <input required value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="UPI reference / UTR (12 digits)" inputMode="numeric" maxLength={30} className="flex-1 min-w-[220px] border border-urbanex-navy/15 rounded-lg px-3 py-2.5 text-sm bg-white" data-testid="utr"/>
            <input value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="Your UPI ID (optional)" maxLength={100} className="flex-1 min-w-[180px] border border-urbanex-navy/15 rounded-lg px-3 py-2.5 text-sm bg-white"/>
          </div>
          <button disabled={busy || !utr.trim()} className="mt-3 bg-urbanex-navy text-urbanex-ivory rounded-full px-6 py-2.5 text-sm disabled:opacity-50" data-testid="pay-submit">{busy ? "Sending…" : "I have paid"}</button>
          <p className="mt-2 text-[11px] text-urbanex-navy/50">You find the reference in your UPI app under the payment details. We check it against our account, then confirm.</p>
        </form>
      </div>
    </div>
  );
}

export default function MyListingsPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState(null);
  const [info, setInfo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [paying, setPaying] = useState(null);
  useSeo({ title: "My listings" });
  const load = useCallback(() => api.get("/owner/listings").then(r => setItems(r.data)).catch(() => setItems([])), []);
  useEffect(() => { if (user) { load(); api.get("/owner/payment-info").then(r => setInfo(r.data)).catch(() => {}); } }, [user, load]);

  if (loading) return <div className="max-w-5xl mx-auto px-6 py-24 text-urbanex-navy/50">Loading…</div>;
  if (!user) return <Navigate to="/list-your-property" replace/>;

  const remove = async (l) => {
    if (!window.confirm(`Delete “${l.title}”? Buyers will no longer see it.`)) return;
    await api.delete(`/owner/listings/${l.id}`).catch(() => toast.error("Could not delete"));
    load();
  };
  const replace = (upd) => { setItems(cur => cur.map(x => (x.id === upd.id ? { ...x, ...upd } : x))); setPaying(null); };

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-12 py-16 md:py-24">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-3">For owners</div>
          <h1 className="font-display text-4xl md:text-5xl text-urbanex-navy tracking-tight">My listings</h1>
        </div>
        <Link to="/list-your-property" className="inline-flex items-center gap-2 bg-urbanex-navy text-urbanex-ivory rounded-full px-6 py-3 text-sm"><Plus className="w-4 h-4"/> List another property</Link>
      </div>

      <div className="mt-8 space-y-5" data-testid="my-listings">
        {(items || []).map(l => {
          const st = STATE[l.listing_state] || STATE.expired;
          const urgent = l.listing_state === "trial" && l.days_left <= 1;
          return (
            <div key={l.id} className="rounded-2xl bg-white border border-urbanex-navy/5 p-5" data-testid={`my-listing-${l.id}`}>
              <div className="flex gap-4 flex-wrap">
                {l.image ? <img src={assetUrl(l.image, 300)} alt="" className="w-32 h-24 rounded-xl object-cover"/> : <div className="w-32 h-24 rounded-xl bg-urbanex-cream"/>}
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 flex-wrap"><h2 className="font-display text-2xl text-urbanex-navy">{l.title}</h2><span className={`text-xs rounded-full px-3 py-1 ${st.cls}`}>{st.label}</span></div>
                  <div className="text-sm text-urbanex-navy/60 mt-1">{l.zone} · {l.area_sqft} sqft{l.listing_type === "rent" ? " · for rent" : ""}</div>
                  <div className={`mt-2 text-sm ${urgent ? "text-red-600 font-medium" : "text-urbanex-navy/75"}`}>
                    {l.listing_state === "trial" && `Free until ${day(l.trial_ends_at)} (${l.days_left} day${l.days_left === 1 ? "" : "s"} left). Pay to keep it online.`}
                    {l.listing_state === "payment_submitted" && "We are checking your payment. Your listing stays online meanwhile."}
                    {l.listing_state === "paid" && `Live until ${day(l.paid_until)} (${l.days_left} days left).`}
                    {l.listing_state === "expired" && "Taken offline. Pay to bring it back."}
                  </div>
                  {l.payment?.status === "rejected" && <div className="mt-1 text-sm text-red-600">Last payment not confirmed: {l.payment.reason}</div>}
                  <div className="mt-1 text-xs text-urbanex-navy/50">{l.interested_count} {l.interested_count === 1 ? "person has" : "people have"} pressed Interested</div>
                </div>
                <div className="flex flex-col gap-2 items-stretch text-sm">
                  {l.can_pay && info?.upi_id && <button onClick={() => setPaying(paying === l.id ? null : l.id)} data-testid={`pay-${l.id}`} className="bg-urbanex-gold text-urbanex-navy rounded-full px-5 py-2 font-medium">{l.listing_state === "paid" ? "Renew" : "Pay & keep online"}</button>}
                  {l.listing_state !== "expired" && <Link to={`/properties/${l.slug}`} className="text-center rounded-full border px-5 py-2 hover:border-urbanex-gold">View</Link>}
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => setEditing(l)} aria-label="Edit" className="p-2 hover:text-urbanex-gold"><Pencil className="w-4 h-4"/></button>
                    <button onClick={() => remove(l)} aria-label="Delete" className="p-2 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>
              {paying === l.id && info && <PayPanel listing={l} info={info} onDone={replace}/>}
            </div>
          );
        })}
        {items && !items.length && <div className="rounded-2xl bg-white border p-14 text-center text-urbanex-navy/50">You have not listed anything yet. <Link to="/list-your-property" className="underline">List your first property</Link>, it is free for the first days.</div>}
      </div>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader><SheetTitle>Edit listing</SheetTitle></SheetHeader>
          {editing && <div className="mt-5 pb-10"><ListingForm existing={editing} onCancel={() => setEditing(null)} onSaved={(d) => { setEditing(null); replace(d); load(); }}/></div>}
        </SheetContent>
      </Sheet>
    </div>
  );
}
