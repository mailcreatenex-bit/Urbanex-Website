import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquareText, Send, X, MessageCircle, CalendarCheck } from "lucide-react";
import { api } from "@/lib/api";
import { assetUrl, inr } from "@/lib/config";
import { useI18n } from "@/context/I18nContext";
import { useViewer } from "@/context/ViewerContext";

// Replies are rendered as plain text (never HTML) and property cards only ever come from the API's
// own listings, so a manipulated model reply cannot inject links or invent properties.
export default function AssistantWidget() {
  const { t } = useI18n();
  const { unlocked } = useViewer();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);      // {role, content, extra?}
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef(null);

  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, busy, open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = async (raw) => {
    const content = (raw ?? text).trim();
    if (!content || busy) return;
    const history = [...msgs, { role: "user", content }];
    setMsgs(history);
    setText("");
    setBusy(true);
    try {
      const { data } = await api.post("/assistant/chat", {
        messages: history.slice(-10).map(({ role, content: c }) => ({ role, content: c })),
      });
      setMsgs([...history, { role: "assistant", content: data.reply, extra: data }]);
    } catch (e) {
      const m = e?.response?.status === 429 ? "Too many messages, please wait a minute." : t("assist.error");
      setMsgs([...history, { role: "assistant", content: m }]);
    } finally { setBusy(false); }
  };

  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} aria-label={t("assist.open")} data-testid="assistant-open"
          className="fixed bottom-6 left-6 z-40 flex items-center gap-2 bg-urbanex-navy text-urbanex-ivory rounded-full pl-4 pr-5 py-3 shadow-xl hover:scale-105 transition-transform">
          <MessageSquareText className="w-5 h-5 text-urbanex-gold"/> <span className="text-sm hidden sm:inline">{t("assist.title")}</span>
        </button>
      )}
      {open && (
        <section role="dialog" aria-label={t("assist.title")} data-testid="assistant-panel"
          className="fixed z-50 bottom-0 left-0 right-0 sm:bottom-6 sm:left-6 sm:right-auto sm:w-[380px] h-[75vh] sm:h-[560px] max-h-[100vh] bg-white sm:rounded-2xl shadow-2xl border border-urbanex-navy/10 flex flex-col overflow-hidden">
          <header className="bg-urbanex-navy text-urbanex-ivory px-4 py-3 flex items-center justify-between">
            <div className="font-display text-lg">{t("assist.title")}</div>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("assist.close")} className="p-1 hover:text-urbanex-gold"><X className="w-5 h-5"/></button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 text-sm" aria-live="polite">
            <div className="bg-urbanex-cream rounded-2xl rounded-tl-sm px-4 py-3 text-urbanex-navy/85">{t("assist.welcome")}</div>
            {msgs.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {["assist.s1", "assist.s2", "assist.s3"].map(k => (
                  <button key={k} type="button" onClick={() => send(t(k))} className="text-xs border border-urbanex-navy/15 hover:border-urbanex-gold rounded-full px-3 py-1.5">{t(k)}</button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => m.role === "user" ? (
              <div key={i} className="ml-auto max-w-[85%] bg-urbanex-navy text-urbanex-ivory rounded-2xl rounded-tr-sm px-4 py-2.5 whitespace-pre-line">{m.content}</div>
            ) : (
              <div key={i} className="max-w-[92%] space-y-2">
                <div className="bg-urbanex-cream rounded-2xl rounded-tl-sm px-4 py-3 text-urbanex-navy/90 whitespace-pre-line" data-testid="assistant-reply">{m.content}</div>
                {(m.extra?.properties || []).map(p => (
                  <Link key={p.id} to={`/properties/${p.slug}`} onClick={() => setOpen(false)} className="flex gap-3 items-center border border-urbanex-navy/10 hover:border-urbanex-gold rounded-xl p-2">
                    <img src={assetUrl(p.image)} alt="" loading="lazy" className="w-16 h-12 object-cover rounded-lg"/>
                    <div className="min-w-0">
                      <div className="font-medium text-urbanex-navy truncate">{p.title}</div>
                      <div className="text-xs text-urbanex-navy/60">{p.zone}{p.bedrooms ? ` · ${p.bedrooms} BHK` : ""} · {p.area_sqft} sqft{unlocked("property", p.id)?.price_inr ? ` · ${inr(unlocked("property", p.id).price_inr)}` : ""}</div>
                    </div>
                  </Link>
                ))}
                {m.extra?.action === "book_visit" && m.extra.properties?.[0] && (
                  <Link to={`/properties/${m.extra.properties[0].slug}#book-visit`} onClick={() => setOpen(false)} className="inline-flex items-center gap-2 text-xs bg-urbanex-gold text-urbanex-navy rounded-full px-4 py-2"><CalendarCheck className="w-3.5 h-3.5"/> {t("assist.book")}</Link>
                )}
                {m.extra?.handoff_url && (
                  <a href={m.extra.handoff_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs bg-[#25D366] text-white rounded-full px-4 py-2"><MessageCircle className="w-3.5 h-3.5"/> {t("assist.handoff")}</a>
                )}
                {m.extra && m.extra.ai === false && <div className="text-[10px] text-urbanex-navy/40">{t("assist.keyword")}</div>}
              </div>
            ))}
            {busy && <div className="text-xs text-urbanex-navy/50">{t("assist.thinking")}</div>}
            <div ref={end}/>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t border-urbanex-navy/10 p-3">
            <div className="flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={t("assist.placeholder")} aria-label={t("assist.placeholder")}
                data-testid="assistant-input" className="flex-1 min-w-0 border border-urbanex-navy/15 rounded-full px-4 py-2 text-sm"/>
              <button type="submit" disabled={busy || !text.trim()} aria-label={t("assist.send")} data-testid="assistant-send"
                className="w-10 h-10 rounded-full bg-urbanex-navy text-urbanex-ivory flex items-center justify-center disabled:opacity-40"><Send className="w-4 h-4"/></button>
            </div>
            <p className="mt-2 text-[10px] text-urbanex-navy/45 leading-snug">{t("assist.disclaimer")}</p>
          </form>
        </section>
      )}
    </>
  );
}
