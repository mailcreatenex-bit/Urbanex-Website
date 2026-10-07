import PrivacyConsent from "@/components/common/PrivacyConsent";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useViewer } from "@/context/ViewerContext";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { inr } from "@/lib/config";
import Turnstile, { TURNSTILE_ENABLED } from "@/components/common/Turnstile";
import { checkPhone, apiError } from "@/lib/phone";

// The name + phone pop-up. Submitting it records the person's interest in this listing (visible to Ayan
// in the CRM) and reveals its price. Phone numbers are not verified.
export default function InterestModal() {
  const { modal, closeModal, submitForm } = useViewer();
  const { user, setLoginOpen } = useAuth();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [ts, setTs] = useState("");

  useEffect(() => {
    if (modal) { setName(user?.name || ""); setPhone(""); setError(""); setResult(null); setTs(""); }
  }, [modal, user?.name]);

  const submit = async (e) => {
    e.preventDefault();
    const ph = checkPhone(phone);
    if (!ph.ok) { setError(ph.error); return; }
    setBusy(true); setError("");
    try { setResult(await submitForm({ name: name.trim(), phone: ph.value, turnstile_token: ts || undefined })); }
    catch (err) {
      setError(err?.response?.status === 429 ? t("interest.rate") : apiError(err, t("interest.invalid")));
    } finally { setBusy(false); setTs(""); }
  };

  const inp = "w-full border border-urbanex-navy/15 rounded-lg px-3 py-2.5 text-sm bg-white";
  const price = result?.price?.price_inr;
  return (
    <Dialog open={!!modal} onOpenChange={(o) => !o && closeModal()}>
      <DialogContent className="sm:max-w-md bg-urbanex-ivory" data-testid="interest-modal">
        {!result ? (
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-display text-3xl text-urbanex-navy">{t("interest.title")}</DialogTitle>
              <DialogDescription className="text-urbanex-navy/65">{modal?.title ? `${modal.title} — ` : ""}{t("interest.body")}</DialogDescription>
            </DialogHeader>
            <input required autoFocus className={inp} placeholder={t("interest.name")} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} data-testid="interest-name" autoComplete="name"/>
            <input required className={inp} placeholder={t("interest.phone")} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" pattern="[0-9+()\-\s]{6,20}" data-testid="interest-phone" autoComplete="tel"/>
            {error && <div className="text-sm text-red-600" role="alert">{error}</div>}
            <Turnstile value={ts} onChange={setTs}/>
            <PrivacyConsent tone="light"/>
      <button disabled={busy || (TURNSTILE_ENABLED && !ts)} data-testid="interest-submit" className="w-full bg-urbanex-gold hover:bg-urbanex-goldHover text-urbanex-navy py-3 rounded-full text-sm font-medium disabled:opacity-50">
              {busy ? t("common.loading") : t("interest.submit")}
            </button>
            <p className="text-[11px] text-urbanex-navy/50 leading-snug">
              {t("interest.owner")}
            </p>
          </form>
        ) : (
          <div className="space-y-4 text-center py-2" data-testid="interest-done">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto"/>
            <DialogHeader>
              <DialogTitle className="font-display text-3xl text-urbanex-navy text-center">{price ? inr(price) : t("interest.onRequestShort")}</DialogTitle>
              <DialogDescription className="text-center text-urbanex-navy/65">{price ? t("interest.thanks") : t("interest.onRequest")}</DialogDescription>
            </DialogHeader>
            {!user && (
              <button type="button" onClick={() => { closeModal(); setLoginOpen(true); }} className="text-sm text-urbanex-navy underline decoration-urbanex-gold underline-offset-4">
                {t("interest.signinTip")}
              </button>
            )}
            <button type="button" onClick={closeModal} className="block mx-auto bg-urbanex-navy text-urbanex-ivory px-8 py-2.5 rounded-full text-sm">{t("common.close")}</button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
