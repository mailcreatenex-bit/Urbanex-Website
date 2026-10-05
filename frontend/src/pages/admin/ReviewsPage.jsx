import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Stars } from "@/components/properties/ReviewsSection";

export default function ReviewsPage() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("pending");
  const load = useCallback(() => api.get("/admin/reviews").then(r => setItems(r.data)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status) => { await api.patch(`/admin/reviews/${id}`, { status }).catch(() => toast.error("Failed")); load(); };
  const remove = async (id) => {
    if (!window.confirm("Delete this review permanently?")) return;
    await api.delete(`/admin/reviews/${id}`).catch(() => toast.error("Failed"));
    load();
  };
  const shown = items.filter(r => filter === "all" || r.status === filter);

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-urbanex-navy">Reviews</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
          {["pending", "approved", "rejected", "all"].map(x => <option key={x}>{x}</option>)}
        </select>
      </div>
      <div className="space-y-3">
        {shown.map(r => (
          <div key={r.id} className="bg-white border rounded-xl p-4">
            <div className="flex items-center justify-between"><span className="font-medium">{r.name}</span><Stars n={r.rating}/></div>
            <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">{r.text}</p>
            <div className="mt-3 flex gap-2 items-center text-xs">
              <span className="text-gray-400">{r.status} · {(r.created_at || "").slice(0, 10)}{r.property_id ? " · property review" : ""}</span>
              <span className="ml-auto flex gap-2">
                {r.status !== "approved" && <button onClick={() => setStatus(r.id, "approved")} className="bg-emerald-600 text-white px-3 py-1.5 rounded-full">Approve</button>}
                {r.status !== "rejected" && <button onClick={() => setStatus(r.id, "rejected")} className="border px-3 py-1.5 rounded-full">Reject</button>}
                <button onClick={() => remove(r.id)} className="border border-red-300 text-red-600 px-3 py-1.5 rounded-full">Delete</button>
              </span>
            </div>
          </div>
        ))}
        {!shown.length && <div className="text-gray-400 py-12 text-center">Nothing here.</div>}
      </div>
    </div>
  );
}
