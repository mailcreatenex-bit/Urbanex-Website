import { MessageCircle } from "lucide-react";
import { WHATSAPP } from "@/constants/testIds";
import { waLink } from "@/lib/config";

export default function FloatingWhatsApp() {
  const href = waLink("Hi Ayan, I found Urbanex Realty online and would like to explore properties in Burdwan.");
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      data-testid={WHATSAPP.floating}
      className="fixed bottom-6 right-6 z-40 group flex items-center gap-2 bg-[#25D366] hover:bg-[#1EBE57] text-white rounded-full pl-3 pr-5 py-3 shadow-[0_10px_30px_-8px_rgba(37,211,102,0.6)] transition-transform hover:scale-105"
    >
      <MessageCircle className="w-5 h-5"/>
      <span className="text-sm font-medium hidden sm:inline">WhatsApp Ayan</span>
    </a>
  );
}
