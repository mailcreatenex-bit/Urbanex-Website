// Reads a .txt file (a WhatsApp chat export or plain notes) and finds the people in it: a name, an Indian mobile number and what was said.
// This part is plain code, so it is instant and nothing leaves the browser; the AI (optional) then fills in budget, BHK, area and follow-ups.

const HEADERS = [
  /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+\d{1,2}:\d{2}(?::\d{2})?\s?(?:[AaPp][Mm])?\s+-\s+([^:]+?):\s?(.*)$/,        // 28/08/2025, 11:54 - Name: text   (Android)
  /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+[^\]]+\]\s+([^:]+?):\s?(.*)$/,                                              // [28/08/2025, 11:54:10] Name: text (iPhone)
];
const ANY_STAMP = /^(?:\[)?\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}/;
const PHONE = /(\+?91[\s-]?)?([6-9]\d{4}[\s-]?\d{5})(?!\d)/g;
const BUY = /asbe|asben|asche|dekhbe|dekhte|dekhben|nebe|nite|lagbe|chay|chai|kinte|kinbe|kinben|interested|jabo|jete|visit|budget|looking|need|require|चाहिए|চাই|দেখ/i;
const SELL = /\b(ache|achhe|achey|bikri|bechbe|bechte|becbe|sell|selling|for sale)\b/i;

const tidy = (s) => (s || "").replace(/<This message was edited>/gi, "").replace(/[*_~]/g, "").replace(/^[\s\-–:,.]+|[\s\-–:,.]+$/g, "").replace(/\s+/g, " ");

// every phone number in a piece of text, with where it starts and ends (a number glued to a digit on either side is ignored)
function phonesIn(line) {
  const out = [];
  for (const m of line.matchAll(PHONE)) {
    const start = m.index;
    if (start > 0 && /\d/.test(line[start - 1])) continue;
    out.push({ digits: m[2].replace(/\D/g, ""), start, end: start + m[0].length });
  }
  return out;
}

function messagesOf(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  const msgs = [];
  let cur = null;
  for (const line of lines) {
    let m = null;
    for (const h of HEADERS) { m = line.match(h); if (m) break; }
    if (m) {
      const [, d, mo, y] = m;
      const sender = m[4];
      cur = { date: `${y.length === 2 ? "20" + y : y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`, sender: sender.trim(), lines: [m[5]] };
      msgs.push(cur);
    } else if (ANY_STAMP.test(line)) {
      cur = null;                                       // a system line such as "Messages are end-to-end encrypted"
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  return msgs;
}

// Plain notes: blocks separated by blank lines, a line or two around each number
function blocksOf(text) {
  return text.replace(/\r/g, "").split(/\n\s*\n/).map(b => ({ date: "", sender: "", lines: b.split("\n") })).filter(b => b.lines.some(l => l.trim()));
}

const prettyDate = (iso) => { try { return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); } catch { return iso; } };

export function parseTextFile(text) {
  const stamped = messagesOf(text);
  const chat = stamped.length >= 3;
  const items = chat ? stamped : blocksOf(text);
  const people = new Map();
  let withoutNumber = 0;
  for (const m of items) {
    const lines = m.lines.map(l => tidy(l)).filter(l => l && !/<Media omitted>|\(file attached\)|^null$/i.test(l));
    const idx = lines.findIndex(l => phonesIn(l).length);
    if (idx < 0) { withoutNumber++; continue; }
    const found = phonesIn(lines[idx]);
    const first = found[0];
    const before = tidy(lines[idx].slice(0, first.start));
    const after = tidy(lines[idx].slice(first.end));
    let name = before;
    let pre = [];
    if (!name && idx > 0) { name = tidy(lines[idx - 1]); pre = lines.slice(0, idx - 1); }
    else if (idx > 0) pre = lines.slice(0, idx);
    const rest = [];
    if (after) rest.push(after);
    for (const l of lines.slice(idx + 1)) {
      if (/^\+?\d[\d\s-]{8,}$/.test(l)) continue;      // another bare number on its own line
      rest.push(l);
    }
    const others = new Set(lines.flatMap(l => phonesIn(l).map(p => p.digits)));
    others.delete(first.digits);
    let note = [...pre, ...rest].filter(Boolean).join(" ");
    if (!name || name.length > 60 || (BUY.test(name) && name.split(" ").length > 4)) { note = [name, note].filter(Boolean).join(" "); name = ""; }
    if (others.size) note += ` (other numbers: ${[...others].map(d => "+91" + d).join(", ")})`;
    const seller = SELL.test(`${name} ${note}`) && !BUY.test(note);
    const e = people.get(first.digits) || { phone: "+91" + first.digits, names: [], notes: [], sellers: 0, hits: 0, first: m.date, last: m.date, who: new Set() };
    if (name && !e.names.includes(name)) e.names.push(name);
    const dated = (m.date ? `${prettyDate(m.date)}: ` : "") + note;
    if (note && !e.notes.some(n => n.text === note)) e.notes.push({ text: note, line: dated });
    e.sellers += seller ? 1 : 0; e.hits += 1; e.last = m.date || e.last;
    if (m.sender) e.who.add(m.sender);
    people.set(first.digits, e);
  }
  const list = [...people.values()].map(e => {
    const name = e.names.length ? e.names[e.names.length - 1] : "";
    const seller = e.sellers > 0 && e.sellers === e.hits;
    const lastNote = e.notes.length ? e.notes[e.notes.length - 1].text : "";
    return {
      name, phone: e.phone, role: seller ? "seller" : null,
      summary: ((seller ? "Owner/seller: " : "") + lastNote).slice(0, 300),
      notes: ("From the file" + (e.who.size ? `, shared by ${[...e.who].join(", ")}` : "") + (e.first ? ` (${prettyDate(e.first)}${e.last !== e.first ? " to " + prettyDate(e.last) : ""})` : "") + ". " + e.notes.map(n => n.line).join(" | ")).slice(0, 600),
      raw: e.notes.map(n => n.line).join(" | ").slice(0, 400),
    };
  });
  return { people: list, messages: items.length, withoutNumber, format: chat ? "WhatsApp chat" : "notes" };
}

// what the AI reads for a group of people: one short line each, so a few dozen fit in one request
export const aiLine = (p) => `${p.name || "(no name)"} | ${p.phone} | ${p.raw || p.summary}`.slice(0, 380);

export function chunkPeople(people, per = 25, maxChars = 7200) {
  const out = [];
  let cur = [], len = 0;
  for (const p of people) {
    const l = aiLine(p).length + 1;
    if (cur.length >= per || len + l > maxChars) { out.push(cur); cur = []; len = 0; }
    cur.push(p); len += l;
  }
  if (cur.length) out.push(cur);
  return out;
}

// a draft that needs no AI
export const plainDraft = (p) => ({ name: p.name || null, phone: p.phone, email: null, role: p.role, wants: {}, summary: p.summary, notes: p.notes, follow_up_date: null, follow_up_note: null, status_hint: null });
