import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SOURCES, STAGES } from "@/lib/crm";

const inp = "w-full border rounded-lg px-3 py-2 text-sm bg-white";
const Label = ({ children }) => <div className="text-[10px] tracking-[0.2em] uppercase text-urbanex-gold mb-1">{children}</div>;
const errText = (err, fallback) => {
  const d = err?.response?.data?.detail;
  if (Array.isArray(d)) return d.map(x => x.msg?.replace(/^Value error, /, "")).join("; ");
  return typeof d === "object" && d ? d.message : d || fallback;
};

// Add a lead by hand: walk-in, phone call, a portal enquiry you received by e-mail or WhatsApp...
export function AddLeadSheet({ open, onClose, onCreated, onOpenExisting }) {
  const blank = { name: "", phone: "", email: "", source_page: "phone_call", property_interest: "", message: "", budget_inr: "", status: "new", follow: "" };
  const [f, setF] = useState(blank);
  const [dup, setDup] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.value }));

  const submit = async (e, force = false) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const body = { name: f.name, phone: f.phone || null, email: f.email || null, source_page: f.source_page, property_interest: f.property_interest || null,
        message: f.message || null, budget_inr: f.budget_inr === "" ? null : Number(f.budget_inr), status: f.status, force,
        next_follow_up: f.follow ? new Date(f.follow).toISOString() : null };
      const { data } = await api.post("/admin/leads", body);
      toast.success("Lead added");
      setF(blank); setDup(null); onCreated(data);
    } catch (err) {
      if (err?.response?.status === 409) setDup(err.response.data.detail);
      else toast.error(errText(err, "Could not add the lead"));
    } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>Add a lead</SheetTitle></SheetHeader>
        <form onSubmit={submit} className="mt-5 grid grid-cols-2 gap-3 pb-10" data-testid="crm-add-form">
          <div className="col-span-2"><Label>Name</Label><input required className={inp} value={f.name} onChange={set("name")} autoFocus/></div>
          <div><Label>Phone</Label><input className={inp} value={f.phone} onChange={set("phone")} placeholder="98300 12345" inputMode="tel"/></div>
          <div><Label>E-mail</Label><input className={inp} value={f.email} onChange={set("email")} type="email"/></div>
          <div><Label>Where from</Label><select className={inp} value={f.source_page} onChange={set("source_page")}>{SOURCES.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></div>
          <div><Label>Stage</Label><select className={inp} value={f.status} onChange={set("status")}>{STAGES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}</select></div>
          <div className="col-span-2"><Label>Interested in</Label><input className={inp} value={f.property_interest} onChange={set("property_interest")} maxLength={200} placeholder="e.g. 3BHK near DVC More"/></div>
          <div><Label>Budget (₹)</Label><input type="number" min="0" className={inp} value={f.budget_inr} onChange={set("budget_inr")}/></div>
          <div><Label>Follow up on</Label><input type="datetime-local" className={inp} value={f.follow} onChange={set("follow")}/></div>
          <div className="col-span-2"><Label>Notes</Label><textarea rows={3} className={inp} value={f.message} onChange={set("message")} maxLength={2000}/></div>
          {dup && (
            <div className="col-span-2 rounded-lg bg-amber-50 text-amber-800 text-sm p-3">
              {dup.message}.
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => { onOpenExisting(dup.lead_id); onClose(); }} className="text-xs rounded-full bg-amber-600 text-white px-3 py-1">Open that lead</button>
                <button type="button" onClick={() => submit(null, true)} className="text-xs rounded-full border border-amber-600 px-3 py-1">Add anyway</button>
              </div>
            </div>
          )}
          <button disabled={busy} className="col-span-2 bg-urbanex-navy text-urbanex-ivory rounded-full py-2.5 text-sm disabled:opacity-50">{busy ? "Adding…" : "Add lead"}</button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// Bring in the enquiries you downloaded from 99acres, MagicBricks, Housing.com, a Facebook lead form...
export function ImportSheet({ open, onClose, onDone }) {
  const [source, setSource] = useState("99acres");
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_500_000) return toast.error("That file is too large (2.5 MB max)");
    setName(file.name); setText(await file.text()); setPreview(null);
  };
  const run = async (dry) => {
    setBusy(true);
    try { const { data } = await api.post("/admin/leads/import", { source, csv: text, dry_run: dry }); setPreview(data); if (!dry) { toast.success(`${data.created} leads imported`); onDone(); } }
    catch (err) { toast.error(errText(err, "Import failed")); }
    finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>Import leads (CSV)</SheetTitle></SheetHeader>
        <div className="mt-5 space-y-3 pb-10 text-sm" data-testid="crm-import">
          <p className="text-xs text-gray-500">Download your enquiries from the portal as CSV and drop the file here. Columns like Name, Mobile, Email, Property and Message are found automatically. Numbers already in the CRM are skipped.</p>
          <div><Label>Where are they from</Label><input list="imp-src" className={inp} value={source} onChange={(e) => setSource(e.target.value)}/><datalist id="imp-src">{["99acres", "magicbricks", "housing", "nobroker", "facebook", "olx"].map(s => <option key={s} value={s}/>)}</datalist></div>
          <label className="flex items-center gap-2 border-2 border-dashed rounded-xl p-4 cursor-pointer hover:border-urbanex-gold"><Upload className="w-4 h-4"/> {name || "Choose a .csv file"}<input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={pick}/></label>
          <details className="text-xs text-gray-500"><summary className="cursor-pointer">or paste the rows</summary><textarea rows={5} className={`${inp} mt-2 font-mono`} value={text} onChange={(e) => { setText(e.target.value); setPreview(null); }} placeholder={"Name,Mobile,Email,Property\nRahul,9830012345,,3BHK Goda"}/></details>
          {preview && (
            <div className={`rounded-lg p-3 ${preview.dry_run ? "bg-sky-50 text-sky-800" : "bg-emerald-50 text-emerald-800"}`}>
              {preview.dry_run ? "Preview: " : "Done: "}<b>{preview.created}</b> new, <b>{preview.duplicates}</b> already in the CRM, <b>{preview.skipped}</b> skipped.
              <div className="text-xs mt-1">Columns used: {Object.entries(preview.columns).map(([k, v]) => `${k} = “${v}”`).join(", ")}</div>
              {preview.problems?.map(p => <div key={p} className="text-xs">{p}</div>)}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" disabled={busy || !text.trim()} onClick={() => run(true)} className="rounded-full border px-5 py-2 disabled:opacity-50">Preview</button>
            <button type="button" disabled={busy || !text.trim() || !preview || preview.dry_run === false} onClick={() => run(false)} data-testid="crm-import-run" className="rounded-full bg-urbanex-navy text-urbanex-ivory px-5 py-2 disabled:opacity-50">Import {preview?.created ?? ""}</button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Edit the WhatsApp message templates ({name}, {property} and {me} are filled in per lead).
export function TemplatesSheet({ open, onClose, templates, onSaved }) {
  const [list, setList] = useState(null);
  const items = list || templates || [];
  const upd = (i, k, v) => setList(items.map((t, j) => (j === i ? { ...t, [k]: v } : t)));
  const save = async () => {
    try { const { data } = await api.put("/admin/crm/templates", { templates: items }); onSaved(data.templates); setList(null); toast.success("Templates saved"); onClose(); }
    catch { toast.error("Could not save"); }
  };
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader><SheetTitle>WhatsApp templates</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-4 pb-10" data-testid="crm-templates">
          <p className="text-xs text-gray-500">Use <code>{"{name}"}</code>, <code>{"{property}"}</code> and <code>{"{me}"}</code>. They appear under the WhatsApp button on every lead.</p>
          {items.map((t, i) => (
            <div key={t.id || i} className="rounded-xl border bg-white p-3 space-y-2">
              <div className="flex gap-2"><input className={inp} value={t.label} onChange={(e) => upd(i, "label", e.target.value)} placeholder="Name of the template"/><button type="button" aria-label="Remove" onClick={() => setList(items.filter((_, j) => j !== i))} className="p-2 hover:text-red-600"><Trash2 className="w-4 h-4"/></button></div>
              <textarea rows={3} className={inp} value={t.en} onChange={(e) => upd(i, "en", e.target.value)} placeholder="English"/>
              <textarea rows={3} className={inp} value={t.bn} onChange={(e) => upd(i, "bn", e.target.value)} placeholder="বাংলা"/>
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" onClick={() => setList([...items, { id: `tpl_${Date.now()}`, label: "", en: "", bn: "" }])} className="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm"><Plus className="w-4 h-4"/> Add</button>
            <button type="button" onClick={save} className="rounded-full bg-urbanex-navy text-urbanex-ivory px-5 py-2 text-sm">Save</button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
