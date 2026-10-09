import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AudioLines, BookUser, Camera, CreditCard, FileText, Mic, Sparkles, Square, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { inrShort } from "@/lib/crm";
import { aiLine, chunkPeople, parseTextFile, plainDraft } from "@/lib/chatImport";

const inp = "w-full border rounded-lg px-3 py-2 text-sm bg-white";
const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const TABS = [["voice", "Speak", Mic], ["type", "Type or paste", FileText], ["notes", "Photo of notes", Camera], ["card", "Business card", CreditCard], ["contacts", "Phone contacts", BookUser], ["calls", "Call recordings", AudioLines]];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const last10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);
const SHOWN = 30;   // a big import shows the first few to check; every one is saved
const err = (e, f) => { const d = e?.response?.data?.detail; return typeof d === "string" ? d : f; };

// Drafts the AI found: check and fix them, then save into the CRM.
function Drafts({ drafts, setDrafts, source, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(0);
  const upd = (i, patch) => setDrafts(d => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const updW = (i, patch) => setDrafts(d => d.map((x, j) => (j === i ? { ...x, wants: { ...x.wants, ...patch } } : x)));
  const save = async () => {
    setBusy(true);
    try {
      const body = drafts.map(({ existing, phone_unclear, ...d }) => ({ ...d, phone: d.phone || phone_unclear || null }));
      let created = 0, merged = 0;
      for (let i = 0; i < body.length; i += 50) {          // the server takes 50 at a time
        const { data } = await api.post("/admin/crm/ai/commit", { drafts: body.slice(i, i + 50), source });
        created += data.created; merged += data.merged; setSent(Math.min(body.length, i + 50));
      }
      toast.success(`${created} added, ${merged} updated`);
      onSaved({ created, merged });
    } catch (e) { toast.error(err(e, "Could not save")); } finally { setBusy(false); }
  };
  if (!drafts.length) return <div className="mt-4 text-sm text-gray-500">The AI did not find any customers. Try again with more detail or a clearer photo.</div>;
  return (
    <div className="mt-5 space-y-3" data-testid="ai-drafts">
      <div className="text-xs tracking-[0.2em] uppercase text-urbanex-gold">Check these, then save</div>
      {drafts.length > SHOWN && <div className="text-xs text-gray-500">Showing the first {SHOWN} of {drafts.length} to check. All {drafts.length} will be saved.</div>}
      {drafts.slice(0, SHOWN).map((d, i) => (
        <div key={i} className="rounded-xl border bg-white p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input className={inp} value={d.name || ""} onChange={(e) => upd(i, { name: e.target.value })} placeholder="Name"/>
            <button type="button" aria-label="Remove" onClick={() => setDrafts(x => x.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><input className={`${inp} ${d.phone_unclear && !d.phone ? "border-amber-400" : ""}`} value={d.phone || ""} onChange={(e) => upd(i, { phone: e.target.value, phone_unclear: null })} placeholder={d.phone_unclear ? `Check: ${d.phone_unclear}` : "Phone"}/>
              {d.phone_unclear && !d.phone && <div className="text-[11px] text-amber-700 mt-0.5">“{d.phone_unclear}” is not a full mobile number. Fix it, or leave it empty.</div>}</div>
            <input type="number" className={inp} value={d.wants?.budget_inr ?? ""} onChange={(e) => updW(i, { budget_inr: e.target.value ? Number(e.target.value) : null })} placeholder="Budget ₹"/>
          </div>
          <input className={inp} value={d.summary || ""} onChange={(e) => upd(i, { summary: e.target.value })} placeholder="What they want"/>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-600">
            {d.wants?.bedrooms != null && <span className="bg-gray-100 rounded-full px-2 py-0.5">{d.wants.bedrooms} BHK</span>}
            {d.wants?.property_type && <span className="bg-gray-100 rounded-full px-2 py-0.5">{d.wants.property_type}</span>}
            {d.wants?.listing_type && <span className="bg-gray-100 rounded-full px-2 py-0.5">{d.wants.listing_type}</span>}
            {(d.wants?.zones || []).map(z => <span key={z} className="bg-gray-100 rounded-full px-2 py-0.5">{z}</span>)}
            {d.wants?.budget_inr ? <span className="bg-gray-100 rounded-full px-2 py-0.5">{inrShort(d.wants.budget_inr)}</span> : null}
            <label className="ml-auto flex items-center gap-1">Follow up <input type="date" value={d.follow_up_date || ""} onChange={(e) => upd(i, { follow_up_date: e.target.value || null })} className="border rounded px-1 py-0.5"/></label>
          </div>
          {d.notes && <div className="text-xs text-gray-500">{d.notes}</div>}
          {d.existing && <div className="text-[11px] rounded bg-amber-50 text-amber-800 px-2 py-1">Already in your CRM as {d.existing.name} ({d.existing.status}). This will be added to that lead.</div>}
        </div>
      ))}
      <button onClick={save} disabled={busy} data-testid="ai-save" className="w-full rounded-full bg-urbanex-navy text-urbanex-ivory py-2.5 text-sm disabled:opacity-50">{busy ? `Saving… ${sent} of ${drafts.length}` : `Save ${drafts.length} to the CRM`}</button>
    </div>
  );
}

// Pick people from the address book (Chrome on Android) or load a .vcf file, and tag where you met them.
function Contacts({ onDone }) {
  const [met, setMet] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const canPick = typeof navigator !== "undefined" && "contacts" in navigator && "ContactsManager" in window;
  const send = async (body) => {
    setBusy(true);
    try { const { data } = await api.post("/admin/crm/contacts/import", { ...body, met: met.trim() || "phone contacts" }); toast.success(`${data.created} added, ${data.merged} already there${data.skipped ? `, ${data.skipped} had no number` : ""}`); onDone?.(); }
    catch (e) { toast.error(err(e, "Could not import")); } finally { setBusy(false); }
  };
  const pick = async () => {
    try { const picked = await navigator.contacts.select(["name", "tel", "email"], { multiple: true }); if (picked.length) await send({ contacts: picked.map(c => ({ name: (c.name || [])[0] || null, tel: c.tel || [], email: c.email || [] })) }); }
    catch { toast.error("Could not open your contacts"); }
  };
  const fromFile = async (e) => { const f = e.target.files?.[0]; if (!f) return; const vcf = await f.text(); e.target.value = ""; await send({ vcf }); };
  return (
    <div className="space-y-3" data-testid="ai-contacts">
      <p className="text-xs text-gray-500">Bring in people you already know. Say where you met them (for example "Kolkata property fair") so you can find them later and write to them the right way.</p>
      <input className={inp} value={met} onChange={(e) => setMet(e.target.value)} placeholder="Where did you meet them?" maxLength={60} data-testid="contacts-met"/>
      {canPick && <button type="button" onClick={pick} disabled={busy} className="w-full rounded-xl border-2 border-dashed p-6 text-center hover:border-urbanex-gold"><BookUser className="w-7 h-7 mx-auto text-urbanex-gold"/><div className="mt-2 text-sm">Choose from my phone contacts</div></button>}
      <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="w-full rounded-xl border-2 border-dashed p-6 text-center hover:border-urbanex-gold"><FileText className="w-7 h-7 mx-auto text-urbanex-gold"/><div className="mt-2 text-sm">Upload a contacts file (.vcf)</div><div className="text-[11px] text-gray-400 mt-1">In the Contacts app: select people, then Share or Export.</div></button>
      <input ref={fileRef} type="file" accept=".vcf,text/vcard,text/x-vcard" className="hidden" onChange={fromFile} data-testid="contacts-file"/>
    </div>
  );
}

function Speak({ onText }) {
  const [lang, setLang] = useState("en-IN");
  const [on, setOn] = useState(false);
  const [text, setText] = useState("");
  const rec = useRef(null);
  const base = useRef("");
  useEffect(() => () => rec.current?.stop?.(), []);
  if (!SR) return <div className="rounded-xl bg-amber-50 text-amber-800 text-sm p-4">This browser cannot turn speech into text. Open the CRM in Chrome on your phone or computer, or use “Type or paste” (your phone keyboard has a microphone button too).</div>;
  const start = () => {
    const r = new SR();
    r.lang = lang; r.continuous = true; r.interimResults = true;
    base.current = text ? text + " " : "";
    r.onresult = (e) => { let s = ""; for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript; setText(base.current + s); };
    r.onerror = (e) => { if (e.error !== "no-speech") toast.error(e.error === "not-allowed" ? "Allow the microphone to speak" : `Speech error: ${e.error}`); setOn(false); };
    r.onend = () => setOn(false);
    r.start(); rec.current = r; setOn(true);
  };
  const stop = () => { rec.current?.stop(); setOn(false); };
  return (
    <div className="space-y-3" data-testid="ai-speak">
      <p className="text-xs text-gray-500">Say it like you would to an assistant: “Rahul Sen, 98300 11223, wants a 3BHK in Goda, budget 65 lakh, call him tomorrow.”</p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={lang} onChange={(e) => setLang(e.target.value)} disabled={on} className="border rounded-full px-3 py-2 text-sm bg-white"><option value="en-IN">English</option><option value="bn-IN">বাংলা</option><option value="hi-IN">हिन्दी</option></select>
        {on ? <button type="button" onClick={stop} className="inline-flex items-center gap-2 rounded-full bg-red-600 text-white px-5 py-2.5 text-sm"><Square className="w-4 h-4"/> Stop</button>
          : <button type="button" onClick={start} data-testid="ai-mic" className="inline-flex items-center gap-2 rounded-full bg-urbanex-navy text-urbanex-ivory px-5 py-2.5 text-sm"><Mic className="w-4 h-4"/> Start speaking</button>}
        {on && <span className="inline-flex items-center gap-1 text-xs text-red-600"><span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"/> Listening…</span>}
      </div>
      <textarea rows={5} className={inp} value={text} onChange={(e) => setText(e.target.value)} placeholder="What you say appears here. You can fix it before sending."/>
      <button type="button" disabled={text.trim().length < 3} onClick={() => onText(text, "voice")} className="inline-flex items-center gap-2 rounded-full border border-urbanex-gold px-5 py-2.5 text-sm disabled:opacity-40"><Sparkles className="w-4 h-4 text-urbanex-gold"/> Read it with AI</button>
    </div>
  );
}

export default function AiAddSheet({ open, onClose, onDone }) {
  const [tab, setTab] = useState("voice");
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState(null);
  const [source, setSource] = useState("typed");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [phone, setPhone] = useState("");
  const notesRef = useRef(null), cardRef = useRef(null), callsRef = useRef(null), txtRef = useRef(null);
  const [file, setFile] = useState(null);      // a long .txt that was read: { name, parsed }
  const [prog, setProg] = useState(null);      // while the AI reads it in parts: { done, total, plain }
  const stop = useRef(false);

  useEffect(() => { if (open) { setDrafts(null); setResults(null); } else { stop.current = true; } }, [open, tab]);

  const fromText = async (t, kind) => {
    setBusy(true); setDrafts(null); setSource(kind === "voice" ? "voice" : "typed");
    try { const { data } = await api.post("/admin/crm/ai/text", { text: t, kind }); setDrafts(data.people); }
    catch (e) { toast.error(err(e, "The AI could not read that")); } finally { setBusy(false); }
  };
  // A .txt file: a short one goes into the box; a long one (a WhatsApp chat export) is split into people first.
  const pickTxt = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    if (f.size > 3_000_000) return toast.error("That file is too large (3 MB max). Split it into two.");
    const t = await f.text();
    if (t.length <= 7800) { setText(t); setFile(null); toast.success("File loaded. Press “Read it with AI”."); return; }
    const parsed = parseTextFile(t);
    if (!parsed.people.length) return toast.error("No phone numbers found in that file");
    setDrafts(null); setFile({ name: f.name, parsed });
  };
  const readBig = async (useAi) => {
    const people = file.parsed.people;
    setSource("textfile");
    if (!useAi) { setDrafts(people.map(plainDraft)); setFile(null); return; }
    const chunks = chunkPeople(people);
    stop.current = false; setBusy(true); setProg({ done: 0, total: chunks.length, plain: 0 }); setDrafts(null);
    const out = []; let plain = 0;
    for (let i = 0; i < chunks.length && !stop.current; i++) {
      let res = null;
      for (let tr = 0; tr < 2 && !res && !stop.current; tr++) {
        try { res = (await api.post("/admin/crm/ai/text", { text: chunks[i].map(aiLine).join("\n"), kind: "typed" })).data.people || []; }
        catch { if (tr === 0) await sleep(4000); }
      }
      const byPhone = new Map((res || []).filter(a => a.phone).map(a => [last10(a.phone), a]));
      for (const p of chunks[i]) {
        const a = byPhone.get(last10(p.phone));
        if (a) out.push({ ...a, name: a.name || p.name || null, phone: p.phone, notes: p.notes, role: a.role || p.role });
        else { out.push(plainDraft(p)); plain++; }      // the AI skipped or failed on this one: keep it as it was written
      }
      setProg({ done: i + 1, total: chunks.length, plain });
    }
    // anything not reached (stopped early) is kept as a plain draft too, so no number in the file is lost
    if (stop.current) { const done = new Set(out.map(d => last10(d.phone))); for (const p of people) if (!done.has(last10(p.phone))) out.push(plainDraft(p)); }
    setDrafts(out); setProg(null); setFile(null); setBusy(false);
  };
  const fromPhotos = async (e, kind) => {
    const files = [...e.target.files]; if (!files.length) return;
    const fd = new FormData(); files.forEach(f => fd.append("files", f)); if (kind === "card") fd.append("kind", "card");
    setBusy(true); setDrafts(null); setSource(kind === "card" ? "business_card" : "handwritten");
    try { const { data } = await api.post("/admin/crm/ai/notes", fd, { headers: { "Content-Type": "multipart/form-data" } }); setDrafts(data.people); }
    catch (er) { toast.error(err(er, "The AI could not read those photos")); } finally { setBusy(false); e.target.value = ""; }
  };
  const fromCalls = async (e) => {
    const files = [...e.target.files]; if (!files.length) return;
    const fd = new FormData(); files.forEach(f => fd.append("files", f)); if (phone.trim()) fd.append("phone", phone.trim());
    setBusy(true); setResults(null);
    try { const { data } = await api.post("/admin/crm/calls/upload", fd, { headers: { "Content-Type": "multipart/form-data" } }); setResults(data.results); onDone?.(); }
    catch (er) { toast.error(err(er, "Could not process the recordings")); } finally { setBusy(false); e.target.value = ""; }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-urbanex-gold"/> Add with AI</SheetTitle></SheetHeader>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {TABS.map(([k, l, Icon]) => <button key={k} type="button" onClick={() => setTab(k)} data-testid={`ai-tab-${k}`} className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm ${tab === k ? "bg-urbanex-navy text-urbanex-ivory border-urbanex-navy" : "bg-white hover:border-urbanex-gold"}`}><Icon className="w-3.5 h-3.5"/>{l}</button>)}
        </div>
        <div className="mt-5 pb-10">
          {tab === "voice" && <Speak onText={fromText}/>}
          {tab === "type" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Paste a WhatsApp chat, an e-mail or your own notes. English, Bengali or Hindi all work.</p>
              <textarea rows={7} className={inp} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Rahul Sen 98300 11223 wants 3bhk Goda budget 65 lakh\nMita Das 98301 22334 plot Borehat 28 lakh, call Monday"} data-testid="ai-text"/>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={text.trim().length < 3 || busy} onClick={() => fromText(text, "typed")} data-testid="ai-read" className="inline-flex items-center gap-2 rounded-full border border-urbanex-gold px-5 py-2.5 text-sm disabled:opacity-40"><Sparkles className="w-4 h-4 text-urbanex-gold"/> Read it with AI</button>
                <button type="button" disabled={busy} onClick={() => txtRef.current?.click()} data-testid="ai-txt" className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm hover:border-urbanex-gold disabled:opacity-40"><Upload className="w-4 h-4"/> Upload a .txt file</button>
                <input ref={txtRef} type="file" accept=".txt,text/plain" className="hidden" onChange={pickTxt} data-testid="ai-txt-file"/>
              </div>
              <p className="text-[11px] text-gray-400">A .txt file can be a WhatsApp chat (in WhatsApp: the chat, then ⋮, More, Export chat, Without media) or your own notes. Long files are read in parts.</p>
              {file && (
                <div className="rounded-xl border bg-white p-4 space-y-3" data-testid="ai-txt-found">
                  <div className="text-sm"><b>{file.parsed.people.length}</b> people with phone numbers found in <span className="font-medium">{file.name}</span>
                    <div className="text-xs text-gray-500 mt-0.5">{file.parsed.format}, {file.parsed.messages} messages, {file.parsed.withoutNumber} had no number and are skipped. Repeated numbers are merged into one person.</div></div>
                  <div className="text-xs text-gray-600 space-y-1">{file.parsed.people.slice(0, 3).map(p => <div key={p.phone} className="truncate">{p.name || "(no name)"} · {p.phone} · {p.summary}</div>)}</div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => readBig(true)} data-testid="ai-txt-ai" className="inline-flex items-center gap-2 rounded-full bg-urbanex-navy text-urbanex-ivory px-5 py-2.5 text-sm"><Sparkles className="w-4 h-4 text-urbanex-gold"/> Read with AI (about {Math.max(1, Math.ceil(chunkPeople(file.parsed.people).length * 8 / 60))} min)</button>
                    <button type="button" onClick={() => readBig(false)} data-testid="ai-txt-plain" className="rounded-full border px-5 py-2.5 text-sm hover:border-urbanex-gold">Add without AI (instant)</button>
                  </div>
                  <p className="text-[11px] text-gray-400">The AI adds budget, BHK, area and follow-up dates. Without it, each person is added with the words from the file. You check the first {SHOWN}, then save.</p>
                </div>
              )}
              {prog && (
                <div className="rounded-xl border bg-white p-4 space-y-2" data-testid="ai-txt-progress">
                  <div className="text-sm">Reading part {Math.min(prog.done + 1, prog.total)} of {prog.total}…</div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-urbanex-gold transition-all" style={{ width: `${(prog.done / prog.total) * 100}%` }}/></div>
                  <button type="button" onClick={() => { stop.current = true; }} className="text-xs underline text-gray-600">Stop and review what is read so far</button>
                </div>
              )}
            </div>
          )}
          {tab === "notes" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Photograph a page of handwritten notes (names, phone numbers, what they want). Lay it flat in good light. Up to 6 photos.</p>
              <button type="button" onClick={() => notesRef.current?.click()} disabled={busy} className="w-full rounded-xl border-2 border-dashed p-8 text-center hover:border-urbanex-gold"><Camera className="w-7 h-7 mx-auto text-urbanex-gold"/><div className="mt-2 text-sm">Take a photo or choose pictures</div></button>
              <input ref={notesRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => fromPhotos(e)} data-testid="ai-notes-file"/>
            </div>
          )}
          {tab === "card" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Photograph a visiting card (or several). The name, number, e-mail and company become a lead.</p>
              <button type="button" onClick={() => cardRef.current?.click()} disabled={busy} className="w-full rounded-xl border-2 border-dashed p-8 text-center hover:border-urbanex-gold"><CreditCard className="w-7 h-7 mx-auto text-urbanex-gold"/><div className="mt-2 text-sm">Take a photo of the card</div></button>
              <input ref={cardRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(e) => fromPhotos(e, "card")} data-testid="ai-card-file"/>
            </div>
          )}
          {tab === "contacts" && <Contacts onDone={() => { onDone?.(); onClose(); }}/>}
          {tab === "calls" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Upload call recordings (MP3, M4A, WAV, OGG, up to 14 MB each). The number is read from the file name, or from the call. Calls from your Google Drive folder are picked up by themselves, see the Calls tab.</p>
              <input className={inp} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Customer's number (only if the file name does not have it)"/>
              <button type="button" onClick={() => callsRef.current?.click()} disabled={busy} className="w-full rounded-xl border-2 border-dashed p-8 text-center hover:border-urbanex-gold"><AudioLines className="w-7 h-7 mx-auto text-urbanex-gold"/><div className="mt-2 text-sm">Choose recordings</div></button>
              <input ref={callsRef} type="file" accept="audio/*,.m4a,.mp3,.wav,.ogg,.aac,.flac" multiple className="hidden" onChange={fromCalls} data-testid="ai-calls-file"/>
              {results && (
                <div className="space-y-2" data-testid="ai-call-results">{results.map((r, i) => (
                  <div key={i} className={`rounded-xl border p-3 text-sm ${r.error ? "bg-red-50 border-red-200" : "bg-white"}`}>
                    <div className="font-medium truncate">{r.file}</div>
                    {r.error ? <div className="text-red-700">{r.error}</div> : r.duplicate ? <div className="text-gray-500">Already processed.</div> : r.ignored ? <div className="text-gray-500">Looked like a personal call, so nothing was saved.</div>
                      : <div className="text-gray-700">{r.created ? "New lead" : "Added to"} <b>{r.name || "unknown caller"}</b> {r.phone || <span className="text-amber-700">(no number found: add it to the lead)</span>}<div className="text-xs text-gray-500 mt-1">{r.summary}</div></div>}
                  </div>))}</div>
              )}
            </div>
          )}
          {busy && !prog && <div className="mt-4 text-sm text-gray-500 flex items-center gap-2"><Sparkles className="w-4 h-4 text-urbanex-gold animate-pulse"/> Reading…</div>}
          {drafts && <Drafts drafts={drafts} setDrafts={setDrafts} source={source} onSaved={(d) => { setDrafts(null); setText(""); onDone?.(d); onClose(); }}/>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
