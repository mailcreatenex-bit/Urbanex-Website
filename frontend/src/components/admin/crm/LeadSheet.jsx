import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Mic, Sparkles, StopCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import LeadActions from "@/components/admin/crm/LeadActions";
import { SOURCES, STAGES, TEMP, dueLabel, followUpIn, fromLocalInput, inrShort, toLocalInput, waLink, when } from "@/lib/crm";

const inp = "w-full border rounded-lg px-3 py-2 text-sm bg-white";
const Label = ({ children }) => <div className="text-[10px] tracking-[0.2em] uppercase text-urbanex-gold mb-1">{children}</div>;
const OUTCOMES = [["answered", "Spoke"], ["no_answer", "No answer"], ["busy", "Busy"], ["callback", "Call back later"], ["wrong_number", "Wrong number"], ["not_interested", "Not interested"]];

export default function LeadSheet({ lead, onClose, onChange, templates, me }) {
  const [form, setForm] = useState(null);
  const [note, setNote] = useState("");
  const [ai, setAi] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [rec, setRec] = useState(null);

  useEffect(() => {
    setAi(null);
    setForm(lead ? {
      name: lead.name || "", phone: lead.phone || "", email: lead.email || "", source_page: lead.source_page || "manual",
      property_interest: lead.property_interest || "", budget_inr: lead.budget_inr ?? "", deal_value_inr: lead.deal_value_inr ?? "",
      priority: lead.priority || "", status: lead.status, next_follow_up: toLocalInput(lead.next_follow_up),
      follow_up_note: lead.follow_up_note || "", lost_reason: lead.lost_reason || "",
    } : null);
  }, [lead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const timeline = useMemo(() => {
    if (!lead) return [];
    const notes = (lead.notes || []).map(n => ({ id: n.id, at: n.created_at, kind: n.voice ? "voice" : "note", text: n.text, by: n.author }));
    const acts = (lead.activities || []).map(a => ({ id: a.id, at: a.at, kind: a.type, text: a.text, by: a.by }));
    return [...notes, ...acts].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }, [lead]);

  if (!lead || !form) return <Sheet open={false}><SheetContent/></Sheet>;
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const num = (v) => (v === "" || v == null ? null : Number(v));
  const due = dueLabel(lead.next_follow_up);
  const temp = TEMP[lead.temperature] || TEMP.cold;

  const patch = async (body, msg = "Saved") => {
    try { const { data } = await api.patch(`/admin/leads/${lead.id}`, body); onChange(data); if (msg) toast.success(msg); return data; }
    catch (err) { const d = err?.response?.data?.detail; toast.error(Array.isArray(d) ? d.map(x => x.msg).join("; ") : d || "Save failed"); return null; }
  };

  const saveDetails = (e) => {
    e.preventDefault();
    patch({
      name: form.name, phone: form.phone || undefined, email: form.email || null, source_page: form.source_page,
      property_interest: form.property_interest || null, budget_inr: num(form.budget_inr), deal_value_inr: num(form.deal_value_inr),
      priority: form.priority || null, lost_reason: form.lost_reason || null,
    });
  };
  const setFollowUp = (iso, noteText) => patch({ next_follow_up: iso, follow_up_note: noteText ?? (form.follow_up_note || null) }, iso ? "Follow-up set" : "Follow-up cleared")
    .then(d => d && setForm(f => ({ ...f, next_follow_up: toLocalInput(d.next_follow_up) })));

  const addNote = async () => {
    if (!note.trim()) return;
    try { await api.post(`/admin/leads/${lead.id}/notes`, { text: note }); setNote(""); const { data } = await api.get("/admin/leads", { params: { q: lead.phone || lead.name } }); const fresh = data.find(l => l.id === lead.id); if (fresh) onChange(fresh); }
    catch { toast.error("Couldn't add the note"); }
  };
  const outcome = async (o, label) => {
    try { const { data } = await api.post(`/admin/leads/${lead.id}/activity`, { type: "call", outcome: o, text: note.trim() || undefined }); setNote(""); onChange(data); toast.success(`Logged: ${label}`); }
    catch { toast.error("Couldn't log it"); }
  };

  const askAi = async () => {
    setAiBusy(true);
    try { const { data } = await api.post(`/admin/leads/${lead.id}/ai`); setAi(data); }
    catch (err) { toast.error(err?.response?.data?.detail || "The AI assistant is not available"); }
    finally { setAiBusy(false); }
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const fd = new FormData();
        fd.append("audio", new Blob(chunks, { type: "audio/webm" }), "note.webm");
        toast.loading("Transcribing…", { id: "trans" });
        try { await api.post(`/admin/leads/${lead.id}/transcribe`, fd, { headers: { "Content-Type": "multipart/form-data" } }); toast.success("Voice note added", { id: "trans" }); }
        catch { toast.error("Transcription failed", { id: "trans" }); }
      };
      mr.start(); setRec(mr);
    } catch { toast.error("Microphone permission denied"); }
  };
  const stopRec = () => { rec?.stop(); setRec(null); };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl bg-urbanex-ivory overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-3xl text-urbanex-navy flex items-center gap-3 flex-wrap">
            {lead.name}
            <span className={`text-xs font-sans rounded-full px-2.5 py-1 ${temp.cls}`} title={(lead.reasons || []).join(" · ")}>{temp.label} · {lead.score}</span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <LeadActions lead={lead} templates={templates} me={me} size="lg" onChange={onChange}/>
          {lead.visits > 0 && <span className="text-xs text-urbanex-navy/60">{lead.visits} visit{lead.visits > 1 ? "s" : ""} booked</span>}
        </div>
        {lead.reasons?.length > 0 && <div className="mt-2 text-xs text-urbanex-navy/55">{lead.reasons.join(" · ")}</div>}

        {/* stage */}
        <div className="mt-5 flex flex-wrap gap-1.5">
          {STAGES.map(s => (
            <button key={s.v} type="button" onClick={() => patch({ status: s.v }, "Stage updated")}
              className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${lead.status === s.v ? "text-white border-transparent" : "bg-white hover:border-urbanex-gold"}`}
              style={lead.status === s.v ? { background: s.color } : undefined}>{s.label}</button>
          ))}
        </div>

        {/* follow-up */}
        <div className="mt-6 rounded-xl border bg-white p-4" data-testid="crm-followup">
          <div className="flex items-center justify-between"><Label>Next follow-up</Label>{due && <span className={`text-xs ${due.tone === "bad" ? "text-red-600" : due.tone === "warn" ? "text-amber-600" : "text-urbanex-navy/60"}`}>{due.text}</span>}</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {[["Today 6 PM", () => { const d = new Date(); d.setHours(18, 0, 0, 0); return d.toISOString(); }], ["Tomorrow", () => followUpIn(1)], ["In 3 days", () => followUpIn(3)], ["Next week", () => followUpIn(7)], ["In a month", () => followUpIn(30)]].map(([l, f]) => (
              <button key={l} type="button" onClick={() => setFollowUp(f())} className="text-xs rounded-full border px-3 py-1 hover:border-urbanex-gold">{l}</button>
            ))}
            {lead.next_follow_up && <button type="button" onClick={() => setFollowUp(null)} className="text-xs rounded-full border px-3 py-1 text-red-600 hover:border-red-300">Clear</button>}
          </div>
          <div className="flex gap-2">
            <input type="datetime-local" className={inp} value={form.next_follow_up} onChange={set("next_follow_up")}/>
            <button type="button" onClick={() => setFollowUp(fromLocalInput(form.next_follow_up))} className="shrink-0 bg-urbanex-navy text-urbanex-ivory rounded-lg px-4 text-sm">Set</button>
          </div>
          <input className={`${inp} mt-2`} placeholder="What to do then (e.g. share the Goda plot video)" maxLength={300} value={form.follow_up_note} onChange={set("follow_up_note")}
            onBlur={() => form.follow_up_note !== (lead.follow_up_note || "") && patch({ follow_up_note: form.follow_up_note || null }, "")}/>
        </div>

        {/* AI */}
        <div className="mt-4 rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between">
            <Label>AI assistant</Label>
            <button type="button" onClick={askAi} disabled={aiBusy} data-testid="crm-ai" className="inline-flex items-center gap-1.5 text-xs rounded-full border px-3 py-1 hover:border-urbanex-gold disabled:opacity-50"><Sparkles className="w-3.5 h-3.5 text-urbanex-gold"/>{aiBusy ? "Thinking…" : ai ? "Refresh" : "Suggest next step"}</button>
          </div>
          {ai ? (
            <div className="text-sm space-y-2 text-urbanex-navy/80">
              <p>{ai.summary}</p>
              <p><span className="font-medium">Next:</span> {ai.next_action} <span className="ml-1 text-[10px] uppercase tracking-widest bg-urbanex-gold/15 rounded-full px-2 py-0.5">{ai.urgency}</span></p>
              {[["en", ai.whatsapp_en, "English"], ["bn", ai.whatsapp_bn, "বাংলা"]].filter(x => x[1]).map(([k, text, lbl]) => (
                <div key={k} className="rounded-lg bg-urbanex-cream p-3">
                  <div className="whitespace-pre-wrap">{text}</div>
                  <a href={waLink(lead.phone, text)} target="_blank" rel="noopener noreferrer"
                    onClick={() => api.post(`/admin/leads/${lead.id}/activity`, { type: "whatsapp", text: `Sent AI draft (${lbl})` }).then(r => onChange(r.data)).catch(() => {})}
                    className="mt-2 inline-block text-xs rounded-full bg-[#25D366] text-white px-3 py-1">Send on WhatsApp ({lbl})</a>
                </div>
              ))}
            </div>
          ) : <div className="text-xs text-urbanex-navy/50">Reads this lead's history and drafts a reply in English and Bengali.</div>}
        </div>

        {/* details */}
        <form onSubmit={saveDetails} className="mt-4 rounded-xl border bg-white p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Name</Label><input className={inp} value={form.name} onChange={set("name")} required/></div>
          <div><Label>Phone</Label><input className={inp} value={form.phone} onChange={set("phone")}/></div>
          <div><Label>E-mail</Label><input className={inp} value={form.email} onChange={set("email")}/></div>
          <div><Label>Source</Label><input list="crm-sources" className={inp} value={form.source_page} onChange={set("source_page")}/><datalist id="crm-sources">{SOURCES.map(s => <option key={s} value={s}/>)}</datalist></div>
          <div><Label>Priority (overrides score)</Label><select className={inp} value={form.priority} onChange={set("priority")}><option value="">Automatic</option><option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option></select></div>
          <div className="col-span-2"><Label>Interested in</Label><input className={inp} value={form.property_interest} onChange={set("property_interest")} maxLength={200}/></div>
          <div><Label>Budget (₹)</Label><input type="number" min="0" className={inp} value={form.budget_inr} onChange={set("budget_inr")}/></div>
          <div><Label>Deal value (₹)</Label><input type="number" min="0" className={inp} value={form.deal_value_inr} onChange={set("deal_value_inr")}/></div>
          {lead.status === "lost" && <div className="col-span-2"><Label>Why was it lost?</Label><input className={inp} value={form.lost_reason} onChange={set("lost_reason")} placeholder="Bought elsewhere, budget, not serious…"/></div>}
          {lead.message && <div className="col-span-2 text-sm text-urbanex-navy/70 bg-urbanex-cream rounded-lg p-3 whitespace-pre-wrap">{lead.message}</div>}
          <div className="col-span-2 flex items-center justify-between">
            <div className="flex flex-wrap gap-1">{(lead.tags || []).map(t => <span key={t} className="text-[10px] bg-gray-100 rounded-full px-2 py-0.5">{t}</span>)}</div>
            <button className="bg-urbanex-navy text-urbanex-ivory rounded-full px-5 py-2 text-sm">Save details</button>
          </div>
        </form>

        {/* log + timeline */}
        <div className="mt-6">
          <Label>Timeline</Label>
          <input className={`${inp} mb-2`} placeholder="Type a note, or pick how the call went…" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()}/>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button type="button" onClick={addNote} className="bg-urbanex-navy text-urbanex-ivory rounded-full px-4 py-1.5 text-xs">Add note</button>
            {OUTCOMES.map(([o, l]) => <button key={o} type="button" onClick={() => outcome(o, l)} className="text-xs rounded-full border px-3 py-1.5 hover:border-urbanex-gold">{l}</button>)}
            {rec ? <button type="button" onClick={stopRec} className="text-xs rounded-full border border-red-500 text-red-500 px-3 py-1.5 inline-flex items-center gap-1"><StopCircle className="w-3.5 h-3.5"/> Stop</button>
              : <button type="button" onClick={startRec} className="text-xs rounded-full border border-urbanex-gold px-3 py-1.5 inline-flex items-center gap-1"><Mic className="w-3.5 h-3.5"/> Voice note</button>}
          </div>
          <ol className="space-y-2 border-l-2 border-urbanex-gold/30 pl-4">
            {timeline.map(t => (
              <li key={t.id} className="relative text-sm">
                <span className="absolute -left-[22px] top-1.5 w-2.5 h-2.5 rounded-full bg-urbanex-gold"/>
                <div className="text-urbanex-navy/85 whitespace-pre-wrap">{t.text}</div>
                <div className="text-[10px] text-urbanex-navy/40">{t.kind}{t.by ? ` · ${t.by}` : ""} · {when(t.at)}</div>
              </li>
            ))}
            {!timeline.length && <li className="text-xs text-urbanex-navy/40">Nothing yet.</li>}
          </ol>
          {lead.deal_value_inr ? <div className="mt-4 text-xs text-urbanex-navy/50">Deal value {inrShort(lead.deal_value_inr)}</div> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
