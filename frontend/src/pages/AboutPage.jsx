import { motion } from "framer-motion";
import { FOUNDER_IMAGES, FOUNDER_BIO } from "@/constants/seedData";

export default function AboutPage() {
  return (
    <div>
      <section className="max-w-7xl mx-auto px-6 md:px-12 pt-16 md:pt-24 pb-12">
        <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-4">About Urbanex</div>
        <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-urbanex-navy leading-[0.98] tracking-tight max-w-4xl text-balance">
          A quiet real-estate practice built on <em className="italic text-urbanex-gold">boring</em> honesty.
        </h1>
        <p className="mt-6 text-urbanex-navy/70 max-w-2xl leading-relaxed text-lg">
          Urbanex is a boutique advisory started by Ayan Dey in 2022. We work Burdwan — deeply, quietly, and only with a handful of clients at a time.
        </p>
      </section>

      {/* Founder's Journey */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-16">
        <div className="grid md:grid-cols-12 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
            className="md:col-span-5 relative">
            <div className="relative rounded-3xl overflow-hidden aspect-[4/5] border-2 border-urbanex-gold/40 shadow-[0_30px_80px_-40px_rgba(10,18,37,0.4)]">
              <img src={FOUNDER_IMAGES.hilltop} alt="Ayan Dey" width="825" height="1100" decoding="async" className="w-full h-full object-cover object-[50%_28%]"/>
            </div>
            <div className="absolute -bottom-6 -right-4 md:-right-8 bg-urbanex-navy text-urbanex-ivory px-5 py-3 rounded-xl">
              <div className="text-[10px] tracking-[0.28em] uppercase text-urbanex-gold">Since</div>
              <div className="font-display text-3xl">2022</div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
            className="md:col-span-7">
            <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-3">Founder's journey</div>
            <h2 className="font-display text-4xl md:text-5xl text-urbanex-navy leading-tight tracking-tight text-balance">
              From digital marketer to Burdwan's <em className="italic text-urbanex-gold">most patient</em> real estate advisor.
            </h2>
            <div className="mt-6 space-y-4 text-urbanex-navy/75 leading-relaxed">
              <p>
                Ayan Dey didn't come into real estate through inheritance or a broker's office. He came in from digital marketing — a discipline that trained him to say the truth, measure it, and refuse to sell what he wouldn't recommend to his family.
              </p>
              <p>
                Since 2022, Urbanex has quietly grown into a trusted name for buyers, NRIs and first-time homeowners in Burdwan — because Ayan personally walks every property, checks every title, and refuses to add junior agents between himself and the client.
              </p>
              <p className="text-urbanex-navy font-medium">{FOUNDER_BIO}</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Leadership card */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-16">
        <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-6 text-center">Leadership</div>
        <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-urbanex-navy/10 overflow-hidden grid md:grid-cols-2">
          <div className="aspect-square md:aspect-auto">
            <img src={FOUNDER_IMAGES.blazer} alt="Ayan Dey — Founder" width="1100" height="1094" loading="lazy" decoding="async" className="w-full h-full object-cover object-[50%_30%]"/>
          </div>
          <div className="p-8 md:p-10 flex flex-col justify-center">
            <div className="text-xs tracking-[0.28em] uppercase text-urbanex-gold">Founder & Principal Advisor</div>
            <h3 className="font-display text-4xl text-urbanex-navy mt-2">Ayan Dey</h3>
            <p className="mt-5 text-urbanex-navy/75 leading-relaxed">
              Digital marketing & home-building specialist. Based in Burdwan. In real estate since 2022. Answers his own phone. Signs off on every contract personally.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-urbanex-gold text-xs tracking-[0.24em] uppercase">Focus</div>
                <div className="text-urbanex-navy/80 mt-1">Residential · Villas · Plots</div>
              </div>
              <div>
                <div className="text-urbanex-gold text-xs tracking-[0.24em] uppercase">Coverage</div>
                <div className="text-urbanex-navy/80 mt-1">19 Burdwan zones</div>
              </div>
              <div>
                <div className="text-urbanex-gold text-xs tracking-[0.24em] uppercase">Speaks</div>
                <div className="text-urbanex-navy/80 mt-1">Bengali · English · Hindi</div>
              </div>
              <div>
                <div className="text-urbanex-gold text-xs tracking-[0.24em] uppercase">Also does</div>
                <div className="text-urbanex-navy/80 mt-1">Contract construction</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Manifesto */}
      <section className="max-w-4xl mx-auto px-6 md:px-12 py-24 text-center">
        <div className="text-xs tracking-[0.32em] uppercase text-urbanex-gold mb-6">Our manifesto</div>
        <p className="font-display text-3xl md:text-4xl text-urbanex-navy leading-snug text-balance">
          We would rather lose a deal than lose a family's trust. Every property we list, every home we build, every rupee we quote — passes that filter first.
        </p>
      </section>
    </div>
  );
}
