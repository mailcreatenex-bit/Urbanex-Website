// The box people tick when they give a name and number. It is a plain required checkbox inside the form, so the browser itself
// stops the form from being sent until it is ticked. The policy opens in a new tab, so nothing they typed is lost.
export default function PrivacyConsent({ tone = "light", className = "" }) {
  const dark = tone === "dark";
  return (
    <label className={`flex items-start gap-2.5 text-[12px] leading-snug cursor-pointer ${dark ? "text-urbanex-ivory/75" : "text-urbanex-navy/70"} ${className}`} data-testid="privacy-consent">
      <input type="checkbox" required className="mt-0.5 h-4 w-4 shrink-0 accent-[#C5A059]" data-testid="privacy-checkbox"/>
      <span>
        I have read the <a href="/privacy" target="_blank" rel="noopener noreferrer" className={`underline underline-offset-2 font-medium ${dark ? "text-urbanex-gold" : "text-urbanex-navy"}`}>Privacy Policy</a> and
        agree that Urbanex Realty may contact me about this.
      </span>
    </label>
  );
}
