import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function DigestAdminPage() {
  const [info, setInfo] = useState(null);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState(null);
  const [subs, setSubs] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [a, p, s] = await Promise.all([api.get("/admin/digest"), api.get("/admin/digest/preview"), api.get("/admin/digest/subscribers")]).catch(() => []);
    if (!a) return;
    setInfo(a.data); setNote(a.data.note || ""); setPreview(p.data); setSubs(s.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveNote = async () => {
    await api.put("/admin/digest/note", { note }).then(() => toast.success("Note saved (included for 7 days)")).catch(() => toast.error("Save failed"));
    load();
  };
  const sendNow = async () => {
    if (!window.confirm(`Send the digest now to ${info?.counts.confirmed || 0} confirmed subscriber(s)?`)) return;
    setBusy(true);
    try {
      const { data } = await api.post("/admin/digest/send");
      toast.success(`Email: ${data.sent_email} · WhatsApp: ${data.sent_whatsapp} · nothing new: ${data.skipped_nothing_new} · failed: ${data.failed}`);
      if (data.skipped_no_smtp) toast.warning("Email is not configured (SMTP_HOST), so nothing was sent.");
      load();
    } catch { toast.error("Send failed"); } finally { setBusy(false); }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl">
      <h1 className="font-display text-3xl text-urbanex-navy mb-6">Weekly digest</h1>
      {info && (
        <div className="grid sm:grid-cols-4 gap-3 mb-6 text-sm">
          {[["Confirmed", info.counts.confirmed], ["Pending", info.counts.pending], ["Unsubscribed", info.counts.unsubscribed], ["WhatsApp opt-ins", info.whatsapp_opt_ins]].map(([k, v]) => (
            <div key={k} className="bg-white border rounded-xl p-4"><div className="text-xs text-gray-500">{k}</div><div className="text-2xl font-display">{v}</div></div>
          ))}
        </div>
      )}
      {info && !info.smtp_configured && <div className="mb-4 rounded-lg bg-amber-50 text-amber-800 text-sm p-3">Email is not set up (add SMTP_* in the backend .env). Until then confirmation emails and digests are not sent.</div>}
      {info && info.whatsapp_opt_ins > 0 && !info.whatsapp_webhook_configured && <div className="mb-4 rounded-lg bg-amber-50 text-amber-800 text-sm p-3">{info.whatsapp_opt_ins} subscriber(s) asked for WhatsApp but DIGEST_WEBHOOK_URL is not set, so only email goes out.</div>}
      <p className="text-xs text-gray-500 mb-4">Runs automatically: {info?.schedule}. Each person gets at most one digest per week, and only when there is something to say.</p>

      <section className="bg-white border rounded-xl p-5 mb-6">
        <h2 className="font-medium mb-2">A note from Ayan (optional)</h2>
        <textarea rows={3} maxLength={1500} value={note} onChange={(e) => setNote(e.target.value)} className="w-full border rounded-lg p-3 text-sm" placeholder="One local insight or tip for this week's digest"/>
        <button onClick={saveNote} className="mt-2 bg-urbanex-navy text-urbanex-ivory px-5 py-2 rounded-full text-sm">Save note</button>
      </section>

      <section className="bg-white border rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-2"><h2 className="font-medium">Preview</h2>
          <button onClick={sendNow} disabled={busy} className="bg-urbanex-gold text-urbanex-navy px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50">Send now</button></div>
        <div className="text-xs text-gray-500 mb-2">Subject: {preview?.subject}</div>
        <pre className="text-xs whitespace-pre-wrap bg-gray-50 rounded-lg p-3 max-h-72 overflow-auto">{preview?.text}</pre>
      </section>

      <section className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-sm"><thead className="text-left text-xs text-gray-500 border-b"><tr><th className="p-3">Email</th><th>Status</th><th>WhatsApp</th><th>Last sent</th></tr></thead>
          <tbody>{subs.map(s => <tr key={s.id} className="border-b last:border-0"><td className="p-3">{s.email}</td><td>{s.status}</td><td>{s.whatsapp ? s.phone : "—"}</td><td>{(s.last_sent_at || "").slice(0, 10) || "—"}</td></tr>)}
            {!subs.length && <tr><td colSpan="4" className="p-8 text-center text-gray-400">No subscribers yet.</td></tr>}</tbody></table>
      </section>
    </div>
  );
}
