import { useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import Turnstile, { TURNSTILE_ENABLED } from "@/components/common/Turnstile";
import { checkPhone, apiError } from "@/lib/phone";

// dark: for the navy footer. Subscribing as the signed-in Google address confirms immediately;
// anyone else gets a confirmation email first (double opt-in).
export default function DigestSignup({ dark = false }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [wa, setWa] = useState(false);
  const [phone, setPhone] = useState("");
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ts, setTs] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    let phoneValue = null;
    if (wa) {
      const ph = checkPhone(phone);
      if (!ph.ok) { toast.error(ph.error); return; }
      phoneValue = ph.value;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/digest/subscribe", {
        email: email || user?.email, name: name || null, phone: phoneValue, whatsapp: wa, zones: [], turnstile_token: ts || undefined,
      });
      setState(data.status);
    } catch (err) {
      toast.error(err?.response?.status === 429 ? "Too many tries, please wait a minute." : apiError(err, "Please check your email address."));
    } finally { setBusy(false); setTs(""); }
  };

  const box = dark ? "bg-white/10 border-white/15 text-urbanex-ivory placeholder:text-urbanex-ivory/40" : "bg-white border-urbanex-navy/15 text-urbanex-navy";
  const muted = dark ? "text-urbanex-ivory/60" : "text-urbanex-navy/55";
  if (state) return <div className={`text-sm ${dark ? "text-urbanex-ivory" : "text-urbanex-navy"}`} data-testid="digest-done">{state === "confirmed" ? t("digest.done") : t("digest.pending")}</div>;

  return (
    <form onSubmit={submit} className="space-y-3 max-w-md" data-testid="digest-form">
      <div className={`flex items-center gap-2 font-display text-xl ${dark ? "text-urbanex-ivory" : "text-urbanex-navy"}`}><Mail className="w-4 h-4 text-urbanex-gold"/> {t("digest.title")}</div>
      <p className={`text-xs leading-relaxed ${muted}`}>{t("digest.body")}</p>
      <div className="flex gap-2">
        <input type="email" required aria-label={t("digest.email")} placeholder={t("digest.email")} value={email || user?.email || ""} onChange={(e) => setEmail(e.target.value)}
          className={`flex-1 min-w-0 border rounded-full px-4 py-2 text-sm ${box}`} maxLength={200} data-testid="digest-email"/>
        <button disabled={busy || (TURNSTILE_ENABLED && !ts)} className="bg-urbanex-gold hover:bg-urbanex-goldHover text-urbanex-navy px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50" data-testid="digest-submit">{t("digest.submit")}</button>
      </div>
      <input aria-label={t("digest.name")} placeholder={t("digest.name")} value={name} onChange={(e) => setName(e.target.value)} className={`w-full border rounded-full px-4 py-2 text-sm ${box}`} maxLength={120}/>
      <label className={`flex items-center gap-2 text-xs ${muted}`}><input type="checkbox" checked={wa} onChange={(e) => setWa(e.target.checked)} className="accent-[#C5A059]"/> {t("digest.whatsapp")}</label>
      {wa && <input required aria-label={t("digest.phone")} placeholder={t("digest.phone")} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" pattern="[0-9+()\-\s]{6,20}" className={`w-full border rounded-full px-4 py-2 text-sm ${box}`}/>}
      <Turnstile value={ts} onChange={setTs}/>
      <p className={`text-[11px] ${muted}`}>{t("digest.consent")}</p>
    </form>
  );
}
