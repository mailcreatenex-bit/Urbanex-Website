import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Pencil, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { inr } from "@/lib/config";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const inp = "w-full border rounded-lg px-3 py-2 text-sm bg-white";
const when = (iso) => (iso ? new Date(iso).toLocaleString("en-IN") : "never");

export default function VideosAdminPage() {
  const [data, setData] = useState({ items: [], sync: {}, counts: {} });
  const [filter, setFilter] = useState("all");
  const [zones, setZones] = useState([]);
  const [form, setForm] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(() => api.get("/admin/videos").then(r => setData(r.data)).catch(() => {}), []);
  useEffect(() => { load(); api.get("/config/public").then(r => setZones(r.data.zones || [])).catch(() => {}); }, [load]);

  const sync = async (full) => {
    setSyncing(true);
    try {
      const { data: r } = await api.post("/admin/videos/sync", { full });
      if (r.ok) toast.success(`Synced: ${r.new} new, ${r.updated} updated, ${r.total} on the site`);
      else toast.error(r.error || "Sync failed");
    } catch { toast.error("Sync failed"); } finally { setSyncing(false); load(); }
  };

  const save = async (e) => {
    e.preventDefault();
    const n = (v) => (v === "" || v == null ? null : Number(v));
    const body = { zone: form.zone || null, property_type: form.property_type || null, bedrooms: n(form.bedrooms), area_sqft: n(form.area_sqft),
      price_inr: n(form.price_inr), status: form.status || "available" };
    try { await api.patch(`/admin/videos/${form.video_id}`, body); toast.success("Saved"); setForm(null); load(); }
    catch (err) { toast.error(err?.response?.data?.detail?.[0]?.msg || "Save failed"); }
  };
  const reparse = async () => {
    await api.patch(`/admin/videos/${form.video_id}`, { reparse: true }).then(() => toast.success("Re-read from the YouTube text")).catch(() => toast.error("Failed"));
    setForm(null); load();
  };
  const toggleHidden = async (v) => { await api.patch(`/admin/videos/${v.video_id}`, { hidden: !v.hidden }).catch(() => toast.error("Failed")); load(); };

  const items = data.items.filter(v => filter === "all" ? !v.missing : filter === "needs" ? !v.missing && (!v.price_inr || !v.zone) : filter === "hidden" ? v.hidden : v.missing);
  const sy = data.sync || {};
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h1 className="font-display text-3xl text-urbanex-navy">YouTube videos</h1>
        <div className="flex gap-2">
          <button onClick={() => sync(false)} disabled={syncing} data-testid="sync-now" className="inline-flex items-center gap-2 bg-urbanex-navy text-urbanex-ivory px-5 py-2 rounded-full text-sm disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`}/> Sync now</button>
          <button onClick={() => sync(true)} disabled={syncing} className="border px-5 py-2 rounded-full text-sm disabled:opacity-50">Full re-sync</button>
        </div>
      </div>

      {!sy.configured && <div className="mb-4 rounded-lg bg-amber-50 text-amber-800 text-sm p-3">No YOUTUBE_API_KEY is set, so only the newest ~15 uploads are read from YouTube's public feed. Add the key in the backend .env to import the whole back catalogue.</div>}
      {sy.last_error && <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm p-3">Last sync failed: {sy.last_error}</div>}
      <p className="text-xs text-gray-500 mb-5">New uploads are picked up automatically about every {sy.every_minutes || 10} minutes. Last sync: {when(sy.last_run_at)} · full check: {when(sy.last_full_at)}.
        Details (location, type, bedrooms, area, price) are read from the video title/description; correct them here and your edits are kept.
        Anything written in a YouTube title or description is public on YouTube itself, so keep prices out of it and set them here.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 text-sm">
        {[["On the site", data.counts.visible], ["Missing price", data.counts.missing_price], ["Missing location", data.counts.missing_zone], ["All synced", data.counts.total]].map(([k, v]) => (
          <div key={k} className="bg-white border rounded-xl p-4"><div className="text-xs text-gray-500">{k}</div><div className="text-2xl font-display">{v ?? 0}</div></div>
        ))}
      </div>

      <div className="flex gap-2 mb-4 text-sm">
        {[["all", "All"], ["needs", "Needs price or location"], ["hidden", "Hidden"], ["missing", "Removed from YouTube"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-4 py-1.5 rounded-full border ${filter === k ? "bg-urbanex-navy text-urbanex-ivory border-urbanex-navy" : "hover:border-urbanex-gold"}`}>{l}</button>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500 border-b"><tr><th className="p-3">Video</th><th>Location</th><th>Type</th><th>BHK</th><th>Area</th><th>Price</th><th/></tr></thead>
          <tbody>
            {items.map(v => (
              <tr key={v.video_id} className={`border-b last:border-0 ${v.hidden ? "opacity-50" : ""}`}>
                <td className="p-3"><div className="flex items-center gap-3"><img src={v.thumbnail} alt="" className="w-20 h-12 object-cover rounded"/><div className="max-w-[260px]"><div className="font-medium line-clamp-2">{v.title}</div><div className="text-xs text-gray-400">{(v.published_at || "").slice(0, 10)}{v.is_short ? " · short" : ""}{(v.locked_fields || []).length ? " · edited" : ""}</div></div></div></td>
                <td className={v.zone ? "" : "text-amber-600"}>{v.zone || "missing"}</td>
                <td className="capitalize">{v.property_type || "—"}</td>
                <td>{v.bedrooms ?? "—"}</td>
                <td>{v.area_sqft || "—"}</td>
                <td className={v.price_inr ? "" : "text-amber-600"}>{v.price_inr ? inr(v.price_inr) : "missing"}</td>
                <td className="text-right pr-3 whitespace-nowrap">
                  <button onClick={() => setForm({ ...v, bedrooms: v.bedrooms ?? "", area_sqft: v.area_sqft ?? "", price_inr: v.price_inr ?? "", zone: v.zone || "", property_type: v.property_type || "" })} aria-label="Edit" className="p-2 hover:text-urbanex-gold"><Pencil className="w-4 h-4"/></button>
                  <button onClick={() => toggleHidden(v)} aria-label={v.hidden ? "Show" : "Hide"} className="p-2 hover:text-urbanex-gold">{v.hidden ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}</button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan="7" className="p-8 text-center text-gray-400">Nothing here.</td></tr>}
          </tbody>
        </table>
      </div>

      <Sheet open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Video details</SheetTitle></SheetHeader>
          {form && (
            <form onSubmit={save} className="mt-6 space-y-4 pb-10" data-testid="video-form">
              <img src={form.thumbnail} alt="" className="w-full rounded-lg"/>
              <div className="text-sm font-medium">{form.title}</div>
              <label className="block text-xs text-gray-500">Location<input list="vzones" className={`${inp} mt-1`} value={form.zone} onChange={set("zone")}/><datalist id="vzones">{zones.map(z => <option key={z} value={z}/>)}</datalist></label>
              <label className="block text-xs text-gray-500">Type<select className={`${inp} mt-1`} value={form.property_type} onChange={set("property_type")}><option value="">—</option>{["apartment", "villa", "plot", "commercial"].map(x => <option key={x}>{x}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-gray-500">Bedrooms<input type="number" min="0" className={`${inp} mt-1`} value={form.bedrooms} onChange={set("bedrooms")}/></label>
                <label className="block text-xs text-gray-500">Area (sqft)<input type="number" min="1" className={`${inp} mt-1`} value={form.area_sqft} onChange={set("area_sqft")}/></label>
              </div>
              <label className="block text-xs text-gray-500">Price (₹) - only shown to people who press Interested<input type="number" min="1" className={`${inp} mt-1`} value={form.price_inr} onChange={set("price_inr")} data-testid="video-price"/></label>
              <label className="block text-xs text-gray-500">Status<select className={`${inp} mt-1`} value={form.status || "available"} onChange={set("status")}>{["available", "upcoming", "sold"].map(x => <option key={x}>{x}</option>)}</select></label>
              <div className="flex gap-3 items-center pt-2">
                <button className="bg-urbanex-navy text-urbanex-ivory px-6 py-2.5 rounded-full text-sm" data-testid="video-save">Save</button>
                <button type="button" onClick={reparse} className="text-sm text-gray-500 underline">Reset to YouTube text</button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
