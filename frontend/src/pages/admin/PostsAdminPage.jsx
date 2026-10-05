import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import ImageUpload from "@/components/admin/ImageUpload";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const BLANK = { title: "", excerpt: "", body: "", cover: "", category: "area-guide", video_id: "", published: false };
const inp = "w-full border rounded-lg px-3 py-2 text-sm bg-white";

export default function PostsAdminPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get("/admin/posts").then(r => setItems(r.data)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const payload = { title: form.title, excerpt: form.excerpt, body: form.body, cover: form.cover || null, category: form.category, video_id: form.video_id.trim() || null, published: form.published };
    try {
      if (form.id) await api.patch(`/admin/posts/${form.id}`, payload); else await api.post("/admin/posts", payload);
      toast.success("Saved"); setForm(null); load();
    } catch (err) {
      const d = err?.response?.data?.detail;
      toast.error(Array.isArray(d) ? d.map(x => x.msg).join("; ") : d || "Save failed");
    } finally { setBusy(false); }
  };
  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.title}"?`)) return;
    await api.delete(`/admin/posts/${p.id}`).catch(() => toast.error("Delete failed"));
    load();
  };

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-urbanex-navy">Guides &amp; blog</h1>
        <button onClick={() => setForm({ ...BLANK })} className="inline-flex items-center gap-2 bg-urbanex-navy text-urbanex-ivory px-5 py-2.5 rounded-full text-sm"><Plus className="w-4 h-4"/> New article</button>
      </div>
      <div className="bg-white rounded-xl border divide-y">
        {items.map(p => (
          <div key={p.id} className="p-4 flex items-center gap-4">
            <div className="flex-1"><div className="font-medium">{p.title}</div><div className="text-xs text-gray-500">{p.category} · {p.published ? "published" : "draft"} · /blog/{p.slug}</div></div>
            <button onClick={() => setForm({ ...BLANK, ...p, cover: p.cover || "" })} aria-label="Edit" className="p-2 hover:text-urbanex-gold"><Pencil className="w-4 h-4"/></button>
            <button onClick={() => remove(p)} aria-label="Delete" className="p-2 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
          </div>
        ))}
        {!items.length && <div className="p-10 text-center text-gray-400">No articles yet. Write an area guide to start ranking for local searches.</div>}
      </div>

      <Sheet open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader><SheetTitle>{form?.id ? "Edit article" : "New article"}</SheetTitle></SheetHeader>
          {form && (
            <form onSubmit={save} className="mt-6 space-y-4 pb-10">
              <input required minLength={3} className={inp} placeholder="Title" value={form.title} onChange={set("title")}/>
              <select className={inp} value={form.category} onChange={set("category")}>{["area-guide", "buying-guide", "news", "site-update"].map(x => <option key={x}>{x}</option>)}</select>
              <textarea rows={2} maxLength={400} className={inp} placeholder="Short summary (shown on cards and link previews)" value={form.excerpt} onChange={set("excerpt")}/>
              <textarea required rows={14} className={`${inp} font-mono`} placeholder={"Plain text. Blank line = new paragraph.\n\n## Heading\n\n- bullet\n- bullet"} value={form.body} onChange={set("body")}/>
              <input className={inp} placeholder="YouTube video ID (optional, e.g. dQw4w9WgXcQ) - shown on the NRI page for site updates" value={form.video_id || ""} onChange={set("video_id")} maxLength={11}/>
              <ImageUpload label="Cover image (optional)" value={form.cover} onChange={(v) => setForm(f => ({ ...f, cover: v }))}/>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.published} onChange={set("published")}/> Published</label>
              <div className="flex gap-3"><button disabled={busy} className="bg-urbanex-navy text-urbanex-ivory px-6 py-2.5 rounded-full text-sm disabled:opacity-50">Save</button><button type="button" onClick={() => setForm(null)} className="text-sm text-gray-500">Cancel</button></div>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
