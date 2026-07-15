export default function TermsPage() {
  return (
    <article className="max-w-3xl mx-auto px-6 md:px-12 py-16 md:py-24 text-urbanex-navy/80 leading-relaxed">
      <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-4">Legal</div>
      <h1 className="font-display text-5xl text-urbanex-navy leading-tight tracking-tight mb-8">Terms of Service</h1>
      <p>Last updated: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</p>

      <h2 className="font-display text-2xl text-urbanex-navy mt-10 mb-3">1. Nature of engagement</h2>
      <p>Urbanex Realty ("we", "Urbanex") operates a real estate advisory and contract-construction service based in Burdwan, West Bengal. Listings on this site are indicative and subject to owner confirmation, availability, and title verification at the time of booking.</p>

      <h2 className="font-display text-2xl text-urbanex-navy mt-10 mb-3">2. Property information</h2>
      <p>We take reasonable care to ensure accuracy of details, images and pricing, but do not warrant that the information is complete or error-free. Prices are indicative and subject to change until a booking receipt is issued.</p>

      <h2 className="font-display text-2xl text-urbanex-navy mt-10 mb-3">3. Advisory scope</h2>
      <p>Our role is limited to advisory, mediation and, where applicable, contract construction. We do not act as legal counsel; all buyers are encouraged to independently verify title, mutation and encumbrance certificates.</p>

      <h2 className="font-display text-2xl text-urbanex-navy mt-10 mb-3">4. User submissions</h2>
      <p>Contact and lead information voluntarily submitted through our forms is used solely to respond to your enquiry and is stored securely. See our Privacy Policy for details.</p>

      <h2 className="font-display text-2xl text-urbanex-navy mt-10 mb-3">5. Jurisdiction</h2>
      <p>These Terms are governed by the laws of India. Any dispute is subject to the exclusive jurisdiction of courts at Burdwan (Purba Bardhaman), West Bengal.</p>

      <h2 className="font-display text-2xl text-urbanex-navy mt-10 mb-3">6. Contact</h2>
      <p>Questions? Reach us at <a className="text-urbanex-gold" href="mailto:hello@urbanex.in">hello@urbanex.in</a>.</p>
    </article>
  );
}
