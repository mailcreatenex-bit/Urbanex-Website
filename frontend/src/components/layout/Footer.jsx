import { Link } from "react-router-dom";
import { Instagram, Youtube, Mail, Phone, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-24 bg-urbanex-navy text-urbanex-ivory">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 grid md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full border border-urbanex-gold flex items-center justify-center text-urbanex-gold font-display text-2xl">U</span>
            <div>
              <div className="font-display text-2xl">Urbanex Realty</div>
              <div className="text-xs tracking-[0.28em] uppercase text-urbanex-gold">Burdwan, West Bengal</div>
            </div>
          </div>
          <p className="mt-6 text-urbanex-ivory/70 text-sm max-w-md leading-relaxed">
            Boutique real estate advisory and contract-construction service by Ayan Dey.
            We help Burdwan buyers, sellers and NRIs make un-regrettable property decisions since 2022.
          </p>
        </div>

        <div>
          <div className="text-xs tracking-[0.28em] uppercase text-urbanex-gold mb-4">Explore</div>
          <ul className="space-y-2 text-sm text-urbanex-ivory/80">
            <li><Link to="/properties" className="hover:text-urbanex-gold">Properties</Link></li>
            <li><Link to="/construction" className="hover:text-urbanex-gold">Contract Construction</Link></li>
            <li><Link to="/about" className="hover:text-urbanex-gold">About Ayan</Link></li>
            <li><Link to="/contact" className="hover:text-urbanex-gold">Contact</Link></li>
            <li><Link to="/terms" className="hover:text-urbanex-gold">Terms</Link></li>
            <li><Link to="/privacy" className="hover:text-urbanex-gold">Privacy</Link></li>
          </ul>
        </div>

        <div>
          <div className="text-xs tracking-[0.28em] uppercase text-urbanex-gold mb-4">Reach us</div>
          <ul className="space-y-3 text-sm text-urbanex-ivory/80">
            <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-urbanex-gold"/> +91 99333 33333</li>
            <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-urbanex-gold"/> hello@urbanex.in</li>
            <li className="flex items-start gap-2"><MapPin className="w-4 h-4 text-urbanex-gold mt-0.5"/> Burdwan, West Bengal, India</li>
          </ul>
          <div className="flex gap-4 mt-5">
            <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" className="text-urbanex-ivory/60 hover:text-urbanex-gold"><Instagram className="w-5 h-5"/></a>
            <a href="https://www.youtube.com/@urbanexbyayandey" target="_blank" rel="noreferrer" className="text-urbanex-ivory/60 hover:text-urbanex-gold"><Youtube className="w-5 h-5"/></a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-urbanex-ivory/50">
          <div>© {new Date().getFullYear()} Urbanex Realty. All rights reserved.</div>
          <div className="flex items-center gap-2">
            <span>Crafted by</span>
            <a href="https://cre8nex.com" target="_blank" rel="noreferrer" className="font-mono tracking-widest text-urbanex-gold hover:text-urbanex-goldHover">CRE8NEX</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
