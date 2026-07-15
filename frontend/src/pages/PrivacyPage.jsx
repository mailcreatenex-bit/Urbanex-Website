export default function PrivacyPage() {
  return (
    <article className="max-w-3xl mx-auto px-6 md:px-12 py-16 md:py-24 text-urbanex-navy/80 leading-relaxed">
      <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-4">Legal</div>
      <h1 className="font-display text-5xl text-urbanex-navy leading-tight tracking-tight mb-8">Privacy Policy</h1>
      <p>Last updated: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</p>

      <h2 className="font-display text-2xl text-urbanex-navy mt-10 mb-3">Data we collect</h2>
      <p>When you submit a form, sign in with Google, or WhatsApp us, we collect your name, phone, email and any message you share. Google sign-in additionally gives us your name, email and profile picture — nothing else.</p>

      <h2 className="font-display text-2xl text-urbanex-navy mt-10 mb-3">How we use it</h2>
      <p>Solely to respond to your enquiry, share property information you asked for, and (with your consent) send occasional new-listing alerts. We never sell or rent your data.</p>

      <h2 className="font-display text-2xl text-urbanex-navy mt-10 mb-3">Storage & security</h2>
      <p>Your data is stored in an encrypted database hosted in India. Access is limited to Urbanex staff on a need-to-know basis.</p>

      <h2 className="font-display text-2xl text-urbanex-navy mt-10 mb-3">Your rights</h2>
      <p>You can request access, correction or deletion of your data any time by writing to <a className="text-urbanex-gold" href="mailto:hello@urbanex.in">hello@urbanex.in</a>. We honour deletion requests within 30 days.</p>

      <h2 className="font-display text-2xl text-urbanex-navy mt-10 mb-3">Cookies</h2>
      <p>We use a single essential cookie (<code className="font-mono text-xs">session_token</code>) to keep you signed in. No advertising or third-party tracking cookies are set by us.</p>
    </article>
  );
}
