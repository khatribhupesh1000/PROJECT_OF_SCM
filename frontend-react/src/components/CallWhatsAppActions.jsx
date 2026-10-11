import React from "react";
import { PhoneCall, MessageCircle, MapPin } from "lucide-react";

export function formatPhoneForTel(phoneNumber) {
  return String(phoneNumber || "").replace(/[^\d+]/g, "");
}

export function formatPhoneForWhatsApp(phoneNumber) {
  return String(phoneNumber || "").replace(/[^\d]/g, "");
}

export default function CallWhatsAppActions({ phoneNumber, contactName, address }) {
  const telNumber = formatPhoneForTel(phoneNumber);
  const waNumber = formatPhoneForWhatsApp(phoneNumber);
  const waText = encodeURIComponent(
    `Hi ${contactName || ""}, reaching out to connect.`
  );

  const handleShareLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const pinUrl = `https://maps.google.com/?q=${lat},${lng}`;
          const msg = encodeURIComponent(
            `Hi ${contactName || ""}, here is my location for our upcoming meeting: ${pinUrl}`
          );
          window.open(`https://wa.me/${waNumber}?text=${msg}`, "_blank");
        },
        () => {
          // Fallback if permission dismissed or unavailable: use contact address if exists
          const mapQuery = address ? encodeURIComponent(address) : "Current Location";
          const pinUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
          const msg = encodeURIComponent(
            `Hi ${contactName || ""}, here is the meeting location: ${pinUrl}`
          );
          window.open(`https://wa.me/${waNumber}?text=${msg}`, "_blank");
        },
        { timeout: 4000 }
      );
    } else {
      const mapQuery = address ? encodeURIComponent(address) : "Meeting Location";
      const pinUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
      const msg = encodeURIComponent(
        `Hi ${contactName || ""}, here is the meeting location: ${pinUrl}`
      );
      window.open(`https://wa.me/${waNumber}?text=${msg}`, "_blank");
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <a
        href={`tel:${telNumber}`}
        title={`Call ${phoneNumber}`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
      >
        <PhoneCall className="w-3.5 h-3.5 text-zinc-400" />
        <span>Call</span>
      </a>
      <a
        href={`https://wa.me/${waNumber}?text=${waText}`}
        target="_blank"
        rel="noopener noreferrer"
        title={`WhatsApp ${phoneNumber}`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        <span>WhatsApp</span>
      </a>
      <button
        type="button"
        onClick={handleShareLocation}
        title="Share Meeting Location Pin via WhatsApp"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
      >
        <MapPin className="w-3.5 h-3.5 text-emerald-500" />
        <span>Send Pin</span>
      </button>
    </div>
  );
}
