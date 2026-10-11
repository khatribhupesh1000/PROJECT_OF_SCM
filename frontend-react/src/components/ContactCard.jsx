import React from "react";
import { Star, Edit3, Trash2, Download, Clock } from "lucide-react";
import CallWhatsAppActions from "./CallWhatsAppActions.jsx";
import { getTagBadgeStyle } from "./ContactDrawer.jsx";
import {
  formatPhoneWithFlag,
  getInitials,
  inferContactTag,
  downloadVCard,
  getFollowUpStatus
} from "../services/api.js";

export default function ContactCard({
  contact,
  onToggleFavorite,
  onEdit,
  onDelete,
  onNotify
}) {
  const phoneInfo = formatPhoneWithFlag(contact.phoneNumber);
  const tag = inferContactTag(contact);
  const followUp = getFollowUpStatus(contact.followUpDate);

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm flex flex-col justify-between gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono text-xs font-semibold flex items-center justify-center shrink-0">
            {getInitials(contact.name)}
          </span>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate flex items-center gap-1.5">
              <span>{contact.name}</span>
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              {contact.description || contact.email}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${getTagBadgeStyle(
              tag
            )}`}
          >
            {tag}
          </span>
          {followUp && (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium border ${followUp.style}`}
            >
              <Clock className="w-2.5 h-2.5" />
              <span>{followUp.label}</span>
            </span>
          )}
        </div>
      </div>

      <div className="font-mono text-xs text-zinc-600 dark:text-zinc-300">
        {phoneInfo.flag} {phoneInfo.formatted}
      </div>

      <div className="pt-2.5 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <CallWhatsAppActions
          phoneNumber={contact.phoneNumber}
          contactName={contact.name}
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => downloadVCard(contact, onNotify)}
            title="Download vCard (.vcf)"
            className="p-1 text-zinc-400 hover:text-emerald-500 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onToggleFavorite?.(contact)}
            className="p-1 text-zinc-400 hover:text-amber-500 transition-colors"
          >
            <Star className={`w-3.5 h-3.5 ${contact.favorite ? "fill-amber-400 text-amber-400" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => onEdit?.(contact)}
            className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(contact.id)}
            className="p-1 text-zinc-400 hover:text-rose-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
