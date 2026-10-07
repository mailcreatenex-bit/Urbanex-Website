import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";   // empty = same site: the host forwards /api to the server (see netlify.toml)
export const API_BASE = `${BACKEND_URL}/api`;

// A random id kept in this browser. It lets the server notice one device submitting many different
// phone numbers (it flags the lead for Ayan; it never blocks ordinary use).
function deviceId() {
  try {
    let id = localStorage.getItem("urbanex_device");
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "");
      localStorage.setItem("urbanex_device", id);
    }
    return id.length >= 16 ? id.slice(0, 64) : id.padEnd(16, "0");
  } catch {
    return null; // storage blocked
  }
}

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((cfg) => {
  const id = deviceId();
  if (id) cfg.headers["X-Device-Id"] = id;
  try { const ref = localStorage.getItem("urbanex_ref"); if (ref) cfg.headers["X-Referral"] = ref; } catch { /* storage blocked */ }
  return cfg;
});
