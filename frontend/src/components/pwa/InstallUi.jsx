import { useEffect, useState } from "react";
import { Bell, BellOff, Download, Share, SquarePlus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePwa, isIOS } from "@/context/PwaContext";
import { useI18n } from "@/context/I18nContext";

const DISMISS_KEY = "urbanex_install_dismissed";
const dismissedRecently = () => {
  try { return Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < 14 * 86400000; } catch { return false; }
};

// "Install the app" pop-up. It slides in after the visitor has used the site for a little while (about 12 seconds),
// once per visit, and stays away for a week if dismissed. Where the browser has a one-tap prompt the button uses it;
// elsewhere (iPhone, Firefox, desktop Safari) the button shows the manual steps. Never shown inside the installed app.
const SHOWN_KEY = "urbanex_install_shown";
const SHOW_AFTER_MS = 12000;
export function InstallPill() {
  const { installed, canPrompt, install } = usePwa();
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const [gone, setGone] = useState(dismissedRecently);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(SHOWN_KEY) === "1"; } catch { /* ignore */ }
    if (installed || gone || seen) return undefined;
    const timer = setTimeout(() => {
      if (document.hidden) return;                       // not while the tab is in the background
      try { sessionStorage.setItem(SHOWN_KEY, "1"); } catch { /* ignore */ }
      setReady(true);
    }, SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [installed, gone]);

  if (installed || gone || !ready) return null;
  const dismiss = () => { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ } setGone(true); };
  const go = async () => { const r = await install(); if (r === "accepted") setGone(true); };

  return (
    <div role="dialog" aria-label={t("pwa.installTitle")} data-testid="install-pill"
      className="fixed z-[55] inset-x-3 bottom-3 sm:inset-x-auto sm:right-6 sm:bottom-24 sm:w-[400px] animate-in slide-in-from-bottom-8 fade-in duration-700">
      <div className="glass-dark rounded-3xl p-5 text-urbanex-ivory bg-[#0a1226]/95 relative overflow-hidden">
        <button type="button" onClick={dismiss} aria-label={t("common.close")} className="absolute top-3 right-3 p-1.5 rounded-full text-urbanex-ivory/60 hover:text-urbanex-ivory hover:bg-white/10"><X className="w-4 h-4"/></button>
        <div className="flex items-center gap-4">
          <span className="grid place-items-center h-16 w-16 shrink-0 rounded-2xl bg-white shadow-[0_0_0_3px_rgba(197,160,89,.45)] overflow-hidden"><img src="/icons/icon-192.png" alt="" width="64" height="64" className="h-full w-full object-contain p-1"/></span>
          <div className="min-w-0 pr-6">
            <div className="font-display text-2xl leading-tight">{t("pwa.installTitle")}</div>
            <div className="text-xs text-urbanex-ivory/60 mt-0.5">{t("pwa.installBody")}</div>
          </div>
        </div>
        <ul className="mt-4 space-y-1.5 text-sm text-urbanex-ivory/80">
          {["pwa.b1", "pwa.b2", "pwa.b3"].map(k => <li key={k} className="flex gap-2"><span className="text-urbanex-gold">✦</span>{t(k)}</li>)}
        </ul>
        <div className="mt-5 flex items-center gap-2">
          <button type="button" onClick={go} data-testid="install-pill-btn" className="btn-shine flex-1 inline-flex items-center justify-center gap-2 bg-urbanex-gold hover:bg-urbanex-goldHover text-urbanex-navy rounded-full px-5 py-3 text-sm font-medium">
            <Download className="w-4 h-4"/> {canPrompt ? t("pwa.install") : t("pwa.howTo")}
          </button>
          <button type="button" onClick={dismiss} data-testid="install-pill-later" className="rounded-full border border-white/20 px-5 py-3 text-sm text-urbanex-ivory/80 hover:border-urbanex-gold">{t("pwa.later")}</button>
        </div>
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
