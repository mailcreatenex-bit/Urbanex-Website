// Where is the site running? Some tools (like searching the official land records) can only work inside the Urbanex app,
// because a website is not allowed to open the government portal inside its own page.
export const ANDROID_APP_URL = process.env.REACT_APP_ANDROID_APP_URL || "";   // Play Store (or APK) link, once the app exists

export function isNativeApp() {
  try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch { return false; }
}

export function isInstalledPwa() {
  try { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; } catch { return false; }
}

// true inside the store app or the installed web app: the visitor is "in the app"
export const inAppShell = () => isNativeApp() || isInstalledPwa();
