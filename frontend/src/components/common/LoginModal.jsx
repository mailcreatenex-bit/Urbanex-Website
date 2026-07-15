import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { AUTH } from "@/constants/testIds";
import { ShieldCheck } from "lucide-react";

export default function LoginModal() {
  const { loginOpen, setLoginOpen } = useAuth();

  const signIn = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
      <DialogContent data-testid={AUTH.modal} className="max-w-md bg-urbanex-ivory border border-urbanex-navy/10 p-0 overflow-hidden">
        <div className="p-8">
          <div className="text-xs tracking-[0.28em] uppercase text-urbanex-gold mb-3">Members access</div>
          <DialogHeader>
            <DialogTitle className="font-display text-3xl text-urbanex-navy leading-tight">
              Sign in to unlock pricing.
            </DialogTitle>
          </DialogHeader>
          <p className="mt-3 text-sm text-urbanex-navy/70 leading-relaxed">
            We share exact prices only with verified buyers. Sign in once with Google — no forms, no cold calls.
          </p>

          <div className="mt-6 space-y-3">
            <Button data-testid={AUTH.googleBtn} onClick={signIn} className="w-full bg-urbanex-navy hover:bg-urbanex-navyLight text-urbanex-ivory rounded-full h-12 text-sm tracking-wide">
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="#fff" d="M21.35 11.1H12v3.2h5.35c-.23 1.4-1.7 4.1-5.35 4.1-3.22 0-5.85-2.66-5.85-5.95S8.78 6.5 12 6.5c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.98 14.55 3 12 3 6.98 3 3 6.98 3 12s3.98 9 9 9c5.2 0 8.65-3.66 8.65-8.8 0-.6-.07-1.05-.15-1.5z"/></svg>
              Continue with Google
            </Button>
            <div className="flex items-center gap-2 text-xs text-urbanex-navy/50 justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-urbanex-gold"/>
              Verified via Emergent Auth · we never see your Google password.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
