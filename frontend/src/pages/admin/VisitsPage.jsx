import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const COLORS = { pending: "bg-amber-100 text-amber-800", confirmed: "bg-emerald-100 text-emerald-800", cancelled: "bg-gray-200 text-gray-600", completed: "bg-blue-100 text-blue-800", no_show: "bg-red-100 text-red-700" };
const fmt = (iso) => new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default function VisitsPage() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("upcoming");
  const load = useCallback(() => api.get("/admin/visits").then(r => setItems(r.data)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (v, status) => {
    const body = { status };
    if (status === "confirmed" && v.mode === "video" && !v.meeting_url) {
      const url = window.prompt("Paste the video meeting link (https://…) to email the visitor:");
      if (url === null) return;
      if (url.trim()) body.meeting_url = url.trim();
    }
    try { await api.patch(`/admin/visits/${v.id}`, body); toast.success(`Marked ${status.replace("_", " ")}`); load(); }
    catch (e) { toast.error(e?.response?.status === 422 ? "The meeting link must start with https://" : "Update failed"); }
  };

  const now = new Date().toISOString();
  const shown = items.filter(v => filter === "all" ? true : filter === "upcoming" ? v.slot >= now && ["pending", "confirmed"].includes(v.status) : v.status === filter);

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="font-display text-3xl text-urbanex-navy">Site visits</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
          {["upcoming", "pending", "confirmed", "completed", "cancelled", "no_show", "all"].map(x => <option key={x} value={x}>{x.replace("_", " ")}</option>)}
        </select>
      </div>
      <div className="space-y-3">
        {shown.map(v => (
          <div key={v.id} className="bg-white border rounded-xl p-4 flex flex-wrap items-center gap-4" data-testid="visit-row">
            <div className="min-w-[150px]"><div className="font-medium">{fmt(v.slot)}</div>
              {v.mode === "video" && <div className="text-xs text-blue-700">Video call{v.tz && v.tz !== "Asia/Kolkata" ? ` · visitor: ${new Date(v.slot).toLocaleString("en-GB", { timeZone: v.tz, weekday: "short", hour: "numeric", minute: "2-digit" })} (${v.tz})` : ""}</div>}<span className={`text-xs px-2 py-0.5 rounded-full ${COLORS[v.status]}`}>{v.status.replace("_", " ")}</span></div>
            <div className="flex-1 min-w-[200px]">
              <div className="font-medium">{v.property_title}</div>
              <div className="text-sm text-gray-600">{v.name} · <a className="underline" href={`tel:${v.phone}`}>{v.phone}</a>{v.email && <> · {v.email}</>}</div>
              {v.note && <div className="text-xs text-gray-500 mt-1">“{v.note}”</div>}
              {v.meeting_url && <a href={v.meeting_url} target="_blank" rel="noreferrer" className="text-xs underline text-blue-700">Meeting link</a>}
            </div>
            <div className="flex gap-2 flex-wrap">
              {v.status === "pending" && <button onClick={() => setStatus(v, "confirmed")} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-full">Confirm</button>}
              {v.status === "confirmed" && <>
                <button onClick={() => setStatus(v, "completed")} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-full">Completed</button>
                <button onClick={() => setStatus(v, "no_show")} className="text-xs border px-3 py-1.5 rounded-full">No-show</button>
              </>}
              {["pending", "confirmed"].includes(v.status) && <button onClick={() => setStatus(v, "cancelled")} className="text-xs border border-red-300 text-red-600 px-3 py-1.5 rounded-full">Cancel</button>}
            </div>
          </div>
        ))}
        {!shown.length && <div className="text-gray-400 py-12 text-center">No visits.</div>}
      </div>
    </div>
  );
}
