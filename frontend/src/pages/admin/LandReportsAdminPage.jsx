import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, FileUp, MessageCircle, Phone, Send, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { assetUrl } from "@/lib/config";
import { telLink, waLink, when } from "@/lib/crm";

const inp = "w-full border rounded-lg px-3 py-2 text-sm bg-white";
const FILTERS = [["", "All"], ["payment_submitted", "To confirm"], ["paid", "To fetch"], ["delivered", "Delivered"], ["awaiting_payment", "Not paid"]];
const CLS = { awaiting_payment: "bg-gray-100 text-gray-600", payment_submitted: "bg-amber-100 text-amber-700", payment_rejected: "bg-red-100 text-red-700", paid: "bg-sky-100 text-sky-700", delivered: "bg-emerald-100 text-emerald-700" };

function Settings() {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/admin/land-report-settings").then(r => setS(r.data)); }, []);
  if (!s) return null;
  const save = async (e) => { e.preventDefault(); try { const { data } = await api.put("/admin/land-report-settings", { enabled: s.enabled, price: Number(s.price), turnaround: s.turnaround }); setS(data); toast.success("Saved"); } catch { toast.error("Could not save"); } };
  return (
    <form onSubmit={save} className="rounded-2xl border bg-white p-4 flex flex-wrap items-end gap-4 text-sm">
      <label className="text-xs text-gray-500">Price (₹)<input type="number" min="1" className={`${inp} mt-1 w-28`} value={s.price} onChange={(e) => setS({ ...s, price: e.target.value })}/></label>
      <label className="text-xs text-gray-500">Delivery promise<input className={`${inp} mt-1 w-56`} value={s.turnaround} onChange={(e) => setS({ ...s, turnaround: e.target.value })}/></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })}/> Taking requests</label>
      <button className="bg-urbanex-navy text-urbanex-ivory rounded-full px-5 py-2">Save</button>
      <span className="text-xs text-gray-400">Your UPI ID and QR are set under Owner listings.</span>
    </form>
  );
}

function Card({ r, linkBase, reload }) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("Your land record report is ready.");
  const [ai, setAi] = useState(r.ai);
  const pick = useRef(null);
  const link = `${linkBase}/${r.id}?t=${r.token}`;
  const run = async (key, fn, ok) => { setBusy(key); try { const out = await fn(); if (ok) toast.success(ok); return out; } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); return null; } finally { setBusy(""); } };

  const upload = async (e) => {
    const fd = new FormData(); [...e.target.files].forEach(f => fd.append("files", f));
    await run("up", () => api.post(`/admin/land-reports/${r.id}/files`, fd, { headers: { "Content-Type": "multipart/form-data" } }), "Attached");
    e.target.value = ""; reload();
  };
  const explain = async () => { const d = await run("ai", () => api.post(`/admin/land-reports/${r.id}/ai`).then(x => x.data), "Written"); if (d) { setAi(d); reload(); } };
  const deliver = async () => { const d = await run("dl", () => api.post(`/admin/land-reports/${r.id}/deliver`, { message: msg }).then(x => x.data), "Delivered"); if (d) reload(); };
  const reject = async () => { const reason = window.prompt("Why? (the visitor sees this)", "I could not find this payment in my account"); if (reason) { await run("rj", () => api.post(`/admin/land-reports/${r.id}/reject`, { reason }), "Rejected"); reload(); } };

  return (
    <div className="rounded-2xl border bg-white p-5" data-testid={`land-report-${r.id}`}>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 flex-wrap"><span className="font-medium">{r.name}</span><span className={`text-xs rounded-full px-2.5 py-0.5 ${CLS[r.status]}`}>{r.status.replace("_", " ")}</span></div>
          <div className="text-sm text-gray-600 mt-1">{[r.mouza, r.block, r.district].filter(Boolean).join(", ")}</div>
          <div className="text-sm">Plot <b>{r.plot_no || "-"}</b> · Khatian <b>{r.khatian_no || "-"}</b>{r.jl_no ? ` · JL ${r.jl_no}` : ""}</div>
          {r.note && <div className="text-xs text-gray-500 mt-1">“{r.note}”</div>}
          <div className="text-xs text-gray-400 mt-1">Asked {when(r.created_at)} · ₹{r.price}</div>
        </div>
        <div className="flex gap-2 text-xs"><a href={telLink(r.phone)} className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5"><Phone className="w-3 h-3"/> {r.phone}</a>
          <a href={waLink(r.phone, `Hi ${r.name.split(" ")[0]}, about your land record request for plot ${r.plot_no || r.khatian_no}.`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-[#25D366] text-white px-3 py-1.5"><MessageCircle className="w-3 h-3"/> WhatsApp</a></div>
      </div>

      {r.status === "payment_submitted" && (
        <div className="mt-4 rounded-xl bg-amber-50 p-4 flex flex-wrap items-center gap-3">
          <div className="flex-1 text-sm">₹{r.payment?.amount} · UTR <span className="font-mono">{r.payment?.utr}</span>{r.payment?.payer_upi ? ` · from ${r.payment.payer_upi}` : ""}</div>
          <button onClick={() => run("cf", () => api.post(`/admin/land-reports/${r.id}/confirm`), "Confirmed").then(reload)} data-testid={`lr-confirm-${r.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 text-white px-5 py-2 text-sm"><Check className="w-4 h-4"/> Money received</button>
          <button onClick={reject} className="inline-flex items-center gap-1.5 rounded-full border border-red-300 text-red-600 px-4 py-2 text-sm"><X className="w-4 h-4"/> Not found</button>
        </div>
      )}

      {(r.status === "paid" || r.status === "delivered") && (
        <div className="mt-4 space-y-3 border-t pt-4">
          <div className="text-xs tracking-[0.2em] uppercase text-urbanex-gold">Fetch the record from Banglar Bhumi, then attach it</div>
          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={() => pick.current?.click()} disabled={busy === "up"} className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm"><FileUp className="w-4 h-4"/> {busy === "up" ? "Uploading…" : "Attach PDF / photos"}</button>
            <input ref={pick} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={upload}/>
            {(r.files || []).map((f, i) => <a key={i} href={assetUrl(f.url)} target="_blank" rel="noopener noreferrer" className="text-xs underline">{f.name}</a>)}
            {r.files?.length > 0 && <button onClick={explain} disabled={busy === "ai"} className="inline-flex items-center gap-1.5 rounded-full border border-urbanex-gold px-4 py-2 text-sm"><Sparkles className="w-4 h-4 text-urbanex-gold"/> {busy === "ai" ? "Reading…" : ai ? "Re-read with AI" : "Explain with AI"}</button>}
          </div>
          {ai && <div className="rounded-xl bg-gray-50 p-3 text-sm"><div>{ai.summary_en}</div>{ai.concerns?.length > 0 && <ul className="list-disc pl-5 mt-1 text-xs text-gray-600">{ai.concerns.map((c, i) => <li key={i}>{c.title}: {c.why}</li>)}</ul>}</div>}
          {r.files?.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <input className={`${inp} flex-1 min-w-[220px]`} value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={500}/>
              <button onClick={deliver} disabled={busy === "dl"} className="inline-flex items-center gap-1.5 rounded-full bg-urbanex-navy text-urbanex-ivory px-5 py-2 text-sm"><Send className="w-4 h-4"/> {r.status === "delivered" ? "Update" : "Deliver"}</button>
              <a href={waLink(r.phone, `Hi ${r.name.split(" ")[0]}, your land record report is ready: ${link}`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] text-white px-4 py-2 text-sm"><MessageCircle className="w-4 h-4"/> Send the link on WhatsApp</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LandReportsAdminPage() {
  const [data, setData] = useState({ items: [], counts: {}, link_base: "" });
  const [filter, setFilter] = useState("");
  const load = useCallback(() => api.get("/admin/land-reports", { params: filter ? { status: filter } : {} }).then(r => setData(r.data)).catch(() => toast.error("Could not load")), [filter]);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="p-6 md:p-10 space-y-6">
      <div><div className="text-xs tracking-[0.28em] uppercase text-urbanex-gold">Land records</div><h1 className="font-display text-4xl text-urbanex-navy mt-1">Report requests</h1></div>
      <Settings/>
      <div className="flex gap-2 text-sm flex-wrap">{FILTERS.map(([k, l]) => <button key={k} onClick={() => setFilter(k)} className={`px-4 py-1.5 rounded-full border ${filter === k ? "bg-urbanex-navy text-urbanex-ivory border-urbanex-navy" : "hover:border-urbanex-gold"}`}>{l}{k && data.counts[k] ? ` (${data.counts[k]})` : ""}</button>)}</div>
      <div className="space-y-4">
        {data.items.map(r => <Card key={r.id} r={r} linkBase={data.link_base} reload={load}/>)}
        {!data.items.length && <div className="rounded-2xl border bg-white p-12 text-center text-gray-400">No requests here.</div>}
      </div>
    </div>
  );
}
