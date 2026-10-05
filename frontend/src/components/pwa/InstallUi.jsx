import { useEffect, useState } from "react";
import { Bell, BellOff, Download, Share, SquarePlus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePwa, isIOS } from "@/context/PwaContext";
import { useI18n } from "@/context/I18nContext";

const DISMISS_KEY = "urbanex_install_dismissed";
const dismissedRecently = () => {
  try { return Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < 14 * 86400000; } catch { return false; }
};

// Floating "Install app" pill. It appears a few seconds after the page opens, once the visitor has scrolled a bit,
// and stays away for 2 weeks if dismissed. Only shown where installing is actually possible.
export function InstallPill() {
  const { installed, canPrompt, install } = usePwa();
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const [gone, setGone] = useState(dismissedRecently);

  useEffect(() => {
    if (installed || gone) return undefined;
    let timeOk = false, scrolled = false;
    const check = () => { if (timeOk && scrolled) setReady(true); };
    const timer = setTimeout(() => { timeOk = true; check(); }, 6000);
    const onScroll = () => { if (window.scrollY > 450) { scrolled = true; check(); } };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { clearTimeout(timer); window.removeEventListener("scroll", onScroll); };
  }, [installed, gone]);

  // browsers without a prompt (except iPhone, where the manual steps help) just get the footer link
  if (installed || gone || !ready || !(canPrompt || isIOS())) return null;
  const dismiss = () => { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ } setGone(true); };

  return (
    <div role="dialog" aria-label={t("pwa.installTitle")} data-testid="install-pill"
      className="fixed z-40 bottom-24 left-1/2 -translate-x-1/2 w-[min(92vw,420px)] animate-in slide-in-from-bottom-6 fade-in duration-500">
      <div className="flex items-center gap-3 bg-urbanex-navy text-urbanex-ivory rounded-2xl pl-3 pr-2 py-3 shadow-2xl border border-white/10">
        <img src="/icons/icon-192.png" alt="" width="44" height="44" className="w-11 h-11 rounded-xl bg-white p-1 shrink-0"/>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-tight">{t("pwa.installTitle")}</div>
          <div className="text-xs text-urbanex-ivory/60 leading-snug">{t("pwa.installBody")}</div>
        </div>
        <button type="button" onClick={install} data-testid="install-pill-btn"
          className="shrink-0 inline-flex items-center gap-1.5 bg-urbanex-gold hover:bg-urbanex-goldHover text-urbanex-navy rounded-full px-4 py-2 text-sm font-medium">
          <Download className="w-4 h-4"/> {t("pwa.install")}
        </button>
        <button type="button" onClick={dismiss} aria-label={t("common.close")} className="p-2 text-urbanex-ivory/50 hover:text-urbanex-ivory shrink-0"><X className="w-4 h-4"/></button>
      </div>
    </div>
  );
}

// Manual steps for iPhone Safari and browsers that never show the install prompt
export function InstallHelp() {
  const { helpOpen, closeHelp } = usePwa();
  const { t } = useI18n();
  const ios = isIOS();
  return (
    <Dialog open={helpOpen} onOpenChange={(o) => !o && closeHelp()}>
      <DialogContent className="sm:max-w-md bg-urbanex-ivory" data-testid="install-help">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl text-urbanex-navy">{t("pwa.installTitle")}</DialogTitle>
          <DialogDescription className="text-urbanex-navy/65">{ios ? t("pwa.iosIntro") : t("pwa.manualIntro")}</DialogDescription>
        </DialogHeader>
        {ios ? (
          <ol className="space-y-4 text-sm text-urbanex-navy">
            <li className="flex gap-3 items-center"><span className="w-9 h-9 rounded-full bg-urbanex-gold/20 flex items-center justify-center shrink-0"><Share className="w-4 h-4"/></span>{t("pwa.iosStep1")}</li>
            <li className="flex gap-3 items-center"><span className="w-9 h-9 rounded-full bg-urbanex-gold/20 flex items-center justify-center shrink-0"><SquarePlus className="w-4 h-4"/></span>{t("pwa.iosStep2")}</li>
          </ol>
        ) : (
          <p className="text-sm text-urbanex-navy/80 leading-relaxed">{t("pwa.manualSteps")}</p>
        )}
        <button type="button" onClick={closeHelp} className="mt-2 bg-urbanex-navy text-urbanex-ivory rounded-full px-8 py-2.5 text-sm self-center">{t("common.close")}</button>
      </DialogContent>
    </Dialog>
  );
}

// Footer buttons: install the app, and turn alerts on/off
export function FooterPwa() {
  const { installed, install, push, enablePush, disablePush } = usePwa();
  const { t } = useI18n();
  const btn = "inline-flex items-center gap-2 text-xs rounded-full border border-white/20 hover:border-urbanex-gold hover:text-urbanex-gold text-urbanex-ivory/80 px-4 py-2 transition-colors disabled:opacity-50";
  return (
    <div className="mt-5 flex flex-wrap gap-2" data-testid="footer-pwa">
      {!installed && <button type="button" onClick={install} className={btn} data-testid="footer-install"><Download className="w-3.5 h-3.5"/> {t("pwa.installApp")}</button>}
      {push.subscribed
        ? <button type="button" onClick={disablePush} disabled={push.busy} className={btn} data-testid="footer-alerts-off"><BellOff className="w-3.5 h-3.5"/> {t("pwa.alertsTurnOff")}</button>
        : <button type="button" onClick={enablePush} disabled={push.busy} className={btn} data-testid="footer-alerts"><Bell className="w-3.5 h-3.5"/> {t("pwa.alertsTurnOn")}</button>}
    </div>
  );
}
