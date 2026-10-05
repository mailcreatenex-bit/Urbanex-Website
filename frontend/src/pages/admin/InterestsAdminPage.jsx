import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api, API_BASE } from "@/lib/api";

const FLAG_TEXT = { device_many_numbers: "this device used 3+ different numbers", number_many_devices: "this number was entered from 3+ devices", ip_many_numbers: "this network used 5+ different numbers" };
const Flag = ({ flags }) => (flags && flags.length ? <span title={flags.map(f => FLAG_TEXT[f] || f).join("; ")} className="ml-2 text-[10px] bg-amber-100 text-amber-800 rounded-full px-2 py-0.5 cursor-help" data-testid="flag-badge">⚠ check</span> : null);
const when = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");

// Who pressed Interested on what: grouped by listing (demand) and as a raw activity log.
export default function InterestsAdminPage() {
  const [summary, setSummary] = useState({ items: [], total_interests: 0, total_people: 0 });
  const [events, setEvents] = useState([]);
  const [view, setView] = useState("items");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    api.get("/admin/interests/summary").then(r => setSummary(r.data)).catch(() => {});
    api.get("/admin/interests", { params: q ? { q } : {} }).then(r => setEvents(r.data)).catch(() => {});
  }, [q]);
  useEffect(() => { const h = setTimeout(load, 250); return () => clearTimeout(h); }, [load]);

  return (
    <div className="p-6 md:p-10 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="font-display text-3xl text-urbanex-navy">Interested</h1>
        <button onClick={() => window.open(`${API_BASE}/admin/interests/export`, "_blank")} className="inline-flex items-center gap-2 border px-4 py-2 rounded-full text-sm hover:border-urbanex-gold"><Download className="w-4 h-4"/> Export CSV</button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-6 max-w-md text-sm">
        <div className="bg-white border rounded-xl p-4"><div className="text-xs text-gray-500">People</div><div className="text-2xl font-display" data-testid="interest-people">{summary.total_people}</div></div>
        <div className="bg-white border rounded-xl p-4"><div className="text-xs text-gray-500">Interests</div><div className="text-2xl font-display">{summary.total_interests}</div></div>
      </div>
      <div className="flex gap-2 mb-4 text-sm items-center">
        {[["items", "By property / video"], ["log", "All activity"]].map(([k, l]) => (
          <button key={k} onClick={() => setView(k)} className={`px-4 py-1.5 rounded-full border ${view === k ? "bg-urbanex-navy text-urbanex-ivory border-urbanex-navy" : "hover:border-urbanex-gold"}`}>{l}</button>
        ))}
        {view === "log" && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, title" className="ml-auto border rounded-full px-4 py-1.5 text-sm w-64"/>}
      </div>

      {view === "items" ? (
        <div className="space-y-3">
          {summary.items.map(g => {
            const key = `${g.item_type}:${g.item_id}`;
            return (
              <div key={key} className="bg-white border rounded-xl" data-testid="interest-item">
                <button onClick={() => setOpen(open === key ? null : key)} className="w-full flex items-center gap-4 p-4 text-left">
                  {g.thumbnail && <img src={g.thumbnail} alt="" className="w-16 h-11 object-cover rounded"/>}
                  <div className="flex-1 min-w-0"><div className="font-medium truncate">{g.title}</div><div className="text-xs text-gray-500">{g.item_type} · latest {when(g.latest_at)}</div></div>
                  <div className="text-right"><div className="text-2xl font-display">{g.count}</div><div className="text-[10px] uppercase tracking-wider text-gray-400">interested</div></div>
                </button>
                {open === key && (
                  <table className="w-full text-sm border-t"><tbody>
                    {g.people.map((p, i) => (
                      <tr key={i} className="border-b last:border-0"><td className="p-3 font-medium">{p.name}<Flag flags={p.flags}/></td><td><a className="underline" href={`tel:${p.phone}`}>{p.phone}</a></td><td className="text-gray-500">{p.email || ""}</td><td className="text-gray-400 text-xs">{when(p.at)}</td></tr>
                    ))}
                  </tbody></table>
                )}
              </div>
            );
          })}
          {!summary.items.length && <div className="py-16 text-center text-gray-400">Nobody has pressed Interested yet.</div>}
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-x-auto">
          <table className="w-full text-sm"><thead className="text-left text-xs text-gray-500 border-b"><tr><th className="p-3">When</th><th>Name</th><th>Phone</th><th>Interested in</th><th>Presses</th></tr></thead>
            <tbody>{events.map(e => <tr key={e.id} className="border-b last:border-0"><td className="p-3 text-gray-500 whitespace-nowrap">{when(e.last_at)}</td><td className="font-medium">{e.name}<Flag flags={e.flags}/></td><td><a className="underline" href={`tel:${e.phone}`}>{e.phone}</a></td><td className="max-w-[280px] truncate">{e.title} <span className="text-xs text-gray-400">({e.item_type})</span></td><td>{e.count}</td></tr>)}
              {!events.length && <tr><td colSpan="5" className="p-8 text-center text-gray-400">No activity.</td></tr>}</tbody></table>
        </div>
      )}
    </div>
  );
}
