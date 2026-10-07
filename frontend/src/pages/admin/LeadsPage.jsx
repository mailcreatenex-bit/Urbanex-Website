import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AlarmClock, Download, FileUp, Flame, LayoutGrid, ListChecks, MessageSquareText, Plus, Search, Sparkles, Table2, TrendingUp, BarChart3, Zap, Target, PhoneCall, X, Inbox, Send, Bot, ShieldAlert } from "lucide-react";
import { api, API_BASE } from "@/lib/api";
import { ADMIN } from "@/constants/testIds";
import Board, { LeadCard } from "@/components/admin/crm/Board";
import Insights from "@/components/admin/crm/Insights";
import LeadActions from "@/components/admin/crm/LeadActions";
import LeadSheet from "@/components/admin/crm/LeadSheet";
import AiAddSheet from "@/components/admin/crm/AiAddSheet";
import MatchesPanel from "@/components/admin/crm/MatchesPanel";
import CallsPanel from "@/components/admin/crm/CallsPanel";
import PlanPanel from "@/components/admin/crm/PlanPanel";
import InsightsExtra from "@/components/admin/crm/InsightsExtra";
import { AutomationPanel, InboxPanel, OutboxPanel } from "@/components/admin/crm/AutomationPanels";
import { useAuth } from "@/context/AuthContext";
import { AddLeadSheet, ImportSheet, TemplatesSheet } from "@/components/admin/crm/CrmDialogs";
import { SOURCES, STAGES, TEMP, dueLabel, followUpIn, inrShort, stageOf } from "@/lib/crm";

const sel = "bg-white border border-urbanex-navy/15 rounded-full px-4 py-2 text-sm";
const TABS = [["today", "Today", ListChecks], ["board", "Board", LayoutGrid], ["table", "Table", Table2], ["matches", "Matches", Target], ["calls", "Calls", PhoneCall], ["insights", "Insights", BarChart3], ["inbox", "Inbox", Inbox], ["outbox", "Messages", Send], ["auto", "Automation", Bot]];
const STAFF_TABS = ["today", "board", "table", "matches"];

function Stat({ label, value, sub, icon: Icon, tone = "", onClick, testId }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} className={`text-left rounded-2xl border bg-white p-4 hover:border-urbanex-gold/60 transition-colors ${tone}`}>
      <div className="flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-urbanex-navy/55"><Icon className="w-3.5 h-3.5 text-urbanex-gold"/>{label}</div>
      <div className="font-display text-3xl text-urbanex-navy mt-1">{value}</div>
      {sub && <div className="text-xs text-urbanex-navy/50 mt-0.5">{sub}</div>}
    </button>
  );
}

export default function LeadsPage() {
  const [sp, setSp] = useSearchParams();
  const { user } = useAuth();
  const tabs = user?.is_admin ? TABS : TABS.filter(t => STAFF_TABS.includes(t[0]));
  const [spam, setSpam] = useState(false);
  const [leads, setLeads] = useState([]);
  const [summary, setSummary] = useState(null);
  const [tab, setTab] = useState(sp.get("match") ? "matches" : "today");
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [temperature, setTemperature] = useState("");
  const [sort, setSort] = useState("newest");
  const [semantic, setSemantic] = useState("");
  const [semanticLoad, setSemanticLoad] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiInfo, setAiInfo] = useState(null);
  const [openId, setOpenId] = useState(sp.get("lead"));
  const [picked, setPicked] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [me, setMe] = useState("Ayan");
  const [dlg, setDlg] = useState(null);   // "add" | "import" | "templates"
  const [dupes, setDupes] = useState(0);

  const load = useCallback(async () => {
    const params = {};
    if (source) params.source = source;
    if (temperature) params.temperature = temperature;
    if (q) params.q = q;
    if (sort !== "newest") params.sort = sort;
    if (spam) params.tag = "spam";
    const { data } = await api.get("/admin/leads", { params });
    setLeads(data || []);
  }, [source, temperature, q, sort, spam]);
  const loadSummary = useCallback(() => api.get("/admin/crm/summary").then(r => setSummary(r.data)).catch(() => {}), []);

  useEffect(() => { const h = setTimeout(() => { setAiResult(null); load().catch(() => toast.error("Could not load leads")); }, 200); return () => clearTimeout(h); }, [load]);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => {
    api.get("/admin/crm/templates").then(r => { setTemplates(r.data.templates); setMe(r.data.me); }).catch(() => {});
    api.get("/admin/crm/duplicates").then(r => setDupes(r.data.length)).catch(() => {});
  }, []);

  const shown = aiResult || leads;
  const [extra, setExtra] = useState(null);
  useEffect(() => {      // a lead opened from Calls or Matches may not be in the current list
    if (!openId || shown.some(l => l.id === openId) || leads.some(l => l.id === openId)) { setExtra(null); return; }
    api.get("/admin/leads", { params: { limit: 1000 } }).then(r => setExtra((r.data || []).find(l => l.id === openId) || null)).catch(() => {});
  }, [openId, shown, leads]);
  const open = useMemo(() => shown.find(l => l.id === openId) || leads.find(l => l.id === openId) || extra, [shown, leads, openId, extra]);
  const openLead = (l) => { setOpenId(l.id); };
  const closeLead = () => { setOpenId(null); if (sp.get("lead")) { sp.delete("lead"); setSp(sp, { replace: true }); } };

  // an updated lead from any action replaces its row everywhere
  const onChange = useCallback((upd) => {
    setLeads(cur => cur.map(l => (l.id === upd.id ? upd : l)));
    setAiResult(cur => cur && cur.map(l => (l.id === upd.id ? upd : l)));
    loadSummary();
  }, [loadSummary]);

  const move = async (id, status) => {
    const lead = leads.find(l => l.id === id);
    if (!lead || lead.status === status) return;
    const body = { status };
    if (status === "closed") {
      const v = window.prompt("Deal value in ₹ (optional, for revenue figures):", lead.deal_value_inr || lead.budget_inr || "");
      if (v === null) return;
      if (v.trim() && !Number.isNaN(Number(v))) body.deal_value_inr = Number(v);
    } else if (status === "lost") {
      const v = window.prompt("Why was it lost? (optional)", "");
      if (v === null) return;
      if (v.trim()) body.lost_reason = v.trim();
    }
    try { const { data } = await api.patch(`/admin/leads/${id}`, body); onChange(data); toast.success(`Moved to ${stageOf(status).label}`); }
    catch { toast.error("Could not move it"); }
  };

  const runSemantic = async () => {
    if (!semantic.trim()) { setAiResult(null); return; }
    setSemanticLoad(true);
    try {
      const { data } = await api.post("/admin/crm/ai/filter", { query: semantic });
      setAiResult(data.matches || []); setAiInfo(data); setTab("table");
    } catch { toast.error("Search failed"); } finally { setSemanticLoad(false); }
  };

  const clearAi = () => { setAiResult(null); setAiInfo(null); setSemantic(""); };
  const chips = aiInfo ? Object.entries(aiInfo.filters || {}).flatMap(([k, v]) => {
    if (v == null || v === false || (Array.isArray(v) && !v.length)) return [];
    const val = Array.isArray(v) ? v.join(", ") : v === true ? "yes" : k.startsWith("budget") ? inrShort(v) : String(v);
    return [`${k.replace(/_/g, " ")}: ${val}`];
  }) : [];

  const bulk = async (action, value) => {
    try { const { data } = await api.post("/admin/leads/bulk", { ids: picked, action, value }); toast.success(`${data.changed} updated`); setPicked([]); load(); loadSummary(); }
    catch (err) { toast.error(err?.response?.data?.detail || "Bulk update failed"); }
  };
  const pick = (id) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  const today = useMemo(() => {
    const open_ = shown.filter(l => !["closed", "lost"].includes(l.status));
    const overdue = open_.filter(l => l.follow_up_overdue).sort((a, b) => String(a.next_follow_up).localeCompare(String(b.next_follow_up)));
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
    const dueToday = open_.filter(l => !l.follow_up_overdue && l.next_follow_up && new Date(l.next_follow_up) <= endOfDay);
    const listed = new Set([...overdue, ...dueToday].map(l => l.id));
    const waiting = open_.filter(l => !listed.has(l.id) && l.status === "new" && !l.first_contacted_at && !l.tags?.includes("imported"));
    const used = new Set([...listed, ...waiting.map(l => l.id)]);
    const hotIdle = open_.filter(l => l.temperature === "hot" && !l.next_follow_up && !used.has(l.id));
    return [["Overdue follow-ups", overdue, "text-red-600"], ["Due today", dueToday, "text-amber-600"], ["Waiting for a first reply", waiting, "text-blue-600"], ["Hot leads with no follow-up set", hotIdle, "text-urbanex-navy"]];
  }, [shown]);

  const cardProps = { onOpen: openLead, templates, me, onChange };
  const countToday = (summary?.follow_ups_overdue || 0) + (summary?.follow_ups_today || 0);

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.28em] uppercase text-urbanex-gold">CRM</div>
          <h1 className="font-display text-4xl text-urbanex-navy tracking-tight mt-1">Every enquiry, one place.</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setDlg("ai")} data-testid="crm-ai-add" className="inline-flex items-center gap-1.5 rounded-full border border-urbanex-gold bg-urbanex-gold/10 px-5 py-2.5 text-sm hover:bg-urbanex-gold/20"><Sparkles className="w-4 h-4 text-urbanex-gold"/> Add with AI</button>
          <button onClick={() => setDlg("add")} data-testid="crm-add" className="inline-flex items-center gap-1.5 rounded-full bg-urbanex-navy text-urbanex-ivory px-5 py-2.5 text-sm"><Plus className="w-4 h-4"/> Add lead</button>
          <button onClick={() => setDlg("import")} className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm hover:border-urbanex-gold"><FileUp className="w-4 h-4"/> Import</button>
          <button onClick={() => setDlg("templates")} className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm hover:border-urbanex-gold"><MessageSquareText className="w-4 h-4"/> Templates</button>
          <button data-testid={ADMIN.exportCsv} onClick={() => window.open(`${API_BASE}/admin/leads/export`, "_blank")} className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm hover:border-urbanex-gold"><Download className="w-4 h-4"/> Export</button>
        </div>
      </div>

      {/* numbers */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3" data-testid="crm-stats">
        <Stat label="New today" value={summary?.new_today ?? "–"} icon={Zap} onClick={() => { setSort("newest"); setTab("table"); }}/>
        <Stat label="Waiting" value={summary?.untouched ?? "–"} sub="no first reply" icon={AlarmClock} tone={summary?.untouched ? "border-blue-200" : ""} onClick={() => setTab("today")}/>
        <Stat label="Follow-ups" value={countToday || (summary ? 0 : "–")} sub={summary?.follow_ups_overdue ? `${summary.follow_ups_overdue} overdue` : "due today"} icon={ListChecks} tone={summary?.follow_ups_overdue ? "border-red-300" : ""} onClick={() => setTab("today")} testId="crm-stat-followups"/>
        <Stat label="Hot leads" value={summary?.hot ?? "–"} icon={Flame} onClick={() => { setTemperature("hot"); setTab("table"); }}/>
        <Stat label="Likely to close" value={summary ? inrShort(summary.weighted_forecast) : "–"} sub={summary ? `${inrShort(summary.pipeline_value)} in play` : ""} icon={TrendingUp} onClick={() => setTab("insights")}/>
        <Stat label="Won this month" value={summary ? inrShort(summary.closed_this_month) : "–"} icon={TrendingUp} onClick={() => setTab("insights")}/>
        <Stat label="First reply" value={summary?.avg_first_response_minutes == null ? "–" : summary.avg_first_response_minutes < 90 ? `${summary.avg_first_response_minutes} m` : `${(summary.avg_first_response_minutes / 60).toFixed(1)} h`} sub="average" icon={AlarmClock} onClick={() => setTab("insights")}/>
        <Stat label="Win rate" value={summary?.win_rate_pct == null ? "–" : `${summary.win_rate_pct}%`} sub={summary ? `${summary.total} leads` : ""} icon={BarChart3} onClick={() => setTab("insights")}/>
      </div>

      {dupes > 0 && <div className="mt-3 text-xs rounded-lg bg-amber-50 text-amber-800 px-3 py-2">{dupes} phone number{dupes > 1 ? "s" : ""} appear on more than one lead. Open a lead, check the number, and merge or delete the extra.</div>}

      {/* AI search */}
      <div className="mt-5 bg-white rounded-2xl p-4 border border-urbanex-navy/10 flex flex-wrap items-center gap-3">
        <Sparkles className="w-5 h-5 text-urbanex-gold"/>
        <input data-testid={ADMIN.semanticInput} value={semantic} onChange={(e) => setSemantic(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSemantic()}
          placeholder="Ask in plain words, e.g. “NRIs looking for a villa” or “people who want a plot near the highway”" className="flex-1 min-w-[260px] bg-transparent outline-none text-sm"/>
        {aiResult && <button type="button" onClick={clearAi} className="text-xs text-gray-500 underline">Clear</button>}
        <button data-testid={ADMIN.semanticRun} onClick={runSemantic} disabled={semanticLoad} className="bg-urbanex-navy text-urbanex-ivory rounded-full px-5 py-2 text-sm disabled:opacity-50">{semanticLoad ? "Searching…" : "Ask CRM"}</button>
      </div>

      {aiInfo && (
        <div className="mt-3 rounded-xl bg-urbanex-gold/10 border border-urbanex-gold/30 px-4 py-3 text-sm" data-testid="ai-filter-info">
          <div className="flex items-start gap-2"><Sparkles className="w-4 h-4 mt-0.5 text-urbanex-gold shrink-0"/><div className="flex-1"><b>{aiInfo.total}</b> match{aiInfo.total === 1 ? "" : "es"}. {aiInfo.explain}{aiInfo.mode === "keywords" && <span className="text-xs text-gray-500"> (simple word match: AI is off or busy)</span>}
            <div className="mt-1.5 flex flex-wrap gap-1.5">{chips.map(c => <span key={c} className="text-[11px] bg-white border rounded-full px-2.5 py-0.5">{c}</span>)}</div></div>
            <button type="button" onClick={clearAi} aria-label="Clear" className="p-1 text-gray-500 hover:text-red-600"><X className="w-4 h-4"/></button></div>
        </div>
      )}

      {/* tabs + filters */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-urbanex-navy/15 overflow-hidden bg-white">
          {tabs.map(([k, label, Icon]) => (
            <button key={k} type="button" onClick={() => setTab(k)} data-testid={`crm-tab-${k}`} className={`px-4 py-2 text-sm inline-flex items-center gap-1.5 ${tab === k ? "bg-urbanex-navy text-urbanex-ivory" : "text-urbanex-navy/70"}`}>
              <Icon className="w-3.5 h-3.5"/>{label}{k === "today" && countToday > 0 && <span className="ml-1 text-[10px] bg-red-500 text-white rounded-full px-1.5">{countToday}</span>}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-urbanex-navy/40"/>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, email" className={`${sel} pl-9 w-64`}/>
        </div>
        <select value={source} onChange={(e) => setSource(e.target.value)} className={sel} data-testid={ADMIN.filterSource} aria-label="Source">
          <option value="">All sources</option>{[...new Set([...SOURCES, ...(summary?.sources || []).map(s => s.source)])].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <select value={temperature} onChange={(e) => setTemperature(e.target.value)} className={sel} aria-label="Temperature">
          <option value="">Any temperature</option><option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={sel} aria-label="Sort">
          <option value="newest">Newest first</option><option value="score">Best score first</option><option value="follow_up">By follow-up date</option><option value="updated">Recently active</option>
        </select>
        <button type="button" onClick={() => setSpam(v => !v)} aria-pressed={spam} data-testid="crm-spam" className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm ${spam ? "bg-red-600 text-white border-red-600" : "bg-white"}`}><ShieldAlert className="w-3.5 h-3.5"/>Spam{summary?.spam_hidden ? ` (${summary.spam_hidden})` : ""}</button>
        <span className="text-xs text-urbanex-navy/50 font-mono ml-auto">{shown.length} leads</span>
      </div>

      {picked.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-urbanex-navy text-urbanex-ivory px-4 py-2.5 text-sm" data-testid="crm-bulk">
          <b>{picked.length} selected</b>
          <select defaultValue="" onChange={(e) => e.target.value && bulk("status", e.target.value)} className="rounded-full bg-white/10 px-3 py-1 text-xs"><option value="" className="text-black">Move to…</option>{STAGES.map(s => <option key={s.v} value={s.v} className="text-black">{s.label}</option>)}</select>
          <select defaultValue="" onChange={(e) => e.target.value && bulk("priority", e.target.value)} className="rounded-full bg-white/10 px-3 py-1 text-xs"><option value="" className="text-black">Set priority…</option><option value="hot" className="text-black">Hot</option><option value="warm" className="text-black">Warm</option><option value="cold" className="text-black">Cold</option></select>
          <button type="button" onClick={() => bulk("follow_up", followUpIn(1))} className="rounded-full bg-white/10 px-3 py-1 text-xs">Follow up tomorrow</button>
          <button type="button" onClick={() => { const t = window.prompt("Tag to add:"); if (t) bulk("tag", t.trim()); }} className="rounded-full bg-white/10 px-3 py-1 text-xs">Add tag</button>
          <button type="button" onClick={() => setPicked([])} className="ml-auto text-xs underline">Clear</button>
        </div>
      )}

      {tab === "today" && (
        <div className="mt-4 space-y-8" data-testid="crm-today">
          <PlanPanel templates={templates} me={me} onOpen={openLead} tick={summary?.total || 0}/>
          {today.map(([title, list, cls]) => list.length > 0 && (
            <section key={title}>
              <h2 className={`text-sm font-semibold mb-2 ${cls}`}>{title} <span className="text-urbanex-navy/40 font-normal">({list.length})</span></h2>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{list.map(l => <LeadCard key={l.id} lead={l} {...cardProps} selected={picked.includes(l.id)} onSelect={pick}/>)}</div>
            </section>
          ))}
          {today.every(([, list]) => !list.length) && <div className="rounded-2xl border bg-white p-14 text-center text-urbanex-navy/50">Nothing urgent right now. New enquiries and follow-ups will show up here.</div>}
        </div>
      )}

      {tab === "board" && <Board leads={shown} onMove={move} {...cardProps} selected={undefined}/>}

      {tab === "table" && (
        <div className="mt-4 bg-white rounded-2xl border border-urbanex-navy/10 overflow-x-auto">
          <table className="w-full text-sm" data-testid={ADMIN.leadsTable}>
            <thead className="bg-urbanex-cream/50 text-left text-xs text-urbanex-navy/60">
              <tr><th className="p-3 w-8"><input type="checkbox" aria-label="Select all" checked={picked.length > 0 && picked.length === shown.length} onChange={(e) => setPicked(e.target.checked ? shown.map(l => l.id) : [])} className="accent-[#C5A059]"/></th>
                <th>Lead</th><th>Reach out</th><th>Interest</th><th>Stage</th><th>Follow-up</th><th className="text-right pr-4">Created</th></tr>
            </thead>
            <tbody>
              {shown.map(l => {
                const st = stageOf(l.status); const t = TEMP[l.temperature] || TEMP.cold; const due = dueLabel(l.next_follow_up);
                return (
                  <tr key={l.id} data-testid={ADMIN.leadRow(l.id)} onClick={() => openLead(l)} className="border-t border-urbanex-navy/5 cursor-pointer hover:bg-urbanex-cream/40">
                    <td className="p-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={picked.includes(l.id)} onChange={() => pick(l.id)} aria-label={`Select ${l.name}`} className="accent-[#C5A059]"/></td>
                    <td className="py-2">
                      <div className="font-medium text-urbanex-navy flex items-center gap-2">{l.name}<span className={`text-[10px] rounded-full px-2 py-0.5 ${t.cls}`}>{t.label} {l.score}</span>
                        {l.flags?.length > 0 && <span title={l.flags.join(", ")} className="text-[10px] bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">flagged</span>}</div>
                      <div className="text-xs text-urbanex-navy/50">{l.phone || l.email || "—"} · {(l.source_page || "").replace("_", " ")}</div>
                    </td>
                    <td><LeadActions lead={l} templates={templates} me={me} onChange={onChange}/></td>
                    <td className="max-w-[220px] truncate text-urbanex-navy/70">{l.property_interest || "—"}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select value={l.status} data-testid={ADMIN.leadStatus(l.id)} onChange={(e) => move(l.id, e.target.value)} className="rounded-full text-xs px-3 py-1.5 border-0" style={{ background: `${st.color}20`, color: st.color }}>
                        {STAGES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="text-xs">{due ? <span className={due.tone === "bad" ? "text-red-600" : due.tone === "warn" ? "text-amber-600" : "text-urbanex-navy/60"}>{due.text}</span> : <span className="text-urbanex-navy/30">—</span>}</td>
                    <td className="text-xs text-urbanex-navy/50 text-right pr-4">{(l.created_at || "").slice(0, 10)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!shown.length && <div className="p-16 text-center text-urbanex-navy/40">No leads found for these filters.</div>}
        </div>
      )}

      {tab === "matches" && <MatchesPanel initial={sp.get("match")} onOpenLead={(id) => setOpenId(id)}/>}
      {tab === "calls" && <CallsPanel onOpenLead={(id) => setOpenId(id)}/>}
      {tab === "insights" && <><Insights summary={summary}/><InsightsExtra/></>}
      {tab === "inbox" && <InboxPanel onOpenLead={(id) => setOpenId(id)}/>}
      {tab === "outbox" && <OutboxPanel onOpenLead={(id) => setOpenId(id)}/>}
      {tab === "auto" && <AutomationPanel/>}

      <LeadSheet lead={open} onClose={closeLead} onChange={onChange} templates={templates} me={me}/>
      <AiAddSheet open={dlg === "ai"} onClose={() => setDlg(null)} onDone={() => { load(); loadSummary(); }}/>
      <AddLeadSheet open={dlg === "add"} onClose={() => setDlg(null)} onCreated={(l) => { setDlg(null); load(); loadSummary(); setOpenId(l.id); }} onOpenExisting={(id) => setOpenId(id)}/>
      <ImportSheet open={dlg === "import"} onClose={() => setDlg(null)} onDone={() => { load(); loadSummary(); }}/>
      <TemplatesSheet open={dlg === "templates"} onClose={() => setDlg(null)} templates={templates} onSaved={setTemplates}/>
    </div>
  );
}
