import { Download, ExternalLink, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ANDROID_APP_URL } from "@/lib/appShell";

// "Use the app for this": shown on the website when someone tries a tool that only works inside the Urbanex app.
export default function AppGateModal({ open, onClose, title = "Search land records in the Urbanex app", why, officialUrl, officialLabel = "Open the official site instead" }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="app-gate">
        <DialogHeader>
          <div className="w-12 h-12 rounded-2xl bg-urbanex-gold/20 flex items-center justify-center mb-2"><Smartphone className="w-6 h-6 text-urbanex-gold"/></div>
          <DialogTitle className="font-display text-2xl text-urbanex-navy">{title}</DialogTitle>
          <DialogDescription className="text-urbanex-navy/70 leading-relaxed">
            {why || "The government land-records site cannot be opened inside a website, so this search works inside the Urbanex app on your phone. In the app you search, see the result and save it as a PDF, all in one place."}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex flex-col gap-3">
          {ANDROID_APP_URL ? (
            <a href={ANDROID_APP_URL} target="_blank" rel="noopener noreferrer" data-testid="app-download" className="inline-flex items-center justify-center gap-2 rounded-full bg-urbanex-navy text-urbanex-ivory px-6 py-3 text-sm"><Download className="w-4 h-4"/> Download the Android app</a>
          ) : (
            <div className="rounded-xl bg-urbanex-cream px-4 py-3 text-sm text-urbanex-navy/75" data-testid="app-soon">The Android app is on its way. Until it is out, you can use the official site below.</div>
          )}
          {officialUrl && <a href={officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 text-sm text-urbanex-navy/70 underline"><ExternalLink className="w-4 h-4"/> {officialLabel}</a>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
