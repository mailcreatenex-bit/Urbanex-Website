import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, CloudDownload, PhoneCall } from "lucide-react";
import { api } from "@/lib/api";
import { ago } from "@/lib/crm";

const SENT = { keen: "bg-emerald-100 text-emerald-700", neutral: "bg-gray-100 text-gray-600", doubtful: "bg-amber-100 text-amber-700", unhappy: "bg-red-100 text-red-700" };

export default function CallsPanel({ onOpenLead }) {
  const [data, setData] = useState({ items: [], drive: {} });
  const [open, setOpen] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get("/admin/crm/calls").then(r => setData(r.data)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const run = async () => {
    setBusy(true);
    try { const { data: d } = await api.post("/admin/crm/calls/drive/run"); toast.success(`${d.processed} new recording${d.processed === 1 ? "" : "s"} processed`); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Could not check Drive"); } finally { setBusy(false); }
  };
  const show = async (c) => {
    if (open === c.id) { setOpen(null); return; }
    setOpen(c.id); setText("Loading…");
    try { const { data: d } = await api.get(`/admin/crm/calls/${c.id}/transcript`); setText(d.transcript || "No transcript."); } catch { setText("Could not load."); }
  };
  const d = data.drive || {};
  return (
    <div className="mt-4 space-y-4" data-testid="crm-calls">
      <div className="rounded-2xl border bg-white p-4 flex flex-wrap items-center gap-3 text-sm">
        <PhoneCall className="w-5 h-5 text-urbanex-gold"/>
        <div className="flex-1 min-w-[260px]">
          <div className="font-medium">Call recordings</div>
          <div className="text-xs text-gray-500">
            Google Drive: {d.configured ? <b className="text-emerald-700">connected</b> : <b className="text-amber-700">not connected</b>}{d.last_run_at ? ` · last checked ${ago(d.last_run_at)}` : ""}
            {" · "}Phone system webhook: {d.webhook ? <b className="text-emerald-700">on</b> : <b className="text-gray-500">off</b>}
            {" · "}AI: {d.ai ? <b className="text-emerald-700">on</b> : <b className="text-amber-700">off</b>}
            {d.failed ? <span className="text-red-600"> · {d.failed} failed</span> : null}
          </div>
          {d.last_error && <div className="text-xs text-red-600 mt-1">{d.last_error}</div>}
          {!d.configured && <div className="text-xs text-gray-500 mt-1">Setup steps are in docs/CALL_RECORDING.md. You can always upload recordings by hand from “Add with AI”.</div>}
        </div>
        {d.configured && <button onClick={run} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 hover:border-urbanex-gold disabled:opacity-50"><CloudDownload className="w-4 h-4"/> {busy ? "Checking…" : "Check Drive now"}</button>}
      </div>
      <div className="space-y-2">
        {data.items.map(c => (
          <div key={c.id} className="rounded-xl border bg-white p-4" data-testid={`call-${c.id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => c.lead_id && onOpenLead(c.lead_id)} className="font-medium hover:text-urbanex-gold">{c.lead_name || c.name || "Unknown caller"}</button>
              <span className="text-xs text-gray-500">{c.phone || "no number found"}</span>
              {c.intent && <span className="text-[10px] uppercase tracking-widest bg-urbanex-gold/15 rounded-full px-2 py-0.5">{c.intent}</span>}
              {c.sentiment && <span className={`text-[10px] rounded-full px-2 py-0.5 ${SENT[c.sentiment] || ""}`}>{c.sentiment}</span>}
              {c.status === "failed" && <span className="text-[10px] rounded-full bg-red-100 text-red-700 px-2 py-0.5">failed: {c.error}</span>}
              <span className="ml-auto text-xs text-gray-400">{c.source} · {ago(c.created_at)}</span>
            </div>
            {c.summary && <p className="mt-1 text-sm text-gray-700">{c.summary}</p>}
            {c.action_items?.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-gray-600">{c.action_items.map((a, i) => <li key={i}>{a}</li>)}</ul>}
            {c.status === "done" && <button onClick={() => show(c)} className="mt-2 inline-flex items-center gap-1 text-xs text-urbanex-navy/60 hover:text-urbanex-gold"><ChevronDown className={`w-3 h-3 transition-transform ${open === c.id ? "rotate-180" : ""}`}/> Transcript</button>}
            {open === c.id && <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs text-gray-700 max-h-64 overflow-y-auto font-sans">{text}</pre>}
          </div>
        ))}
        {!data.items.length && <div className="rounded-2xl border bg-white p-12 text-center text-gray-400">No calls yet. Upload a recording from “Add with AI”, or connect Google Drive.</div>}
      </div>
    </div>
  );
}
