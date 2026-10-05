import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { assetUrl, inr } from "@/lib/config";
import ImageUpload from "@/components/admin/ImageUpload";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const BLANK = {
  title: "", zone: "", property_type: "apartment", status: "available", bedrooms: "", bathrooms: "", area_sqft: "",
  price_inr: "", description: "", highlights: "", amenities: "", image: "", gallery: [], latitude: "", longitude: "",
  rera_number: "", verified: false, possession: "", furnishing: "", documents: "", floor_plan: "",
};
const lines = (s) => s.split("\n").map(x => x.trim()).filter(Boolean);
const toNum = (v) => (v === "" || v == null ? null : Number(v));

const toForm = (p) => ({
  ...BLANK, ...p,
  bedrooms: p.bedrooms ?? "", bathrooms: p.bathrooms ?? "", latitude: p.latitude ?? "", longitude: p.longitude ?? "",
  rera_number: p.rera_number ?? "", possession: p.possession ?? "", furnishing: p.furnishing ?? "", floor_plan: p.floor_plan ?? "",
  highlights: (p.highlights || []).join("\n"), amenities: (p.amenities || []).join("\n"),
  documents: (p.documents || []).map(d => `${d.name}${d.verified ? " | verified" : ""}`).join("\n"),
});

const toPayload = (f) => ({
  title: f.title, zone: f.zone, property_type: f.property_type, status: f.status,
  bedrooms: toNum(f.bedrooms), bathrooms: toNum(f.bathrooms), area_sqft: toNum(f.area_sqft), price_inr: toNum(f.price_inr),
  description: f.description, highlights: lines(f.highlights), amenities: lines(f.amenities),
  image: f.image, gallery: f.gallery, latitude: toNum(f.latitude), longitude: toNum(f.longitude),
  rera_number: f.rera_number || null, verified: !!f.verified, possession: f.possession || null, furnishing: f.furnishing || null,
  documents: lines(f.documents).map(l => { const [name, flag] = l.split("|").map(x => x.trim()); return { name, verified: /^verified$/i.test(flag || "") }; }),
  floor_plan: f.floor_plan || null,
});

const inp = "w-full border rounded-lg px-3 py-2 text-sm bg-white";
const Field = ({ label, children, className = "" }) => <label className={`block text-xs text-gray-500 ${className}`}>{label}<div className="mt-1">{children}</div></label>;

export default function PropertiesAdminPage() {
  const [items, setItems] = useState([]);
  const [zones, setZones] = useState([]);
  const [form, setForm] = useState(null); // null = closed
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get("/admin/properties").then(r => setItems(r.data)).catch(() => {}), []);
  useEffect(() => { load(); api.get("/config/public").then(r => setZones(r.data.zones || [])).catch(() => {}); }, [load]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.image) return toast.error("Add a cover image");
    setBusy(true);
    try {
      const payload = toPayload(form);
      if (form.id) await api.patch(`/admin/properties/${form.id}`, payload);
      else await api.post("/admin/properties", payload);
      toast.success("Saved");
      setForm(null); load();
    } catch (err) {
      const d = err?.response?.data?.detail;
      toast.error(Array.isArray(d) ? d.map(x => `${x.loc?.slice(-1)[0]}: ${x.msg}`).join("; ") : d || "Save failed");
    } finally { setBusy(false); }
  };

  const quick = async (p, patch) => { await api.patch(`/admin/properties/${p.id}`, patch).catch(() => toast.error("Update failed")); load(); };
  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    await api.delete(`/admin/properties/${p.id}`).catch(() => toast.error("Delete failed"));
    load();
  };

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-urbanex-navy">Properties</h1>
        <button onClick={() => setForm({ ...BLANK })} data-testid="property-new"
          className="inline-flex items-center gap-2 bg-urbanex-navy text-urbanex-ivory px-5 py-2.5 rounded-full text-sm"><Plus className="w-4 h-4"/> New property</button>
      </div>

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 border-b"><tr><th className="p-3">Property</th><th>Zone</th><th>Price</th><th>Status</th><th>Verified</th><th/></tr></thead>
          <tbody>
            {items.map(p => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="p-3 flex items-center gap-3"><img src={assetUrl(p.image, 160)} alt="" className="w-14 h-10 object-cover rounded"/><span className="font-medium">{p.title}</span></td>
                <td>{p.zone}</td>
                <td>{inr(p.price_inr)}</td>
                <td>
                  <select value={p.status} onChange={(e) => quick(p, { status: e.target.value })} className="border rounded px-2 py-1 text-xs">
                    {["available", "upcoming", "sold"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td><input type="checkbox" checked={!!p.verified} onChange={(e) => quick(p, { verified: e.target.checked })} aria-label="Verified"/></td>
                <td className="text-right pr-3 whitespace-nowrap">
                  <button onClick={() => setForm(toForm(p))} aria-label="Edit" className="p-2 hover:text-urbanex-gold"><Pencil className="w-4 h-4"/></button>
                  <button onClick={() => remove(p)} aria-label="Delete" className="p-2 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan="6" className="p-8 text-center text-gray-400">No properties yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <Sheet open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader><SheetTitle>{form?.id ? "Edit property" : "New property"}</SheetTitle></SheetHeader>
          {form && (
            <form onSubmit={save} className="mt-6 grid grid-cols-2 gap-4 pb-10" data-testid="property-form">
              <Field label="Title" className="col-span-2"><input required minLength={3} className={inp} value={form.title} onChange={set("title")}/></Field>
              <Field label="Zone"><input required list="zone-list" className={inp} value={form.zone} onChange={set("zone")}/><datalist id="zone-list">{zones.map(z => <option key={z} value={z}/>)}</datalist></Field>
              <Field label="Type"><select className={inp} value={form.property_type} onChange={set("property_type")}>{["apartment", "villa", "plot", "commercial"].map(x => <option key={x}>{x}</option>)}</select></Field>
              <Field label="Price (₹)"><input required type="number" min="1" className={inp} value={form.price_inr} onChange={set("price_inr")}/></Field>
              <Field label="Area (sqft)"><input required type="number" min="1" className={inp} value={form.area_sqft} onChange={set("area_sqft")}/></Field>
              <Field label="Bedrooms"><input type="number" min="0" className={inp} value={form.bedrooms} onChange={set("bedrooms")}/></Field>
              <Field label="Bathrooms"><input type="number" min="0" className={inp} value={form.bathrooms} onChange={set("bathrooms")}/></Field>
              <Field label="Status"><select className={inp} value={form.status} onChange={set("status")}>{["available", "upcoming", "sold"].map(x => <option key={x}>{x}</option>)}</select></Field>
              <Field label="Possession"><select className={inp} value={form.possession} onChange={set("possession")}><option value="">—</option>{["ready", "under_construction", "upcoming"].map(x => <option key={x}>{x}</option>)}</select></Field>
              <Field label="Furnishing"><select className={inp} value={form.furnishing} onChange={set("furnishing")}><option value="">—</option>{["unfurnished", "semi_furnished", "furnished"].map(x => <option key={x}>{x}</option>)}</select></Field>
              <Field label="RERA number (only if registered)"><input className={inp} value={form.rera_number} onChange={set("rera_number")} maxLength={60}/></Field>
              <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.verified} onChange={set("verified")}/> Title &amp; documents verified by Urbanex (shows a Verified badge)</label>
              <Field label="Description" className="col-span-2"><textarea required rows={4} className={inp} value={form.description} onChange={set("description")}/></Field>
              <Field label="Highlights (one per line)"><textarea rows={4} className={inp} value={form.highlights} onChange={set("highlights")}/></Field>
              <Field label="Amenities (one per line)"><textarea rows={4} className={inp} value={form.amenities} onChange={set("amenities")}/></Field>
              <Field label="Documents (one per line; add “| verified” when checked)" className="col-span-2"><textarea rows={3} className={inp} placeholder={"Title deed | verified\nMutation certificate"} value={form.documents} onChange={set("documents")}/></Field>
              <Field label="Map latitude"><input type="number" step="any" className={inp} value={form.latitude} onChange={set("latitude")}/></Field>
              <Field label="Map longitude"><input type="number" step="any" className={inp} value={form.longitude} onChange={set("longitude")}/></Field>
              <p className="col-span-2 text-xs text-gray-400 -mt-2">Tip: in Google/OpenStreetMap, right-click the exact spot and copy its coordinates. Seeded pins are only zone-approximate.</p>
              <div className="col-span-2"><ImageUpload label="Cover image" value={form.image} onChange={(v) => setForm(f => ({ ...f, image: v }))}/></div>
              <div className="col-span-2"><ImageUpload label="Gallery" multiple value={form.gallery} onChange={(v) => setForm(f => ({ ...f, gallery: v }))}/></div>
              <div className="col-span-2"><ImageUpload label="Floor plan (optional)" value={form.floor_plan} onChange={(v) => setForm(f => ({ ...f, floor_plan: v }))}/></div>
              <div className="col-span-2 flex gap-3 pt-2">
                <button disabled={busy} className="bg-urbanex-navy text-urbanex-ivory px-6 py-2.5 rounded-full text-sm disabled:opacity-50" data-testid="property-save">Save</button>
                <button type="button" onClick={() => setForm(null)} className="text-sm text-gray-500">Cancel</button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
