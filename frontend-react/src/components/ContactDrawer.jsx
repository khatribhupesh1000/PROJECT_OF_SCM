import React, { useEffect, useState } from "react";
import {
  X,
  Star,
  Copy,
  Check,
  PhoneCall,
  MessageCircle,
  Mail,
  MapPin,
  Globe,
  Linkedin,
  Edit3,
  Trash2,
  Radio,
  Clock,
  Building2,
  FileText,
  Send,
  ExternalLink,
  Loader2,
  Compass,
  Navigation,
  AlertCircle,
  Sparkles
} from "lucide-react";
import {
  formatPhoneWithFlag,
  getInitials,
  inferContactTag,
  formatShortDate,
  notificationApi,
  aiApi,
  parseRfc7807Error,
  getLocationAndTimezoneInfo
} from "../services/api.js";
import { formatPhoneForTel, formatPhoneForWhatsApp } from "./CallWhatsAppActions.jsx";

export function getTagBadgeStyle(tag) {
  switch (String(tag || "").toUpperCase()) {
    case "VIP":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60";
    case "LEAD":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60";
    case "FAMILY":
      return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60";
    default:
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60";
  }
}

export default function ContactDrawer({
  contact,
  onClose,
  onToggleFavorite,
  onUpdateTag,
  onUpdateNotes,
  onEdit,
  onDelete,
  onSoapVerify,
  onCopyPhone,
  onNotify
}) {
  const [copiedField, setCopiedField] = useState(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [carrierResult, setCarrierResult] = useState(null);

  // ── Inline Email Composer state ──
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [aiDraftOpen, setAiDraftOpen] = useState(false);
  const [aiDraftPrompt, setAiDraftPrompt] = useState("");
  const [aiDrafting, setAiDrafting] = useState(false);

  const handleGenerateAiDraft = async () => {
    if (!aiDraftPrompt.trim()) return;
    setAiDrafting(true);
    try {
      const result = await aiApi.draftEmail({
        contactName: contact.name,
        company: contact.company,
        prompt: aiDraftPrompt.trim()
      });
      if (result.subject) setEmailSubject(result.subject);
      if (result.body) setEmailBody(result.body);
      setAiDraftOpen(false);
      onNotify?.({
        variant: "success",
        title: "✨ Email Drafted with AI",
        detail: "Subject and body populated. Ready to send via SMTP."
      });
    } catch (err) {
      const problem = parseRfc7807Error(err);
      onNotify?.({
        variant: "error",
        title: "AI Draft Error",
        detail: problem.detail || "Unable to draft email."
      });
    } finally {
      setAiDrafting(false);
    }
  };

  useEffect(() => {
    if (contact) {
      setNotesDraft(contact.description || "");
      setCarrierResult(null);
      setEmailOpen(false);
      setEmailSubject("");
      setEmailBody("");
      setAiDraftOpen(false);
      setAiDraftPrompt("");
    }
  }, [contact]);

  useEffect(() => {
    if (!contact) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [contact, onClose]);

  // Real-time ticking clock for local timezone
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setClockTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  if (!contact) return null;

  const phoneInfo = formatPhoneWithFlag(contact.phoneNumber);
  const tag = inferContactTag(contact);
  const locInfo = getLocationAndTimezoneInfo(contact);
  const hasEmail = Boolean(contact?.email && String(contact.email).trim());
  const telHref = `tel:${formatPhoneForTel(contact.phoneNumber)}`;
  const waHref = `https://wa.me/${formatPhoneForWhatsApp(
    contact.phoneNumber
  )}?text=${encodeURIComponent(`Hi ${contact.name}, reaching out to connect.`)}`;

  const handleCopy = (value, label) => {
    navigator.clipboard?.writeText(value);
    setCopiedField(label);
    onCopyPhone?.(value, label);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleVerifyCarrier = async () => {
    setVerifying(true);
    try {
      const res = await onSoapVerify(contact);
      if (res) setCarrierResult(res);
    } finally {
      setVerifying(false);
    }
  };

  const handleSaveNotes = async () => {
    if (notesDraft === (contact.description || "")) return;
    setSavingNotes(true);
    try {
      await onUpdateNotes?.(contact, notesDraft);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleSendEmail = async () => {
    if (!contact?.email || !String(contact.email).trim()) {
      onNotify?.({
        variant: "error",
        title: "No recipient email",
        detail: "Cannot send email because this contact has no email address on record."
      });
      return;
    }
    if (!emailSubject.trim() && !emailBody.trim()) return;
    setEmailSending(true);
    try {
      const res = await notificationApi.sendEmail({
        to: contact.email,
        subject: emailSubject.trim() || `Message from SCM for ${contact.name}`,
        body: emailBody.trim() || "(No message body)"
      });
      if (res?.status === "DELIVERED") {
        onNotify?.({
          variant: "success",
          title: "Email sent successfully",
          detail: `Dispatched to ${contact.email} via SCM Gmail SMTP`
        });
      } else if (res?.status === "QUEUED_RESILIENT_FALLBACK") {
        onNotify?.({
          variant: "info",
          title: "Email Queued for Delivery",
          detail: res?.fallbackReason
            ? `SMTP notice: ${res.fallbackReason.slice(0, 80)}`
            : `Queued for retry to ${contact.email} via SCM Notification Service`
        });
      } else {
        onNotify?.({
          variant: "success",
          title: "Notification dispatched",
          detail: `Processed for ${contact.email}`
        });
      }
      setEmailOpen(false);
      setEmailSubject("");
      setEmailBody("");
    } catch (err) {
      onNotify?.({ variant: "error", ...parseRfc7807Error(err) });
    } finally {
      setEmailSending(false);
    }
  };

  const timelineEvents = [
    ...(carrierResult
      ? [
          {
            id: "evt-carrier",
            title: `Telecom line verified (${carrierResult.carrier})`,
            meta: `${carrierResult.lineType} • ${carrierResult.attempts} attempt(s)`,
            time: "Just now",
            accent: "bg-emerald-500"
          }
        ]
      : []),
    {
      id: "evt-updated",
      title: "Contact profile synced",
      meta: `Updated record ${contact.id}`,
      time: formatShortDate(contact.updatedAt),
      accent: "bg-zinc-400 dark:bg-zinc-500"
    },
    {
      id: "evt-created",
      title: "Added to workspace directory",
      meta: `Source: ${contact.company || "Direct entry"}`,
      time: formatShortDate(contact.createdAt),
      accent: "bg-zinc-300 dark:bg-zinc-700"
    }
  ];

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-zinc-950/30 dark:bg-zinc-950/50 backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        aria-label="Contact inspection panel"
        className="w-full max-w-md h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col animate-slide-in-right"
      >
        {/* Top Bar */}
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
              {contact.id}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${getTagBadgeStyle(
                tag
              )}`}
            >
              {tag}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleFavorite(contact)}
              title={contact.favorite ? "Remove from favorites" : "Star contact"}
              className={`p-1.5 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98] ${
                contact.favorite
                  ? "bg-amber-50 border-amber-200 text-amber-500 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-400"
                  : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${contact.favorite ? "fill-current" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => onEdit(contact)}
              title="Edit contact"
              className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(contact.id)}
              title="Delete contact"
              className="p-1.5 rounded-md text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5" />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Inspection Content */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800">
          {/* Identity & Quick Actions */}
          <div className="p-5">
            <div className="flex items-start gap-3.5">
              {contact.pictureUrl ? (
                <img
                  src={contact.pictureUrl}
                  alt={contact.name}
                  className="w-11 h-11 rounded-lg object-cover border border-zinc-200 dark:border-zinc-800 shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-mono text-sm font-semibold flex items-center justify-center shrink-0">
                  {getInitials(contact.name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {contact.name}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
                  {contact.description || "Direct Contact"}
                </p>

                {/* 🕒 Live Timezone & Business Hours Intelligence */}
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                    <Clock className="w-2.5 h-2.5 text-zinc-400" />
                    <span>{locInfo.localTimeStr}</span>
                    <span className="text-zinc-400 dark:text-zinc-500">({locInfo.tzLabel})</span>
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                      locInfo.isWorkingHours
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60"
                        : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        locInfo.isWorkingHours ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                      }`}
                    />
                    <span>{locInfo.statusText}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-4 grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleCopy(contact.phoneNumber, "Phone")}
                className="flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
              >
                {copiedField === "Phone" ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                )}
                <span className="text-[11px]">
                  {copiedField === "Phone" ? "Copied" : "Copy Phone"}
                </span>
              </button>

              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-200 dark:hover:border-emerald-800/60 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px]">WhatsApp</span>
              </a>

              <a
                href={telHref}
                className="flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
              >
                <PhoneCall className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-[11px]">Call</span>
              </a>

              <button
                type="button"
                disabled={!hasEmail}
                onClick={() => hasEmail && setEmailOpen((prev) => !prev)}
                title={hasEmail ? (emailOpen ? "Close email composer" : "Compose email") : "No email address saved for this contact"}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg border text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98] ${
                  !hasEmail
                    ? "opacity-50 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-800 text-zinc-400"
                    : emailOpen
                    ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                    : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <Mail className={`w-3.5 h-3.5 ${hasEmail && emailOpen ? "text-emerald-500" : "text-zinc-400"}`} />
                <span className="text-[11px]">Email</span>
              </button>
            </div>

            {/* ── Inline SCM Email Composer ── */}
            {emailOpen && (
              <div className="mt-3 rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Send className="w-3 h-3" />
                    <span>SCM Mail Service</span>
                  </span>
                  {hasEmail && (
                    <a
                      href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contact.email)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Open in Gmail</span>
                    </a>
                  )}
                </div>

                {!hasEmail ? (
                  <div className="flex items-center gap-2 p-3 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-md">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>This contact does not have an email address. Add an email in Edit Contact to send messages.</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                      <span className="truncate">To: {contact.email}</span>
                      <button
                        type="button"
                        onClick={() => setAiDraftOpen((prev) => !prev)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-900/40 hover:bg-emerald-200/70 dark:hover:bg-emerald-800/60 transition-colors"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>{aiDraftOpen ? "Close AI" : "✨ Draft with AI"}</span>
                      </button>
                    </div>

                    {aiDraftOpen && (
                      <div className="flex items-center gap-1.5 p-1.5 rounded-md bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-700 shadow-sm">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 ml-1" />
                        <input
                          type="text"
                          autoFocus
                          value={aiDraftPrompt}
                          onChange={(e) => setAiDraftPrompt(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleGenerateAiDraft();
                            }
                          }}
                          placeholder="e.g. Say thank you for the coffee meeting..."
                          className="flex-1 bg-transparent text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none px-1"
                        />
                        <button
                          type="button"
                          disabled={aiDrafting || !aiDraftPrompt.trim()}
                          onClick={handleGenerateAiDraft}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]"
                        >
                          {aiDrafting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          <span>{aiDrafting ? "Drafting..." : "Generate"}</span>
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="Subject"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="flex-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-emerald-400 dark:focus:border-emerald-600 focus:outline-none"
                      />
                      {!aiDraftOpen && (
                        <button
                          type="button"
                          onClick={() => setAiDraftOpen(true)}
                          title="Draft with AI"
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-xs font-medium transition-all shrink-0 active:scale-[0.98]"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span className="hidden sm:inline">✨ Draft with AI</span>
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={3}
                      placeholder="Write your message..."
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-emerald-400 dark:focus:border-emerald-600 focus:outline-none resize-none"
                    />
                    <button
                      type="button"
                      disabled={!hasEmail || emailSending || (!emailSubject.trim() && !emailBody.trim())}
                      onClick={handleSendEmail}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-[0.98]"
                    >
                      {emailSending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>{emailSending ? "Sending..." : "Send via SCM SMTP"}</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Properties Grid */}
          <div className="p-5 space-y-3 text-xs">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              Contact Details
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-zinc-500 dark:text-zinc-400">Phone</span>
              <button
                type="button"
                onClick={() => handleCopy(contact.phoneNumber, "Phone")}
                className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400"
              >
                <span>{phoneInfo.flag}</span>
                <span>{phoneInfo.formatted}</span>
                <Copy className="w-3 h-3 opacity-60" />
              </button>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-zinc-500 dark:text-zinc-400">Email</span>
              {hasEmail ? (
                <button
                  type="button"
                  onClick={() => handleCopy(contact.email, "Email")}
                  className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 truncate max-w-[230px]"
                >
                  <span className="truncate">{contact.email}</span>
                  <Copy className="w-3 h-3 opacity-60 shrink-0" />
                </button>
              ) : (
                <span className="text-zinc-400 dark:text-zinc-500 italic font-mono text-xs">
                  Not provided
                </span>
              )}
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-zinc-500 dark:text-zinc-400">Segment Tag</span>
              <div className="flex items-center gap-1">
                {["VIP", "Colleague", "Lead", "Family"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onUpdateTag?.(contact, t)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                      tag === t
                        ? getTagBadgeStyle(t)
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {contact.company && (
              <div className="flex items-center justify-between py-1">
                <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Organization</span>
                </span>
                <span className="text-zinc-900 dark:text-zinc-100 font-medium">
                  {contact.company}
                </span>
              </div>
            )}

            <div className="flex items-start justify-between py-1.5 gap-2">
              <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 shrink-0 pt-0.5">
                <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                <span>Location</span>
              </span>
              <div className="flex flex-col items-end gap-1 min-w-0">
                <span className="text-zinc-900 dark:text-zinc-100 text-right max-w-[240px] truncate font-medium">
                  {contact.address || "—"}
                </span>
                {locInfo.hasAddress && (
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                      <span>{locInfo.tzOffset}</span>
                    </span>
                    <a
                      href={locInfo.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in Google Maps"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 hover:underline transition-colors"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Directions</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            {contact.websiteLink && (
              <div className="flex items-center justify-between py-1">
                <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Website</span>
                </span>
                <a
                  href={contact.websiteLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-emerald-600 dark:text-emerald-400 hover:underline truncate max-w-[220px]"
                >
                  {contact.websiteLink.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}

            {contact.linkedInLink && (
              <div className="flex items-center justify-between py-1">
                <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Linkedin className="w-3.5 h-3.5 text-zinc-400" />
                  <span>LinkedIn</span>
                </span>
                <a
                  href={contact.linkedInLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-emerald-600 dark:text-emerald-400 hover:underline truncate max-w-[220px]"
                >
                  {contact.linkedInLink.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              </div>
            )}
          </div>

          {/* Notes / Role Editor */}
          <div className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <FileText className="w-3 h-3" />
                <span>Role &amp; Context Notes</span>
              </span>
              {notesDraft !== (contact.description || "") && (
                <button
                  type="button"
                  disabled={savingNotes}
                  onClick={handleSaveNotes}
                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                >
                  {savingNotes ? "Saving..." : "Save"}
                </button>
              )}
            </div>
            <textarea
              rows={3}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="Add role, context, or meeting notes..."
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none"
            />
          </div>

          {/* Activity Timeline & Carrier Diagnostics */}
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                <span>Activity Timeline</span>
              </span>
              <button
                type="button"
                disabled={verifying}
                onClick={handleVerifyCarrier}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 transition-colors active:scale-[0.98]"
              >
                <Radio className="w-3 h-3 text-emerald-500" />
                <span>{verifying ? "Checking..." : "Verify Line"}</span>
              </button>
            </div>

            <div className="relative pl-4 space-y-4 before:absolute before:left-[5px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-zinc-200 dark:before:bg-zinc-800">
              {timelineEvents.map((ev) => (
                <div key={ev.id} className="relative text-xs">
                  <span
                    className={`absolute -left-4 top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-white dark:ring-zinc-900 ${ev.accent}`}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                      {ev.title}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-400">{ev.time}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono">
                    {ev.meta}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
