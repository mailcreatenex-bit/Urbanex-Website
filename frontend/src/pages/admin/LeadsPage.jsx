import { useEffect, useMemo, useState } from "react";
import { api, API_BASE } from "@/lib/api";
import { ADMIN } from "@/constants/testIds";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Sparkles, Download, Mic, StopCircle, Search } from "lucide-react";

const STATUSES = [
  { v: "new", label: "New", color: "#3B82F6" },
  { v: "contacted", label: "Contacted", color: "#8B5CF6" },
  { v: "site_visit", label: "Site Visit", color: "#F59E0B" },
  { v: "negotiation", label: "Negotiation", color: "#C5A059" },
  { v: "closed", label: "Closed", color: "#10B981" },
  { v: "lost", label: "Lost", color: "#EF4444" },
];

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [q, setQ] = useState("");
  const [semantic, setSemantic] = useState("");
  const [semanticLoad, setSemanticLoad] = useState(false);
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const [recording, setRecording] = useState(false);
  const [recorder, setRecorder] = useState(null);

  const load = async () => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (source !== "all") params.set("source", source);
    if (q) params.set("q", q);
    const { data } = await api.get(`/admin/leads?${params}`);
    setLeads(data || []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status, source, q]);

  const sources = useMemo(() => Array.from(new Set(leads.map(l => l.source_page))).sort(), [leads]);

  const updateStatus = async (id, newStatus) => {
    try {
      await api.patch(`/admin/leads/${id}`, { status: newStatus });
      toast.success("Status updated");
      load();
    } catch { toast.error("Update failed"); }
  };

  const addNote = async () => {
    if (!note.trim() || !selected) return;
    try {
      await api.post(`/admin/leads/${selected.id}/notes`, { text: note });
      setNote("");
      const { data } = await api.get(`/admin/leads?`);
      setLeads(data);
      setSelected(data.find(l => l.id === selected.id));
    } catch { toast.error("Couldn't add note"); }
  };

  const startRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        const fd = new FormData();
        fd.append("audio", blob, "note.webm");
        toast.loading("Transcribing…", { id: "trans" });
        try {
          await api.post(`/admin/leads/${selected.id}/transcribe`, fd, { headers: { "Content-Type": "multipart/form-data" }});
          toast.success("Voice note added", { id: "trans" });
          const { data } = await api.get(`/admin/leads?`);
          setLeads(data); setSelected(data.find(l => l.id === selected.id));
        } catch { toast.error("Transcription failed", { id: "trans" }); }
      };
      mr.start();
      setRecorder(mr); setRecording(true);
    } catch { toast.error("Microphone permission denied"); }
  };
  const stopRecord = () => { recorder?.stop(); setRecording(false); };

  const runSemantic = async () => {
    if (!semantic.trim()) return;
    setSemanticLoad(true);
    try {
      const { data } = await api.post("/admin/leads/semantic", { query: semantic });
      setLeads(data.matches || []);
      toast.success(`${data.matches?.length || 0} matches (${data.reasoning})`);
    } catch { toast.error("Semantic search failed"); }
    finally { setSemanticLoad(false); }
  };

  const exportCsv = () => {
    window.open(`${API_BASE}/admin/leads/export`, "_blank");
  };

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.28em] uppercase text-urbanex-gold">CRM · Leads</div>
          <h1 className="font-display text-4xl text-urbanex-navy tracking-tight mt-1">All conversations, one board.</h1>
        </div>
        <Button data-testid={ADMIN.exportCsv} onClick={exportCsv} variant="outline" className="border-urbanex-navy/20 rounded-full">
          <Download className="w-4 h-4 mr-1"/> Export CSV
        </Button>
      </div>

      {/* Semantic */}
      <div className="mt-6 bg-white rounded-2xl p-5 border border-urbanex-navy/10 flex flex-wrap items-center gap-3">
        <Sparkles className="w-5 h-5 text-urbanex-gold"/>
        <Input data-testid={ADMIN.semanticInput} value={semantic} onChange={(e) => setSemantic(e.target.value)} placeholder="Natural-language filter — e.g. 'NRIs looking for villas over 1 crore'" className="flex-1 min-w-[280px] bg-urbanex-cream border-urbanex-navy/10 rounded-lg"/>
        <Button data-testid={ADMIN.semanticRun} onClick={runSemantic} disabled={semanticLoad} className="bg-urbanex-navy text-urbanex-ivory rounded-full">
          {semanticLoad ? "Searching…" : "Ask CRM"}
        </Button>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-urbanex-navy/40"/>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / phone / email" className="pl-9 w-72 bg-white border-urbanex-navy/15 rounded-full"/>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger data-testid={ADMIN.filterStatus} className="w-44 bg-white border-urbanex-navy/15 rounded-full"><SelectValue placeholder="Status"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger data-testid={ADMIN.filterSource} className="w-52 bg-white border-urbanex-navy/15 rounded-full"><SelectValue placeholder="Source"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-urbanex-navy/50 font-mono ml-auto">{leads.length} leads</span>
      </div>

      {/* Table */}
      <div className="mt-6 bg-white rounded-2xl border border-urbanex-navy/10 overflow-x-auto">
        <Table data-testid={ADMIN.leadsTable}>
          <TableHeader>
            <TableRow className="bg-urbanex-cream/50 hover:bg-urbanex-cream/50 border-urbanex-navy/10">
              <TableHead>Lead</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Interest</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map(l => {
              const st = STATUSES.find(s => s.v === l.status) || STATUSES[0];
              return (
                <TableRow key={l.id} data-testid={ADMIN.leadRow(l.id)}
                  onClick={() => setSelected(l)}
                  className="border-urbanex-navy/5 cursor-pointer hover:bg-urbanex-cream/40">
                  <TableCell>
                    <div className="font-medium text-urbanex-navy">{l.name}</div>
                    <div className="text-xs text-urbanex-navy/50 font-mono">{l.id.slice(0,12)}…</div>
                  </TableCell>
                  <TableCell className="text-sm text-urbanex-navy/70">
                    <div>{l.phone || "—"}</div>
                    <div className="text-xs">{l.email || "—"}</div>
                  </TableCell>
                  <TableCell className="text-xs">{l.source_page}</TableCell>
                  <TableCell className="text-sm text-urbanex-navy/70 max-w-[220px] truncate">{l.property_interest || "—"}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select value={l.status} onValueChange={(v) => updateStatus(l.id, v)}>
                      <SelectTrigger data-testid={ADMIN.leadStatus(l.id)} className="w-40 border-0 h-8 rounded-full text-xs"
                        style={{ background: `${st.color}20`, color: st.color }}>
                        <SelectValue/>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-urbanex-navy/50 text-right">{(l.created_at || "").slice(0,10)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {!leads.length && <div className="p-16 text-center text-urbanex-navy/40">No leads found for these filters.</div>}
      </div>

      {/* Lead sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg bg-urbanex-ivory">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-3xl text-urbanex-navy">{selected.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-3 text-sm text-urbanex-navy/75">
                <div><span className="text-urbanex-gold text-xs tracking-widest uppercase">Phone</span><div>{selected.phone || "—"}</div></div>
                <div><span className="text-urbanex-gold text-xs tracking-widest uppercase">Email</span><div>{selected.email || "—"}</div></div>
                <div><span className="text-urbanex-gold text-xs tracking-widest uppercase">Source</span><div>{selected.source_page}</div></div>
                <div><span className="text-urbanex-gold text-xs tracking-widest uppercase">Interest</span><div>{selected.property_interest || "—"}</div></div>
                <div><span className="text-urbanex-gold text-xs tracking-widest uppercase">Message</span><div className="whitespace-pre-wrap">{selected.message || "—"}</div></div>
              </div>

              <div className="mt-8">
                <div className="text-xs tracking-[0.28em] uppercase text-urbanex-gold mb-3">Notes</div>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {(selected.notes || []).map(n => (
                    <div key={n.id} className="bg-white rounded-lg p-3 border border-urbanex-navy/5">
                      <div className="text-sm text-urbanex-navy/80 whitespace-pre-wrap">{n.text}</div>
                      <div className="text-[10px] text-urbanex-navy/40 mt-1 flex gap-2">
                        {n.voice && <span className="text-urbanex-gold">● voice</span>}
                        <span>{n.author}</span>·<span>{(n.created_at || "").slice(0,16).replace("T"," ")}</span>
                      </div>
                    </div>
                  ))}
                  {!(selected.notes || []).length && <div className="text-xs text-urbanex-navy/40">No notes yet.</div>}
                </div>
                <div className="mt-4 space-y-2">
                  <Input placeholder="Type a call note…" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} className="h-11 bg-white border-urbanex-navy/10 rounded-lg"/>
                  <div className="flex gap-2">
                    <Button onClick={addNote} className="bg-urbanex-navy text-urbanex-ivory rounded-full">Add note</Button>
                    {recording ? (
                      <Button onClick={stopRecord} variant="outline" className="border-red-500 text-red-500 rounded-full"><StopCircle className="w-4 h-4 mr-1"/> Stop</Button>
                    ) : (
                      <Button onClick={startRecord} variant="outline" className="border-urbanex-gold text-urbanex-navy rounded-full"><Mic className="w-4 h-4 mr-1"/> Voice note (Whisper)</Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
