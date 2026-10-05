import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Send } from "lucide-react";
import { api } from "@/lib/api";
import { usePwa } from "@/context/PwaContext";

const LINKS = [["/", "Home"], ["/properties", "Properties"], ["/zone-quiz", "Find my zone"], ["/nri", "NRI desk"]];
const inp = "w-full border rounded-lg px-3 py-2 text-sm bg-white";

export default function PushAdminPage() {
  const [info, setInfo] = useState({ subscribers: 0, auto: true, recent: [] });
  const [f, setF] = useState({ title: "", body: "", url: "/properties", image: "" });
  const [busy, setBusy] = useState(false);
  const { push, enablePush } = usePwa();
  const load = useCallback(() => api.get("/admin/push").then(r => setInfo(r.data)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const set = (k) => (e) => setF(c => ({ ...c, [k]: e.target.value }));

  const send = async (test) => {
    if (!test && !window.confirm(`Send this notification to ${info.subscribers} subscriber(s) now?`)) return;
    setBusy(true);
    try {
      const { data } = await api.post("/admin/push/send", { title: f.title, body: f.body, url: f.url || "/", image: f.image || null, test });
      toast.success(`Delivered to ${data.sent} of ${data.subscribers}${data.removed ? ` · ${data.removed} expired removed` : ""}`);
      if (test && data.subscribers === 0) toast.info("No device of yours is subscribed yet. Use “Enable on this device” first.");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail?.[0]?.msg || "Could not send");
    } finally { setBusy(false); }
  };
  const toggleAuto = async () => { await api.put("/admin/push/auto", { auto: !info.auto }).catch(() => toast.error("Failed")); load(); };

  return (
    <div className="p-6 md:p-10 max-w-3xl">
      <h1 className="font-display text-3xl text-urbanex-navy mb-6">Push notifications</h1>
      <div className="grid sm:grid-cols-3 gap-3 mb-6 text-sm">
        <div className="bg-white border rounded-xl p-4"><div className="text-xs text-gray-500">Subscribed devices</div><div className="text-2xl font-display" data-testid="push-subscribers">{info.subscribers}</div></div>
        <div className="bg-white border rounded-xl p-4 sm:col-span-2 flex items-center justify-between gap-3">
          <div><div className="text-xs text-gray-500">Automatic alerts</div><div className="text-sm">New video tours and new listings are announced automatically</div></div>
          <button onClick={toggleAuto} role="switch" aria-checked={info.auto} data-testid="push-auto" className={`w-12 h-7 rounded-full transition-colors shrink-0 ${info.auto ? "bg-emerald-500" : "bg-gray-300"}`}>
            <span className={`block w-5 h-5 bg-white rounded-full transition-transform mx-1 ${info.auto ? "translate-x-5" : ""}`}/>
          </button>
        </div>
      </div>

      {!info.vapid_in_env && <div className="mb-4 rounded-lg bg-amber-50 text-amber-800 text-sm p-3">Push keys were generated automatically and stored in the database. For safety, copy them into the backend .env (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) once; if they are ever lost every subscriber would have to subscribe again.</div>}

      <section className="bg-white border rounded-xl p-5 mb-6 space-y-3">
        <h2 className="font-medium">Send a notification</h2>
        <input className={inp} placeholder="Title (max 80)" maxLength={80} value={f.title} onChange={set("title")} data-testid="push-title"/>
        <textarea className={inp} rows={3} placeholder="Message (max 300)" maxLength={300} value={f.body} onChange={set("body")} data-testid="push-body"/>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs text-gray-500">Opens<select className={`${inp} mt-1`} value={LINKS.some(l => l[0] === f.url) ? f.url : ""} onChange={set("url")}>{LINKS.map(([u, l]) => <option key={u} value={u}>{l}</option>)}</select></label>
          <label className="text-xs text-gray-500">Picture URL (optional)<input className={`${inp} mt-1`} placeholder="https://…" value={f.image} onChange={set("image")}/></label>
        </div>
        <div className="flex flex-wrap gap-3 pt-1">
          <button disabled={busy || !f.title || !f.body} onClick={() => send(true)} data-testid="push-test" className="border px-5 py-2 rounded-full text-sm hover:border-urbanex-gold disabled:opacity-50">Send test to my devices</button>
          <button disabled={busy || !f.title || !f.body} onClick={() => send(false)} data-testid="push-send" className="inline-flex items-center gap-2 bg-urbanex-navy text-urbanex-ivory px-6 py-2 rounded-full text-sm disabled:opacity-50"><Send className="w-4 h-4"/> Send to everyone</button>
          {!push.subscribed && push.supported && <button onClick={enablePush} className="inline-flex items-center gap-2 text-sm underline text-gray-600"><Bell className="w-4 h-4"/> Enable on this device</button>}
        </div>
      </section>

      <section className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-sm"><thead className="text-left text-xs text-gray-500 border-b"><tr><th className="p-3">When</th><th>Message</th><th>Delivered</th></tr></thead>
          <tbody>{info.recent.map(r => (
            <tr key={r.id} className="border-b last:border-0"><td className="p-3 text-gray-500 whitespace-nowrap">{new Date(r.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
              <td className="max-w-[320px]"><div className="font-medium truncate">{r.title}{r.test ? " (test)" : ""}</div><div className="text-xs text-gray-500 truncate">{r.body}</div></td>
              <td>{r.sent}/{r.subscribers}{r.removed ? ` · ${r.removed} expired` : ""}</td></tr>))}
            {!info.recent.length && <tr><td colSpan="3" className="p-8 text-center text-gray-400">Nothing sent yet.</td></tr>}</tbody></table>
      </section>
    </div>
  );
}
