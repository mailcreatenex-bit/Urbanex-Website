import { Link } from "react-router-dom";
import { Bug, Eye, KeyRound, Lock, ScanSearch, ShieldCheck, Timer } from "lucide-react";
import { useSeo } from "@/lib/seo";
import { waLink } from "@/lib/config";

const PROTECTIONS = [
  [Lock, "Encrypted everywhere", "Every page and every request uses HTTPS, with browser rules that forbid downgrading to plain HTTP."],
  [KeyRound, "No passwords to steal", "You sign in with your Google account. Urbanex never sees or stores a password. Admin screens are open only to the owner's accounts."],
  [ShieldCheck, "Browser guard rails", "A strict content policy blocks injected scripts, the site cannot be framed by other sites, and private pages are never cached."],
  [Timer, "Spam and flood limits", "Each visitor is limited per minute on every form and AI feature, and the server refuses oversized requests."],
  [ScanSearch, "Checked on every change", "Automated tests check that every admin and owner screen refuses visitors, that scripts in text are neutralised, that uploads cannot escape their folder and that internal addresses cannot be reached. The libraries are scanned for known flaws."],
  [Eye, "No tracking scripts", "Urbanex does not run screen-recording or third-party analytics scripts on its pages."],
];

export default function SecurityPage() {
  useSeo({ title: "Security at Urbanex", description: "How Urbanex protects your data, and how to report a security problem." });
  return (
    <div className="sec-dark min-h-screen" data-testid="security-page">
      <div className="aurora"/>
      <div className="max-w-4xl mx-auto px-5 md:px-10 pt-32 pb-24">
        <div className="chapter" data-n="🔒">Security</div>
        <h1 className="mt-5 font-display text-5xl md:text-7xl leading-[0.98] tracking-tight text-balance">Built to be <em className="italic text-gold-gradient">hard to break.</em></h1>
        <p className="mt-6 text-lg text-urbanex-ivory/70 leading-relaxed max-w-2xl">Your phone number and your plans are personal. This is what we do to protect them, and how you can help us if you find a weak spot.</p>

        <div className="mt-12 grid sm:grid-cols-2 gap-4">
          {PROTECTIONS.map(([Icon, t, d]) => (
            <div key={t} className="glass-dark rounded-3xl p-6"><Icon className="w-6 h-6 text-urbanex-gold"/><div className="mt-3 font-display text-2xl">{t}</div><p className="mt-1 text-sm text-urbanex-ivory/65 leading-relaxed">{d}</p></div>
          ))}
        </div>

        <section className="mt-16 rounded-3xl border border-urbanex-gold/40 bg-urbanex-gold/10 p-6 md:p-8" id="report">
          <div className="flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase text-urbanex-gold"><Bug className="w-4 h-4"/> Found something?</div>
          <h2 className="mt-2 font-display text-3xl">Tell us first. We say thank you.</h2>
          <p className="mt-3 text-urbanex-ivory/75 leading-relaxed">No website is perfectly secure, and we would rather hear about a weak spot from a friend than from a stranger. If you think you found one, please report it. We read every report, fix real problems fast, and credit you if you wish.</p>
          <div className="mt-5 grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <div className="font-medium text-urbanex-ivory">Please do</div>
              <ul className="mt-2 space-y-1.5 text-urbanex-ivory/70 list-disc pl-5">
                <li>Test only this website and its API, and only with your own account and your own test data.</li>
                <li>Stop as soon as you have shown the problem. Do not read, change or keep other people's data.</li>
                <li>Send us the steps to repeat it, and give us a reasonable time to fix it before telling anyone.</li>
              </ul>
            </div>
            <div>
              <div className="font-medium text-urbanex-ivory">Please do not</div>
              <ul className="mt-2 space-y-1.5 text-urbanex-ivory/70 list-disc pl-5">
                <li>Try to take the site down, flood forms with spam, or run automated scanners at high speed.</li>
                <li>Trick, phone or threaten our staff or visitors, or test the other services we use (Google, Netlify, Render, MongoDB, WhatsApp).</li>
                <li>Ask for payment before telling us. We do not run a paid bug bounty.</li>
              </ul>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={waLink("Hello Ayan, I would like to report a security problem on the website.")} target="_blank" rel="noopener noreferrer" className="rounded-full bg-urbanex-gold text-urbanex-navy px-6 py-3 text-sm font-medium">Report on WhatsApp</a>
            <Link to="/contact" className="rounded-full border border-urbanex-gold/60 text-urbanex-gold px-6 py-3 text-sm">Use the contact form</Link>
            <a href="/.well-known/security.txt" className="rounded-full border border-white/20 px-6 py-3 text-sm text-urbanex-ivory/80">security.txt</a>
          </div>
        </section>
      </div>
    </div>
  );
}
