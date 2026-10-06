import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import ImageUpload from "@/components/admin/ImageUpload";

const inp = "w-full border border-urbanex-navy/15 rounded-lg px-3 py-2.5 text-sm bg-white";
const Field = ({ label, children, className = "", hint }) => (
  <label className={`block text-xs text-urbanex-navy/60 ${className}`}>{label}<div className="mt-1">{children}</div>{hint && <span className="text-[11px] text-urbanex-navy/40">{hint}</span>}</label>
);
const toNum = (v) => (v === "" || v == null ? null : Number(v));

const BLANK = { title: "", listing_type: "sale", property_type: "plot", zone: "", address: "", area_sqft: "", bedrooms: "", bathrooms: "", price_inr: "", facing: "", floor_info: "",
  description: "", video_id: "", image: "", gallery: [], phone: "", accepted_terms: false };

export const toListingForm = (p) => ({ ...BLANK, ...p, address: p.address ?? "", facing: p.facing ?? "", floor_info: p.floor_info ?? "", price_inr: p.price_inr ?? "",
  bedrooms: p.bedrooms ?? "", bathrooms: p.bathrooms ?? "", video_id: p.video_id ?? "", image: p.image?.startsWith("https://i.ytimg.com/") ? "" : (p.image ?? ""), gallery: p.gallery || [] });

// Used both to list a new property and to edit one. `existing` = the listing being edited.
export default function ListingForm({ existing, onSaved, onCancel }) {
  const [f, setF] = useState(existing ? toListingForm(existing) : BLANK);
  const [zones, setZones] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/config/public").then(r => setZones(r.data.zones || [])).catch(() => {}); }, []);
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const rent = f.listing_type === "rent";

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const body = {
      title: f.title, listing_type: f.listing_type, property_type: f.property_type, zone: f.zone, address: f.address || null, area_sqft: toNum(f.area_sqft),
      bedrooms: toNum(f.bedrooms), bathrooms: toNum(f.bathrooms), price_inr: toNum(f.price_inr), facing: f.facing || null, floor_info: f.floor_info || null,
      description: f.description, video_id: f.video_id.trim() || null, image: f.image || null, gallery: f.gallery,
    };
    try {
      const { data } = existing
        ? await api.patch(`/owner/listings/${existing.id}`, body)
        : await api.post("/owner/listings", { ...body, phone: f.phone, accepted_terms: f.accepted_terms });
      toast.success(existing ? "Saved" : "Your listing is live!");
      onSaved(data);
    } catch (err) {
      const d = err?.response?.data?.detail;
      toast.error(Array.isArray(d) ? d.map(x => `${x.loc?.slice(-1)[0]}: ${x.msg?.replace(/^Value error, /, "")}`).join("; ") : d || "Could not save");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-4" data-testid="owner-listing-form">
      <Field label="Title" className="col-span-2"><input required minLength={3} maxLength={200} className={inp} value={f.title} onChange={set("title")} placeholder="e.g. 5 katha corner plot near GT Road"/></Field>
      <Field label="Listing for"><select className={inp} value={f.listing_type} onChange={set("listing_type")}><option value="sale">Sale</option><option value="rent">Rent</option></select></Field>
      <Field label="Type"><select className={inp} value={f.property_type} onChange={set("property_type")}>{["plot", "apartment", "villa", "commercial"].map(x => <option key={x} value={x}>{x}</option>)}</select></Field>
      <Field label="Area / locality"><input required list="owner-zones" className={inp} value={f.zone} onChange={set("zone")}/><datalist id="owner-zones">{zones.map(z => <option key={z} value={z}/>)}</datalist></Field>
      <Field label="Area (sqft)"><input required type="number" min="1" className={inp} value={f.area_sqft} onChange={set("area_sqft")}/></Field>
      <Field label="Address / landmark" className="col-span-2"><input className={inp} maxLength={200} value={f.address} onChange={set("address")} placeholder="Near DVC More, GT Road"/></Field>
      {f.property_type !== "plot" && <>
        <Field label="Bedrooms"><input type="number" min="0" className={inp} value={f.bedrooms} onChange={set("bedrooms")}/></Field>
        <Field label="Bathrooms"><input type="number" min="0" className={inp} value={f.bathrooms} onChange={set("bathrooms")}/></Field>
        <Field label="Floor (e.g. 3rd of 5)"><input className={inp} maxLength={60} value={f.floor_info} onChange={set("floor_info")}/></Field>
      </>}
      <Field label="Facing"><select className={inp} value={f.facing} onChange={set("facing")}><option value="">—</option>{["north", "south", "east", "west", "north_east", "north_west", "south_east", "south_west"].map(x => <option key={x} value={x}>{x.replace("_", "-")}</option>)}</select></Field>
      <Field label={rent ? "Rent per month (₹)" : "Price (₹)"} hint="Shown only to people who press Interested. Leave empty for “price on request”."><input type="number" min="1" className={inp} value={f.price_inr} onChange={set("price_inr")}/></Field>
      <Field label="Description" className="col-span-2"><textarea required rows={5} maxLength={5000} className={inp} value={f.description} onChange={set("description")} placeholder="Road width, facing, documents available, what makes it special…"/></Field>
      <Field label="YouTube video link (optional)" className="col-span-2" hint="A video makes buyers trust a listing. Upload it to YouTube (unlisted is fine) and paste the link."><input className={inp} value={f.video_id} onChange={set("video_id")} placeholder="https://youtu.be/…"/></Field>
      <div className="col-span-2"><ImageUpload endpoint="/owner/uploads" label="Cover photo (optional if you add a video)" value={f.image} onChange={(v) => setF(x => ({ ...x, image: v }))}/></div>
      <div className="col-span-2"><ImageUpload endpoint="/owner/uploads" label="More photos" multiple value={f.gallery} onChange={(v) => setF(x => ({ ...x, gallery: v }))}/></div>
      {!existing && (
        <>
          <Field label="Your phone / WhatsApp" className="col-span-2" hint="Only Urbanex sees this. Buyers contact you through us."><input required type="tel" inputMode="tel" className={inp} value={f.phone} onChange={set("phone")} placeholder="98300 12345"/></Field>
          <label className="col-span-2 flex items-start gap-2 text-xs text-urbanex-navy/70 leading-relaxed">
            <input type="checkbox" required checked={f.accepted_terms} onChange={set("accepted_terms")} className="mt-0.5 accent-[#C5A059]" data-testid="owner-terms"/>
            <span>I am the owner or an authorised agent of this property and the details are true. I understand that the listing is free for the first few days, then needs the listing fee paid by UPI, and that Urbanex Realty may remove any listing that is wrong, duplicated or unpaid. Urbanex does not verify owner listings.</span>
          </label>
        </>
      )}
      <div className="col-span-2 flex gap-3">
        <button disabled={busy} className="bg-urbanex-navy text-urbanex-ivory rounded-full px-7 py-3 text-sm disabled:opacity-50" data-testid="owner-listing-save">{busy ? "Saving…" : existing ? "Save changes" : "Publish my listing"}</button>
        {onCancel && <button type="button" onClick={onCancel} className="text-sm text-urbanex-navy/60">Cancel</button>}
      </div>
    </form>
  );
}
