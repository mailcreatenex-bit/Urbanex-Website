import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";

// Install-as-app and Web Push state. The browser only offers a one-tap install prompt after the app is eligible
// (Chrome/Edge/Android: "beforeinstallprompt"); Safari on iPhone has no prompt, so we show the manual steps instead.
const Ctx = createContext(null);

const standalone = () => {
  try { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; } catch { return false; }
};
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function keyToBytes(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PwaProvider({ children }) {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(standalone());
  const [helpOpen, setHelpOpen] = useState(false);
  const [perm, setPerm] = useState(() => (pushSupported() ? Notification.permission : "unsupported"));
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const before = (e) => { e.preventDefault(); setDeferred(e); };
    const done = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", before); window.removeEventListener("appinstalled", done); };
  }, []);

  // is this browser already subscribed?
  useEffect(() => {
    if (!pushSupported()) return;
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = reg && (await reg.pushManager.getSubscription());
      setSubscribed(!!sub && Notification.permission === "granted");
    }).catch(() => {});
  }, []);

  const install = useCallback(async () => {
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      if (outcome === "accepted") setInstalled(true);
      return outcome;
    }
    setHelpOpen(true);   // iPhone Safari / browsers without a prompt: show the manual steps
    return "manual";
  }, [deferred]);

  const enablePush = useCallback(async () => {
    if (!pushSupported()) { toast.info(isIOS() ? t("pwa.iosPush") : t("pwa.noPush")); return false; }
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) { toast.info(t("pwa.noWorker")); return false; }
      const permission = await Notification.requestPermission();
      setPerm(permission);
      if (permission !== "granted") { toast.error(t("pwa.blocked")); return false; }
      const { data } = await api.get("/push/key");
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(data.public_key) }));
      await api.post("/push/subscribe", { subscription: sub.toJSON() });
      setSubscribed(true);
      toast.success(t("pwa.alertsOn"));
      return true;
    } catch (e) {
      toast.error(t("pwa.pushFailed"));
      return false;
    } finally { setBusy(false); }
  }, [t]);

  const disablePush = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && (await reg.pushManager.getSubscription());
      if (sub) { await api.post("/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
      setSubscribed(false);
      toast.success(t("pwa.alertsOff"));
    } finally { setBusy(false); }
  }, [t]);

  const value = useMemo(() => ({
    installed, canPrompt: !!deferred, install, helpOpen, closeHelp: () => setHelpOpen(false),
    push: { supported: pushSupported(), perm, subscribed, busy }, enablePush, disablePush,
  }), [installed, deferred, install, helpOpen, perm, subscribed, busy, enablePush, disablePush]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const usePwa = () => useContext(Ctx);
