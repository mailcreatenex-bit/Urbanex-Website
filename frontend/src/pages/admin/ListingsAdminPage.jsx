import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, MessageCircle, Phone, X } from "lucide-react";
import { api } from "@/lib/api";
import { assetUrl } from "@/lib/config";
import ImageUpload from "@/components/admin/ImageUpload";
import { telLink, waLink, inrShort, when } from "@/lib/crm";

const inp = "w-full border rounded-lg px-3 py-2 text-sm bg-white";
const Label = ({ children }) => <div className="text-[10px] tracking-[0.2em] uppercase text-urbanex-gold mb-1">{children}</div>;
const STATE_CLS = { trial: "bg-sky-100 text-sky-700", payment_submitted: "bg-amber-100 text-amber-700", paid: "bg-emerald-100 text-emerald-700", expired: "bg-gray-200 text-gray-600", removed: "bg-red-100 text-red-700" };
const FILTERS = [["", "All"], ["payment_submitted", "To confirm"], ["trial", "Free days"], ["paid", "Paid"], ["expired", "Expired"], ["removed", "Removed"]];

function Settings({ onSaved }) {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/admin/listing-settings").then(r => setS(r.data)); }, []);
  if (!s) return null;
  const set = (k) => (e) => setS(x => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const plan = (i, k, v) => setS(x => ({ ...x, plans: x.plans.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }));
  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { accepting: s.accepting, upi_id: s.upi_id, upi_name: s.upi_name, qr_image: s.qr_image || null, trial_days: Number(s.trial_days), grace_days: Number(s.grace_days),
        plans: s.plans.map(p => ({ ...p, days: Number(p.days), amount: Number(p.amount) })) };
      const { data } = await api.put("/admin/listing-settings", body);
      setS(data); toast.success("Saved"); onSaved?.();
    } catch (err) { const d = err?.response?.data?.detail; toast.error(Array.isArray(d) ? d.map(x => x.msg).join("; ") : d || "Could not save"); }
  };
  return (
    <details className="rounded-2xl border bg-white p-5" open={!s.upi_id} data-testid="listing-settings">
      <summary className="cursor-pointer font-medium">Payment details and prices {!s.upi_id && <span className="ml-2 text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">Add your UPI ID to start accepting listings</span>}</summary>
      <form onSubmit={save} className="mt-4 grid md:grid-cols-2 gap-4">
        <div><Label>Your UPI ID</Label><input className={inp} value={s.upi_id} onChange={set("upi_id")} placeholder="yourname@oksbi" data-testid="upi-id-input"/></div>
        <div><Label>Name on the UPI account</Label><input className={inp} value={s.upi_name} onChange={set("upi_name")}/></div>
        <div className="md:row-span-2"><ImageUpload label="Your UPI QR code image" value={s.qr_image || ""} onChange={(v) => setS(x => ({ ...x, qr_image: v }))}/></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Free days</Label><input type="number" min="1" max="30" className={inp} value={s.trial_days} onChange={set("trial_days")}/></div>
          <div><Label>Days to wait for you to confirm</Label><input type="number" min="0" max="14" className={inp} value={s.grace_days} onChange={set("grace_days")}/></div>
        </div>
        <div className="md:col-span-2">
          <Label>Plans</Label>
          <div className="space-y-2">
            {s.plans.map((p, i) => (
              <div key={p.id} className="grid grid-cols-[1fr_90px_110px] gap-2"><input className={inp} value={p.label} onChange={(e) => plan(i, "label", e.target.value)}/><input type="number" className={inp} value={p.days} onChange={(e) => plan(i, "days", e.target.value)} title="Days"/><input type="number" className={inp} value={p.amount} onChange={(e) => plan(i, "amount", e.target.value)} title="Amount ₹"/></div>
            ))}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Columns: name, days online, price in ₹.</div>
        </div>
        <label className="md:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={s.accepting} onChange={set("accepting")}/> Accept new owner listings</label>
        <div className="md:col-span-2"><button className="bg-urbanex-navy text-urbanex-ivory rounded-full px-6 py-2.5 text-sm">Save</button></div>
      </form>
    </details>
  );
}

export default function ListingsAdminPage() {
  const [data, setData] = useState({ items: [], counts: {}, revenue_total: 0, revenue_month: 0 });
  const [filter, setFilter] = useState("");
  const load = useCallback(() => api.get("/admin/listings", { params: filter ? { state: filter } : {} }).then(r => setData(r.data)).catch(() => toast.error("Could not load")), [filter]);
  useEffect(() => { load(); }, [load]);

  const confirm = async (l, pay) => {
    if (!window.confirm(`Confirm ₹${pay.amount} from ${pay.owner_name}? Check your UPI app that UTR ${pay.utr} is there.`)) return;
    try { await api.post(`/admin/listings/${l.id}/confirm`, { payment_id: pay.id }); toast.success("Confirmed, the listing is live"); load(); }
    catch (err) { toast.error(err?.response?.data?.detail || "Could not confirm"); }
  };
  const reject = async (l, pay) => {
    const reason = window.prompt("Why? (the owner will see this)", "I could not find this payment in my account");
    if (!reason) return;
    try { await api.post(`/admin/listings/${l.id}/reject`, { reason, payment_id: pay.id }); toast.success("Rejected"); load(); }
    catch (err) { toast.error(err?.response?.data?.detail || "Could not reject"); }
  };
  const act = async (l, action, days) => {
    if (action === "remove" && !window.confirm(`Take “${l.title}” offline?`)) return;
    try { await api.post(`/admin/listings/${l.id}/action`, { action, days }); toast.success("Done"); load(); } catch { toast.error("Failed"); }
  };

  const waiting = data.items.filter(l => l.listing_state === "payment_submitted" || l.payments.some(p => p.status === "submitted"));

  return (
    <div className="p-6 md:p-10 space-y-6">
      <div>
        <div className="text-xs tracking-[0.28em] uppercase text-urbanex-gold">Owner listings</div>
        <h1 className="font-display text-4xl text-urbanex-navy mt-1">Listings &amp; payments</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        {[["To confirm", data.counts.payment_submitted || 0], ["Free days", data.counts.trial || 0], ["Paid & live", data.counts.paid || 0], ["Collected this month", inrShort(data.revenue_month)], ["Collected in total", inrShort(data.revenue_total)]].map(([k, v]) => (
          <div key={k} className="bg-white border rounded-xl p-4"><div className="text-xs text-gray-500">{k}</div><div className="text-2xl font-display">{v}</div></div>
        ))}
      </div>

      <Settings onSaved={load}/>

      {waiting.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5" data-testid="to-confirm">
          <div className="font-medium text-amber-900 mb-3">Payments waiting for you ({waiting.length})</div>
          <div className="space-y-3">
            {waiting.map(l => l.payments.filter(p => p.status === "submitted").map(p => (
              <div key={p.id} className="bg-white rounded-xl p-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[240px]">
                  <div className="font-medium">{l.title}</div>
                  <div className="text-sm text-gray-600">{p.owner_name} · {p.owner_phone}</div>
                  <div className="text-sm mt-1"><b>₹{p.amount}</b> for {p.days} days · UTR <span className="font-mono">{p.utr}</span>{p.payer_upi ? ` · from ${p.payer_upi}` : ""}</div>
                  <div className="text-xs text-gray-400">Sent {when(p.submitted_at)}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => confirm(l, p)} data-testid={`confirm-${p.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 text-white px-5 py-2 text-sm"><Check className="w-4 h-4"/> Money received</button>
                  <button onClick={() => reject(l, p)} className="inline-flex items-center gap-1.5 rounded-full border border-red-300 text-red-600 px-4 py-2 text-sm"><X className="w-4 h-4"/> Not found</button>
                </div>
              </div>
            )))}
          </div>
        </div>
      )}

      <div className="flex gap-2 text-sm flex-wrap">
        {FILTERS.map(([k, l]) => <button key={k} onClick={() => setFilter(k)} className={`px-4 py-1.5 rounded-full border ${filter === k ? "bg-urbanex-navy text-urbanex-ivory border-urbanex-navy" : "hover:border-urbanex-gold"}`}>{l}</button>)}
      </div>

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 border-b"><tr><th className="p-3">Listing</th><th>Owner</th><th>Status</th><th>Until</th><th>Paid</th><th/></tr></thead>
          <tbody>
            {data.items.map(l => {
              const paid = l.payments.filter(p => p.status === "confirmed").reduce((a, p) => a + p.amount, 0);
              return (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="p-3"><div className="flex items-center gap-3">{l.image ? <img src={assetUrl(l.image, 160)} alt="" className="w-14 h-10 object-cover rounded"/> : <div className="w-14 h-10 bg-gray-100 rounded"/>}<div><div className="font-medium">{l.title}</div><div className="text-xs text-gray-400">{l.zone} · {l.property_type}</div></div></div></td>
                  <td><div>{l.owner?.name}</div><div className="flex gap-2 text-xs mt-0.5"><a href={telLink(l.owner?.phone)} className="inline-flex items-center gap-1 underline"><Phone className="w-3 h-3"/>{l.owner?.phone}</a><a href={waLink(l.owner?.phone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#128C7E]"><MessageCircle className="w-3 h-3"/></a></div></td>
                  <td><span className={`text-xs rounded-full px-2.5 py-1 ${STATE_CLS[l.listing_state] || ""}`}>{(l.listing_state || "").replace("_", " ")}</span></td>
                  <td className="text-xs">{when(l.listing_state === "paid" ? l.paid_until : l.trial_ends_at)}</td>
                  <td>{paid ? `₹${paid}` : "—"}</td>
                  <td className="text-right pr-3 whitespace-nowrap text-xs">
                    <button onClick={() => act(l, "extend", 3)} className="px-2 py-1 hover:text-urbanex-gold">+3 days</button>
                    {l.listing_state !== "removed" && <button onClick={() => act(l, "remove")} className="px-2 py-1 hover:text-red-600">Remove</button>}
                  </td>
                </tr>
              );
            })}
            {!data.items.length && <tr><td colSpan="6" className="p-8 text-center text-gray-400">No owner listings yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
