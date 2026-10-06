import { Smartphone } from "lucide-react";

// Wraps a sensor tool: asks permission (a tap is needed on iPhones), then shows the tool once readings arrive.
export default function SensorGate({ sensor, what, children }) {
  const { status, start } = sensor;
  if (status === "live" || status === "waiting") return <div className={status === "waiting" ? "opacity-60" : ""}>{children}</div>;
  const msg = {
    unsupported: `This browser cannot read a ${what}. Open this page on your phone in Chrome or Safari.`,
    nodata: `No ${what} readings came through. This works on phones and tablets, not on most computers. Open this page on your phone.`,
    denied: `Permission was refused. Allow motion and orientation access in your browser settings, then try again.`,
  }[status];
  return (
    <div className="rounded-3xl bg-white border border-urbanex-navy/5 p-10 text-center" data-testid="sensor-gate">
      <Smartphone className="w-10 h-10 mx-auto text-urbanex-gold"/>
      <p className="mt-4 text-urbanex-navy/75 max-w-md mx-auto">{msg || `Tap to turn on your phone's ${what}. Your phone may ask for permission to use its motion sensors. Nothing is sent anywhere.`}</p>
      <button onClick={start} data-testid="sensor-start" className="mt-6 rounded-full bg-urbanex-navy text-urbanex-ivory px-8 py-3 text-sm">{status === "idle" ? `Start ${what}` : "Try again"}</button>
    </div>
  );
}
