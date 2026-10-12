import React, { useEffect, useRef, useState } from "react";
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
  Sparkles,
  Download,
  Calendar,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Plus
} from "lucide-react";
import {
  formatPhoneWithFlag,
  getInitials,
  inferContactTag,
  formatShortDate,
  notificationApi,
  aiApi,
  contactApi,
  parseRfc7807Error,
  getLocationAndTimezoneInfo,
  downloadVCard,
  getFollowUpStatus
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

export function formatFriendlyDateTime(dateValue) {
  if (!dateValue) return "";
  try {
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return "";
    const datePart = d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
    const timePart = d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
    return `${datePart} at ${timePart} (IST)`;
  } catch (_e) {
    return "";
  }
}

export function formatTimelineDate(dateValue) {
  if (!dateValue) return "";
  try {
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return String(dateValue || "");
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec >= 0 && diffSec < 60) return "Just now";
    if (diffSec >= 60 && diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    let datePart = "";
    let timePart = "";
    try {
      datePart = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "Asia/Kolkata"
      });
      timePart = d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata"
      });
    } catch (_tzErr) {
      datePart = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
      timePart = d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    }
    return `${datePart}, ${timePart} (IST)`;
  } catch (_e) {
    return String(dateValue || "");
  }
}

export function getActivityBadge(type) {
  switch (type) {
    case "MEETING_SCHEDULED":
      return {
        icon: Calendar,
        accent: "bg-amber-500",
        badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60"
      };
    case "MEETING_CANCELLED":
      return {
        icon: XCircle,
        accent: "bg-rose-500",
        badge: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60"
      };
    case "EMAIL_SENT":
      return {
        icon: Mail,
        accent: "bg-sky-500",
        badge: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/60"
      };
    case "CALL_INITIATED":
      return {
        icon: PhoneCall,
        accent: "bg-purple-500",
        badge: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/60"
      };
    case "WHATSAPP_INITIATED":
      return {
        icon: MessageCircle,
        accent: "bg-emerald-500",
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60"
      };
    case "CARRIER_VERIFIED":
      return {
        icon: Radio,
        accent: "bg-teal-500",
        badge: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800/60"
      };
    case "QUICK_NOTE":
      return {
        icon: FileText,
        accent: "bg-indigo-500",
        badge: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/60"
      };
    case "PROFILE_UPDATED":
      return {
        icon: Edit3,
        accent: "bg-zinc-400 dark:bg-zinc-500",
        badge: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
      };
    case "PROFILE_CREATED":
    default:
      return {
        icon: Star,
        accent: "bg-zinc-400 dark:bg-zinc-600",
        badge: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
      };
  }
}

export function MiniCalendarPicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const parsedDate = React.useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }, [value]);

  const [viewDate, setViewDate] = useState(() => parsedDate || new Date());

  const [selectedHour, setSelectedHour] = useState(() => {
    if (!parsedDate) return "10";
    let h = parsedDate.getHours() % 12;
    return String(h === 0 ? 12 : h).padStart(2, "0");
  });

  const [selectedMinute, setSelectedMinute] = useState(() => {
    if (!parsedDate) return "00";
    return String(parsedDate.getMinutes()).padStart(2, "0");
  });

  const [selectedAmPm, setSelectedAmPm] = useState(() => {
    if (!parsedDate) return "AM";
    return parsedDate.getHours() >= 12 ? "PM" : "AM";
  });

  useEffect(() => {
    if (parsedDate) {
      setViewDate(parsedDate);
      let h = parsedDate.getHours() % 12;
      setSelectedHour(String(h === 0 ? 12 : h).padStart(2, "0"));
      setSelectedMinute(String(parsedDate.getMinutes()).padStart(2, "0"));
      setSelectedAmPm(parsedDate.getHours() >= 12 ? "PM" : "AM");
    }
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const monthName = viewDate.toLocaleString("en-US", { month: "long" });
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
  const firstDayIndex = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const prevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const emitDateTime = (targetYear, targetMonth, targetDay, hourStr = selectedHour, minStr = selectedMinute, ampmStr = selectedAmPm) => {
    let hour = parseInt(hourStr, 10);
    if (ampmStr === "PM" && hour < 12) hour += 12;
    if (ampmStr === "AM" && hour === 12) hour = 0;
    const minute = parseInt(minStr, 10);

    const targetDate = new Date(targetYear, targetMonth, targetDay, hour, minute, 0, 0);
    onChange(targetDate.toISOString());
  };

  const handleSelectDay = (day) => {
    emitDateTime(viewYear, viewMonth, day);
  };

  const handleApplyPreset = (daysOffset, targetHour24, targetMinute = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    d.setHours(targetHour24, targetMinute, 0, 0);

    const ampm = targetHour24 >= 12 ? "PM" : "AM";
    let h12 = targetHour24 % 12;
    if (h12 === 0) h12 = 12;

    setSelectedHour(String(h12).padStart(2, "0"));
    setSelectedMinute(String(targetMinute).padStart(2, "0"));
    setSelectedAmPm(ampm);
    setViewDate(d);
    onChange(d.toISOString());
  };

  const handleNextMonday = () => {
    const d = new Date();
    const currentDay = d.getDay();
    const daysUntilNextMon = ((1 + 7 - currentDay) % 7) || 7;
    d.setDate(d.getDate() + daysUntilNextMon);
    d.setHours(11, 0, 0, 0);

    setSelectedHour("11");
    setSelectedMinute("00");
    setSelectedAmPm("AM");
    setViewDate(d);
    onChange(d.toISOString());
  };

  const handleTimeChange = (newHour, newMin, newAmPm) => {
    setSelectedHour(newHour);
    setSelectedMinute(newMin);
    setSelectedAmPm(newAmPm);

    const baseDate = parsedDate || new Date();
    emitDateTime(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), newHour, newMin, newAmPm);
  };

  const formattedDisplay = formatFriendlyDateTime(value);

  const daysCells = [];

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    daysCells.push({
      day: daysInPrevMonth - i,
      isCurrentMonth: false,
      year: viewYear,
      month: viewMonth - 1
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    daysCells.push({
      day: d,
      isCurrentMonth: true,
      year: viewYear,
      month: viewMonth
    });
  }

  const remainingCells = (7 - (daysCells.length % 7)) % 7;
  for (let d = 1; d <= remainingCells; d++) {
    daysCells.push({
      day: d,
      isCurrentMonth: false,
      year: viewYear,
      month: viewMonth + 1
    });
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Clickable Formatted Trigger */}
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between rounded-md border bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs cursor-pointer select-none transition-all ${
          isOpen
            ? "border-amber-500 ring-2 ring-amber-500/20 shadow-xs"
            : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
          <span
            className={`truncate font-mono ${
              formattedDisplay
                ? "text-zinc-900 dark:text-zinc-100 font-medium"
                : "text-zinc-400 dark:text-zinc-500"
            }`}
          >
            {formattedDisplay || "Select meeting date & time..."}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              title="Clear date"
              className="p-0.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-[10px] text-zinc-400">▾</span>
        </div>
      </div>

      {/* Popover Floating Widget */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-[310px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-1 text-xs">
          {/* 1. Quick Presets Bar */}
          <div className="pb-2.5 mb-2.5 border-b border-zinc-100 dark:border-zinc-800">
            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Quick Shortcuts
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => handleApplyPreset(1, 10, 0)}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
              >
                ⚡ Tomorrow 10:00 AM
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(2, 14, 0)}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                ⚡ In 2 Days 02:00 PM
              </button>
              <button
                type="button"
                onClick={handleNextMonday}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                ⚡ Next Mon 11:00 AM
              </button>
            </div>
          </div>

          {/* 2. Month & Year Navigation */}
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs">
              {monthName} {viewYear}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                title="Previous month"
                className="p-1 rounded text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                title="Next month"
                className="p-1 rounded text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 3. Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] text-zinc-400 mb-1">
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
              <span key={d} className="py-0.5">
                {d}
              </span>
            ))}
          </div>

          {/* 4. Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center mb-3">
            {daysCells.map((cell, idx) => {
              const cellDate = new Date(cell.year, cell.month, cell.day);
              cellDate.setHours(0, 0, 0, 0);

              const isToday = cellDate.getTime() === today.getTime();
              const isSelected =
                parsedDate &&
                parsedDate.getFullYear() === cell.year &&
                parsedDate.getMonth() === cell.month &&
                parsedDate.getDate() === cell.day;
              const isPast = cellDate.getTime() < today.getTime();

              return (
                <button
                  key={`${cell.year}-${cell.month}-${cell.day}-${idx}`}
                  type="button"
                  disabled={!cell.isCurrentMonth}
                  onClick={() => handleSelectDay(cell.day)}
                  className={`h-7 w-7 mx-auto flex items-center justify-center rounded-md font-mono text-xs transition-colors ${
                    !cell.isCurrentMonth
                      ? "opacity-25 pointer-events-none text-zinc-400"
                      : isSelected
                      ? "bg-amber-600 dark:bg-amber-500 text-white font-bold shadow-xs"
                      : isToday
                      ? "border border-amber-500/80 text-amber-600 dark:text-amber-400 font-bold bg-amber-50/50 dark:bg-amber-950/30"
                      : isPast
                      ? "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* 5. Built-in Time Picker Row */}
          <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1 font-mono text-xs">
                <Clock className="w-3.5 h-3.5 text-zinc-400 mr-0.5 shrink-0" />
                <select
                  value={selectedHour}
                  onChange={(e) => handleTimeChange(e.target.value, selectedMinute, selectedAmPm)}
                  className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-1 py-1 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                >
                  {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map(
                    (h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    )
                  )}
                </select>

                <span>:</span>

                <select
                  value={selectedMinute}
                  onChange={(e) => handleTimeChange(selectedHour, e.target.value, selectedAmPm)}
                  className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-1 py-1 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                >
                  {["00", "15", "30", "45"].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() =>
                    handleTimeChange(selectedHour, selectedMinute, selectedAmPm === "AM" ? "PM" : "AM")
                  }
                  className="px-1.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                >
                  {selectedAmPm}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium shadow-xs transition-colors shrink-0"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContactDrawer({
  contact,
  onClose,
  onToggleFavorite,
  onUpdateTag,
  onUpdateNotes,
  onUpdateFollowUpDate,
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

  // ── Follow-Up Meeting & Reminder state ──
  const [followUpDateInput, setFollowUpDateInput] = useState("");
  const [followUpReasonInput, setFollowUpReasonInput] = useState("");
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [cancellingFollowUp, setCancellingFollowUp] = useState(false);

  // ── Activity History Timeline state ──
  const [activities, setActivities] = useState([]);
  const [quickNoteInput, setQuickNoteInput] = useState("");

  useEffect(() => {
    if (contact?.id) {
      try {
        const stored = localStorage.getItem(`scm_activities_${contact.id}`);
        const parsed = stored ? JSON.parse(stored) : [];
        setActivities(Array.isArray(parsed) ? parsed : []);
      } catch (_e) {
        setActivities([]);
      }
    } else {
      setActivities([]);
    }
  }, [contact?.id]);

  const logActivity = (type, title, meta) => {
    if (!contact?.id) return;
    const newActivity = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      title,
      meta,
      timestamp: new Date().toISOString()
    };
    setActivities((prev) => {
      const updated = [newActivity, ...prev];
      try {
        localStorage.setItem(`scm_activities_${contact.id}`, JSON.stringify(updated));
      } catch (_e) {}
      return updated;
    });
  };

  const handleAddQuickNote = (e) => {
    e?.preventDefault?.();
    if (!quickNoteInput.trim()) return;
    logActivity("QUICK_NOTE", "Interaction Note", quickNoteInput.trim());
    setQuickNoteInput("");
  };

  useEffect(() => {
    if (contact) {
      setFollowUpDateInput(contact.followUpDate || "");
      setFollowUpReasonInput(contact.followUpReason || "");
    } else {
      setFollowUpDateInput("");
      setFollowUpReasonInput("");
    }
  }, [contact?.id, contact?.followUpDate, contact?.followUpReason]);

  const handleSaveFollowUp = async () => {
    if (!followUpDateInput) return;
    setSavingFollowUp(true);
    try {
      let isoDateString = followUpDateInput;
      try {
        const d = new Date(followUpDateInput);
        if (!isNaN(d.getTime())) {
          isoDateString = d.toISOString();
        }
      } catch (_e) {}

      let userEmail = null;
      try {
        const storedProfile = localStorage.getItem("scm_user_profile");
        if (storedProfile) {
          const parsed = JSON.parse(storedProfile);
          if (parsed?.email) userEmail = parsed.email;
        }
      } catch (_) {}

      const payload = {
        followUpDate: isoDateString,
        followUpReason: followUpReasonInput.trim(),
        followUpFixedAt: new Date().toISOString(),
        followUpUrgentSent: false,
        userEmail: userEmail || undefined
      };

      if (onUpdateFollowUpDate) {
        await onUpdateFollowUpDate(contact, payload);
      } else {
        await contactApi.patch(contact.id, payload);
        onNotify?.({
          variant: "success",
          title: "Follow-up scheduled",
          detail: "Follow-up scheduled! Confirmation email sent via SCM Mail."
        });
      }
      logActivity(
        "MEETING_SCHEDULED",
        "Follow-Up Scheduled",
        `${formatFriendlyDateTime(isoDateString)}${payload.followUpReason ? ` • ${payload.followUpReason}` : ""}`
      );
    } catch (err) {
      onNotify?.({ variant: "error", ...parseRfc7807Error(err) });
    } finally {
      setSavingFollowUp(false);
    }
  };

  const handleOpenCancelModal = () => {
    setCancelReasonInput("");
    setCancelModalOpen(true);
  };

  const handleConfirmCancelFollowUp = async () => {
    if (!cancelReasonInput.trim()) return;
    setCancellingFollowUp(true);
    try {
      let userEmail = null;
      try {
        const storedProfile = localStorage.getItem("scm_user_profile");
        if (storedProfile) {
          const parsed = JSON.parse(storedProfile);
          if (parsed?.email) userEmail = parsed.email;
        }
      } catch (_) {}

      const originalDate = contact.followUpDate;
      const cancelReason = cancelReasonInput.trim();
      const payload = {
        clearFollowUp: true,
        cancelReason,
        originalFollowUpDate: originalDate,
        followUpDate: null,
        followUpReason: null,
        followUpFixedAt: null,
        followUpUrgentSent: false,
        userEmail: userEmail || undefined
      };

      setFollowUpDateInput("");
      setFollowUpReasonInput("");
      setCancelModalOpen(false);

      if (onUpdateFollowUpDate) {
        await onUpdateFollowUpDate(contact, payload);
      } else {
        await contactApi.patch(contact.id, payload);
        onNotify?.({
          variant: "success",
          title: "Follow-up cancelled",
          detail: "Cancellation notice dispatched to both participants."
        });
      }
      logActivity(
        "MEETING_CANCELLED",
        "Follow-Up Cancelled",
        `Reason: ${cancelReason}${originalDate ? ` • Scheduled was ${formatFriendlyDateTime(originalDate)}` : ""}`
      );
    } catch (err) {
      onNotify?.({ variant: "error", ...parseRfc7807Error(err) });
    } finally {
      setCancellingFollowUp(false);
    }
  };

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
      let senderName = "Smart Contact Manager";
      try {
        const storedProfile = localStorage.getItem("scm_user_profile");
        if (storedProfile) {
          const parsed = JSON.parse(storedProfile);
          if (parsed?.name && String(parsed.name).trim()) {
            senderName = String(parsed.name).trim();
          }
        }
      } catch (_) {}

      const recipientName = (contact?.name && String(contact.name).trim()) || "there";

      const result = await aiApi.draftEmail({
        contactName: recipientName,
        senderName,
        company: contact?.company || "",
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
      if (res) {
        setCarrierResult(res);
        logActivity(
          "CARRIER_VERIFIED",
          `Telecom line verified (${res.carrier || "Carrier"})`,
          `${res.lineType || "Mobile"} • ${res.attempts || 1} attempt(s)`
        );
      }
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
      const sentSubject = emailSubject.trim() || `Message from SCM for ${contact.name}`;
      const res = await notificationApi.sendEmail({
        to: contact.email,
        subject: sentSubject,
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
      logActivity(
        "EMAIL_SENT",
        "Email Dispatched",
        `Subject: "${sentSubject}" • Dispatched to ${contact.email}`
      );
      setEmailOpen(false);
      setEmailSubject("");
      setEmailBody("");
    } catch (err) {
      onNotify?.({ variant: "error", ...parseRfc7807Error(err) });
    } finally {
      setEmailSending(false);
    }
  };

  const safeActivities = Array.isArray(activities) ? activities : [];
  const allTimelineEvents = [
    ...safeActivities,
    ...(carrierResult && !safeActivities.some((a) => a.type === "CARRIER_VERIFIED")
      ? [
          {
            id: "evt-carrier",
            type: "CARRIER_VERIFIED",
            title: `Telecom line verified (${carrierResult.carrier || "Carrier"})`,
            meta: `${carrierResult.lineType || "Mobile"} • ${carrierResult.attempts || 1} attempt(s)`,
            timestamp: new Date().toISOString()
          }
        ]
      : []),
    ...(contact?.updatedAt
      ? [
          {
            id: "evt-updated",
            type: "PROFILE_UPDATED",
            title: "Contact profile synced",
            meta: `Updated record #${contact.id}`,
            timestamp: contact.updatedAt
          }
        ]
      : []),
    ...(contact?.createdAt
      ? [
          {
            id: "evt-created",
            type: "PROFILE_CREATED",
            title: "Added to workspace directory",
            meta: `Source: ${contact.company || "Direct entry"}`,
            timestamp: contact.createdAt
          }
        ]
      : [])
  ].sort((a, b) => {
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    return timeB - timeA;
  });

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
            <button
              type="button"
              onClick={() => downloadVCard(contact, onNotify)}
              title="Download vCard (.vcf)"
              className="p-1.5 rounded-md text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
            >
              <Download className="w-3.5 h-3.5" />
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
            <div className="mt-4 grid grid-cols-5 gap-1.5">
              <button
                type="button"
                onClick={() => handleCopy(contact.phoneNumber, "Phone")}
                className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
              >
                {copiedField === "Phone" ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                )}
                <span className="text-[10px]">
                  {copiedField === "Phone" ? "Copied" : "Copy"}
                </span>
              </button>

              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  logActivity(
                    "WHATSAPP_INITIATED",
                    "WhatsApp Chat Initiated",
                    `Opened WhatsApp chat with ${contact.phoneNumber}`
                  );
                }}
                className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-200 dark:hover:border-emerald-800/60 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[10px]">WhatsApp</span>
              </a>

              <a
                href={telHref}
                onClick={() => {
                  logActivity(
                    "CALL_INITIATED",
                    "Phone Call Initiated",
                    `Dialed ${contact.phoneNumber}`
                  );
                }}
                className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
              >
                <PhoneCall className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-[10px]">Call</span>
              </a>

              <button
                type="button"
                disabled={!hasEmail}
                onClick={() => hasEmail && setEmailOpen((prev) => !prev)}
                title={hasEmail ? (emailOpen ? "Close email composer" : "Compose email") : "No email address saved for this contact"}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg border text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98] ${
                  !hasEmail
                    ? "opacity-50 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-800 text-zinc-400"
                    : emailOpen
                    ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                    : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <Mail className={`w-3.5 h-3.5 ${hasEmail && emailOpen ? "text-emerald-500" : "text-zinc-400"}`} />
                <span className="text-[10px]">Email</span>
              </button>

              <button
                type="button"
                onClick={() => downloadVCard(contact, onNotify)}
                title="Download vCard (.vcf) directly into phone contacts"
                className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
              >
                <Download className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-[10px]">vCard</span>
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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAiDraftOpen((prev) => !prev)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/40 hover:bg-emerald-200/80 dark:hover:bg-emerald-800/60 transition-colors"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>{aiDraftOpen ? "Close AI" : "✨ Draft with AI"}</span>
                    </button>
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
                </div>

                {!hasEmail ? (
                  <div className="flex items-center gap-2 p-3 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-md">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>This contact does not have an email address. Add an email in Edit Contact to send messages.</span>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1 bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-md border border-zinc-200 dark:border-zinc-700/60 text-[11px] font-mono">
                      <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                        <span><strong className="text-zinc-700 dark:text-zinc-300">From:</strong> "Smart Contact Manager" &lt;scm.project.12@gmail.com&gt;</span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                        <span className="truncate"><strong className="text-zinc-700 dark:text-zinc-300">To:</strong> {contact.name ? `${contact.name} <${contact.email}>` : contact.email}</span>
                      </div>
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

                    <div>
                      <input
                        type="text"
                        placeholder="Subject"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-emerald-400 dark:focus:border-emerald-600 focus:outline-none"
                      />
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

            {/* Follow-up Meeting & Reminder Scheduler */}
            <div className="py-2.5 border-t border-zinc-100 dark:border-zinc-800/60 mt-1 pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  <span>Follow-Up Meeting & Reminder</span>
                </span>
                {contact.followUpDate && (
                  <button
                    type="button"
                    onClick={handleOpenCancelModal}
                    title="Cancel scheduled follow-up meeting"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-500" />
                    <span>Cancel Follow-up</span>
                  </button>
                )}
              </div>

              <div className="space-y-2.5 bg-zinc-50/70 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800">
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                    Meeting Date & Time (IST)
                  </label>
                  <MiniCalendarPicker
                    value={followUpDateInput}
                    onChange={(val) => setFollowUpDateInput(val)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                    Why is this meeting fixed? (Agenda / Purpose)
                  </label>
                  <input
                    type="text"
                    value={followUpReasonInput}
                    onChange={(e) => setFollowUpReasonInput(e.target.value)}
                    placeholder="e.g. Q4 Contract Review & budget discussion"
                    className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-amber-400 dark:focus:border-amber-600 focus:outline-none"
                  />
                </div>

                <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 rounded-md p-2 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-300">
                    <span className="font-semibold text-amber-800 dark:text-amber-300">👥 Meeting Participants (Gmail 465 SSL Dual-Alert):</span>
                  </div>
                  <div className="text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                    <span><strong>Organizer:</strong> Account Owner</span>
                    <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">Host (Alert Recipient)</span>
                  </div>
                  <div className="text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                    <span className="truncate max-w-[200px]"><strong>Partner:</strong> {contact.name}</span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      {contact.email ? contact.email : "No email (Host only)"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate max-w-[190px]">
                    {contact.followUpDate ? "Confirmation email sent on save" : "Auto-dispatches Gmail confirmation"}
                  </span>
                  <button
                    type="button"
                    disabled={!followUpDateInput || savingFollowUp}
                    onClick={handleSaveFollowUp}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-medium shadow-sm transition-all active:scale-[0.98]"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{savingFollowUp ? "Saving..." : "Save Reminder"}</span>
                  </button>
                </div>
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

          {/* Activity & Interaction History Timeline */}
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                <span>Activity &amp; Interaction History</span>
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

            {/* Quick Note Input Form */}
            <form onSubmit={handleAddQuickNote} className="flex items-center gap-1.5">
              <input
                type="text"
                value={quickNoteInput}
                onChange={(e) => setQuickNoteInput(e.target.value)}
                placeholder="Log a call, meeting note, or quick update..."
                className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!quickNoteInput.trim()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-xs active:scale-[0.98]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Note</span>
              </button>
            </form>

            {/* Timeline Stream */}
            {allTimelineEvents.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-400 dark:text-zinc-500 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
                No logged interactions yet. Scheduled meetings, dispatched emails, calls, or quick notes will appear here.
              </div>
            ) : (
              <div className="relative pl-5 space-y-4 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-zinc-200 dark:before:bg-zinc-800">
                {allTimelineEvents.map((ev) => {
                  const badge = getActivityBadge(ev.type) || {};
                  const Icon = badge.icon || Clock;
                  return (
                    <div key={ev.id} className="relative text-xs group">
                      <span
                        className={`absolute -left-5 top-0.5 flex items-center justify-center w-5 h-5 rounded-full ring-4 ring-white dark:ring-zinc-900 ${badge.accent || "bg-zinc-500"} text-white shadow-xs`}
                      >
                        <Icon className="w-2.5 h-2.5" />
                      </span>
                      <div className="flex items-center justify-between gap-2 pl-2">
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {ev.title}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-400 shrink-0">
                          {formatTimelineDate(ev.timestamp)}
                        </span>
                      </div>
                      {ev.meta && (
                        <p className="pl-2 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono break-words">
                          {ev.meta}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 🛑 Cancellation Confirmation Modal */}
      {cancelModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => !cancellingFollowUp && setCancelModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-zinc-900 shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Cancel Follow-Up Meeting
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Why is this follow-up being cancelled? A cancellation notice will be emailed to both participants.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Please provide a reason for cancelling this meeting with <span className="font-semibold">{contact.name}</span>:
              </label>
              <textarea
                rows={3}
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                placeholder="e.g. Client rescheduled to next month / Issue resolved over phone / Conflict with personal schedule"
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-rose-500 dark:focus:border-rose-500 focus:outline-none resize-none"
                autoFocus
              />

              {/* Quick suggestion tags */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  "Client rescheduled to next month",
                  "Issue resolved over phone",
                  "Conflict with personal schedule",
                  "Meeting no longer required"
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setCancelReasonInput(reason)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700"
                  >
                    + {reason}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                disabled={cancellingFollowUp}
                onClick={() => setCancelModalOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
              >
                Keep Meeting
              </button>
              <button
                type="button"
                disabled={!cancelReasonInput.trim() || cancellingFollowUp}
                onClick={handleConfirmCancelFollowUp}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 rounded-md shadow-sm transition-all"
              >
                {cancellingFollowUp ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancel Meeting</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
