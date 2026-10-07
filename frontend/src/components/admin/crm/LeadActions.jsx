import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { api } from "@/lib/api";
import { fillTemplate, telLink, waLink } from "@/lib/crm";

// Call / WhatsApp / e-mail buttons. Every tap is written to the lead's timeline, moves a new lead to "Contacted"
// and (for a call nobody answered) sets a follow-up for tomorrow.
export default function LeadActions({ lead, templates, me, onChange, size = "sm" }) {
  const [menu, setMenu] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setMenu(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const log = async (body) => {
    try { const { data } = await api.post(`/admin/leads/${lead.id}/activity`, body); onChange?.(data); return data; }
    catch { toast.error("Could not log it"); return null; }
  };

  const call = async (e) => {
    e.stopPropagation();
    const data = await log({ type: "call" });
    if (!data) return;
    toast("Call logged", {
      description: "How did it go?",
      duration: 12000,
      action: { label: "No answer", onClick: () => log({ type: "call", outcome: "no_answer", text: "No answer, will try again tomorrow" }) },
      cancel: { label: "Spoke", onClick: () => log({ type: "call", outcome: "answered" }) },
    });
  };

  const whatsapp = async (tpl, lang) => {
    setMenu(false);
    const text = tpl ? fillTemplate(tpl[lang] || tpl.en, lead, me) : "";
    window.open(waLink(lead.phone, text), "_blank", "noopener");
    await log({ type: "whatsapp", text: tpl ? `Sent “${tpl.label}” (${lang === "bn" ? "Bengali" : "English"})` : "Opened chat" });
  };

  const pad = size === "lg" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs";
  if (!lead.phone && !lead.email) return null;
  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {lead.phone && (
        <a href={telLink(lead.phone)} onClick={call} data-testid={`crm-call-${lead.id}`} className={`inline-flex items-center gap-1.5 rounded-full bg-urbanex-navy text-urbanex-ivory ${pad}`}>
          <Phone className="w-3.5 h-3.5"/> Call
        </a>
      )}
      {lead.phone && (
        <div className="relative" ref={box}>
          <button type="button" onClick={() => setMenu(m => !m)} data-testid={`crm-wa-${lead.id}`} className={`inline-flex items-center gap-1.5 rounded-full bg-[#25D366] text-white ${pad}`}>
            <MessageCircle className="w-3.5 h-3.5"/> WhatsApp
          </button>
          {menu && (
            <div className="absolute z-30 left-0 mt-1 w-72 max-h-80 overflow-y-auto rounded-xl border bg-white shadow-xl p-1 text-sm text-left">
              <button type="button" onClick={() => whatsapp(null)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50">Open chat (blank)</button>
              {(templates || []).map(t => (
                <div key={t.id} className="px-3 py-2 rounded-lg hover:bg-gray-50">
                  <div className="font-medium text-urbanex-navy">{t.label}</div>
                  <div className="mt-1 flex gap-2">
                    {t.en && <button type="button" onClick={() => whatsapp(t, "en")} className={`text-xs rounded-full border px-2.5 py-0.5 hover:border-[#25D366] ${lead?.language !== "bn" ? "border-[#25D366]" : ""}`}>English</button>}
                    {t.bn && <button type="button" onClick={() => whatsapp(t, "bn")} className={`text-xs rounded-full border px-2.5 py-0.5 hover:border-[#25D366] ${lead?.language === "bn" ? "border-[#25D366]" : ""}`}>বাংলা</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {lead.email && (
        <a href={`mailto:${lead.email}`} onClick={() => log({ type: "email" })} className={`inline-flex items-center gap-1.5 rounded-full border ${pad}`} aria-label="E-mail">
          <Mail className="w-3.5 h-3.5"/>
        </a>
      )}
    </div>
  );
}
