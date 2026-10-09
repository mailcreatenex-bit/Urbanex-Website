import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useSeo } from "@/lib/seo";

const FLAG = "urbanex_app_login";

// The phone app sends people here to sign in with Google in their normal browser. Once signed in, a one-time token is handed back
// to the app through a link that opens it (Google does not allow sign-in inside an app's own browser).
export default function AppLoginPage() {
  useSeo({ title: "Sign in to the Urbanex app" });
  const { user, loading, setLoginOpen } = useAuth();
  const [link, setLink] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) { try { sessionStorage.setItem(FLAG, "1"); } catch { /* ignore */ } setLoginOpen(true); return; }
    try { sessionStorage.removeItem(FLAG); } catch { /* ignore */ }
    api.post("/auth/app-token").then(r => {
      const url = `urbanexrecorder://login?token=${encodeURIComponent(r.data.token)}`;
      setLink(url);
      window.location.href = url;
    }).catch(() => setError("Could not prepare the sign-in. Please try again."));
  }, [user, loading, setLoginOpen]);

  return (
    <div className="sec-dark min-h-screen grid place-items-center px-6" data-testid="app-login">
      <div className="aurora"/>
      <div className="max-w-md text-center">
        <Smartphone className="w-12 h-12 text-urbanex-gold mx-auto"/>
        <h1 className="mt-4 font-display text-4xl">Opening the Urbanex app…</h1>
        <p className="mt-3 text-urbanex-ivory/70">{user ? "You are signed in. If the app does not open by itself, press the button." : "Sign in with Google to continue to the app."}</p>
        {error && <p className="mt-4 text-red-300 text-sm">{error}</p>}
        {link && <a href={link} className="mt-6 inline-block rounded-full bg-urbanex-gold text-urbanex-navy px-8 py-3 font-medium" data-testid="app-login-open">Open the app</a>}
      </div>
    </div>
  );
}
