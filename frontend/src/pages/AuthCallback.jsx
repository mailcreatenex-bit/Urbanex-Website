import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallback() {
  const location = useLocation();
  const nav = useNavigate();
  const { refresh } = useAuth();
  const processed = useRef(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = location.hash || window.location.hash;
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const session_id = params.get("session_id");
    if (!session_id) { nav("/"); return; }

    (async () => {
      try {
        await api.post("/auth/session", { session_id });
        await refresh();
        // Strip fragment
        window.history.replaceState(null, "", window.location.pathname);
        let back = "/";
        try { if (sessionStorage.getItem("urbanex_app_login") === "1") back = "/app-login"; } catch { /* ignore */ }   // a sign-in started from the phone app returns there
        nav(back);
      } catch (e) {
        setErr(e?.response?.data?.detail || "Sign-in failed");
      }
    })();
  }, [location, nav, refresh]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-urbanex-ivory">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-2 border-urbanex-gold border-t-transparent animate-spin mx-auto"/>
        <div className="mt-6 font-display text-2xl text-urbanex-navy">Verifying your Google account…</div>
        {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
      </div>
    </div>
  );
}
