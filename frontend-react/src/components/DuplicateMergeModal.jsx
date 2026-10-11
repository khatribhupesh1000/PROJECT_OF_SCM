import React, { useEffect, useState } from "react";
import { X, Merge, Check, ArrowRight, UserCheck } from "lucide-react";
import { formatPhoneWithFlag, inferContactTag } from "../services/api.js";
import { getTagBadgeStyle } from "./ContactDrawer.jsx";

export default function DuplicateMergeModal({
  isOpen,
  pair,
  onClose,
  onMerge,
  merging = false
}) {
  if (!isOpen || !pair) return null;

  const { primary, duplicate, reason } = pair;

  const [selectedName, setSelectedName] = useState(primary.name || "");
  const [selectedEmail, setSelectedEmail] = useState(primary.email || duplicate.email || "");
  const [selectedPhone, setSelectedPhone] = useState(primary.phoneNumber || duplicate.phoneNumber || "");
  const [selectedCompany, setSelectedCompany] = useState(primary.company || duplicate.company || "");
  const [selectedAddress, setSelectedAddress] = useState(primary.address || duplicate.address || "");
  const [selectedTag, setSelectedTag] = useState(primary.tag || duplicate.tag || "Colleague");
  const [combineNotes, setCombineNotes] = useState(true);
  const [customNotes, setCustomNotes] = useState("");

  // Re-sync state when pair changes
  useEffect(() => {
    if (primary && duplicate) {
      setSelectedName(primary.name || duplicate.name || "");
      setSelectedEmail(primary.email || duplicate.email || "");
      setSelectedPhone(primary.phoneNumber || duplicate.phoneNumber || "");
      setSelectedCompany(primary.company || duplicate.company || "");
      setSelectedAddress(primary.address || duplicate.address || "");
      setSelectedTag(primary.tag || duplicate.tag || "Colleague");

      const n1 = (primary.description || "").trim();
      const n2 = (duplicate.description || "").trim();
      if (n1 && n2 && n1 !== n2) {
        setCustomNotes(`${n1}\n---\n[Merged from ${duplicate.name}]: ${n2}`);
      } else {
        setCustomNotes(n1 || n2 || "");
      }
    }
  }, [primary, duplicate]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !merging) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, merging]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalDescription = combineNotes
      ? customNotes
      : primary.description || duplicate.description || "";

    const mergedPayload = {
      name: selectedName.trim(),
      email: selectedEmail.trim() || null,
      phoneNumber: selectedPhone.trim(),
      company: selectedCompany.trim() || null,
      address: selectedAddress.trim() || null,
      tag: selectedTag || "Colleague",
      description: finalDescription.trim() || null,
      favorite: Boolean(primary.favorite || duplicate.favorite),
      followUpDate: primary.followUpDate || duplicate.followUpDate || null,
      websiteLink: primary.websiteLink || duplicate.websiteLink || null,
      linkedInLink: primary.linkedInLink || duplicate.linkedInLink || null,
      pictureUrl: primary.pictureUrl || duplicate.pictureUrl || null
    };

    onMerge({
      primaryId: primary.id,
      duplicateId: duplicate.id,
      mergedPayload
    });
  };

  const primaryPhoneInfo = formatPhoneWithFlag(primary.phoneNumber);
  const duplicatePhoneInfo = formatPhoneWithFlag(duplicate.phoneNumber);
  const primaryTag = inferContactTag(primary);
  const duplicateTag = inferContactTag(duplicate);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !merging) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/80 flex items-center justify-center text-amber-700 dark:text-amber-300">
              <Merge className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Smart Duplicate Detector & Merge
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Detected duplicate via {reason || "matching credentials"}. Select values to keep.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={merging}
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Comparison & Field Selection Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Side-by-Side Summary Cards */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/30">
            {/* Primary Record */}
            <div className="space-y-1.5 p-2.5 rounded-md border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase font-semibold text-emerald-700 dark:text-emerald-400">
                  Record 1 (Primary)
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${getTagBadgeStyle(primaryTag)}`}>
                  {primaryTag}
                </span>
              </div>
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{primary.name}</div>
              <div className="font-mono text-zinc-600 dark:text-zinc-400 text-[11px] truncate">
                {primaryPhoneInfo.flag} {primaryPhoneInfo.formatted}
              </div>
              <div className="text-zinc-500 dark:text-zinc-400 truncate">{primary.email || "No email"}</div>
              {primary.company && <div className="text-zinc-500 truncate">{primary.company}</div>}
            </div>

            {/* Duplicate Record */}
            <div className="space-y-1.5 p-2.5 rounded-md border border-amber-200 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase font-semibold text-amber-700 dark:text-amber-400">
                  Record 2 (Will be deleted)
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${getTagBadgeStyle(duplicateTag)}`}>
                  {duplicateTag}
                </span>
              </div>
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{duplicate.name}</div>
              <div className="font-mono text-zinc-600 dark:text-zinc-400 text-[11px] truncate">
                {duplicatePhoneInfo.flag} {duplicatePhoneInfo.formatted}
              </div>
              <div className="text-zinc-500 dark:text-zinc-400 truncate">{duplicate.email || "No email"}</div>
              {duplicate.company && <div className="text-zinc-500 truncate">{duplicate.company}</div>}
            </div>
          </div>

          {/* Field Selection Options */}
          <div className="space-y-3 pt-1">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              Select details for the merged contact:
            </div>

            {/* Choose Name */}
            <div className="space-y-1">
              <label className="text-zinc-600 dark:text-zinc-400 font-medium">Name</label>
              <div className="grid grid-cols-2 gap-2">
                {[primary.name, duplicate.name].filter(Boolean).map((val, idx) => (
                  <button
                    key={`${val}-${idx}`}
                    type="button"
                    onClick={() => setSelectedName(val)}
                    className={`flex items-center justify-between px-3 py-2 rounded-md border text-left transition-all ${
                      selectedName === val
                        ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-medium"
                        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <span className="truncate">{val}</span>
                    {selectedName === val && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Choose Email */}
            {(primary.email || duplicate.email) && (
              <div className="space-y-1">
                <label className="text-zinc-600 dark:text-zinc-400 font-medium">Email</label>
                <div className="grid grid-cols-2 gap-2">
                  {Array.from(new Set([primary.email, duplicate.email].filter(Boolean))).map((val, idx) => (
                    <button
                      key={`${val}-${idx}`}
                      type="button"
                      onClick={() => setSelectedEmail(val)}
                      className={`flex items-center justify-between px-3 py-2 rounded-md border text-left font-mono text-[11px] transition-all ${
                        selectedEmail === val
                          ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-medium"
                          : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      <span className="truncate">{val}</span>
                      {selectedEmail === val && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Choose Phone */}
            <div className="space-y-1">
              <label className="text-zinc-600 dark:text-zinc-400 font-medium">Phone Number</label>
              <div className="grid grid-cols-2 gap-2">
                {Array.from(new Set([primary.phoneNumber, duplicate.phoneNumber].filter(Boolean))).map((val, idx) => (
                  <button
                    key={`${val}-${idx}`}
                    type="button"
                    onClick={() => setSelectedPhone(val)}
                    className={`flex items-center justify-between px-3 py-2 rounded-md border text-left font-mono text-[11px] transition-all ${
                      selectedPhone === val
                        ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-medium"
                        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <span className="truncate">{val}</span>
                    {selectedPhone === val && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Combine Notes / Description */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-zinc-600 dark:text-zinc-400 font-medium">Notes & Context</label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-zinc-500 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={combineNotes}
                    onChange={(e) => setCombineNotes(e.target.checked)}
                    className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Combine notes from both contacts</span>
                </label>
              </div>
              {combineNotes ? (
                <textarea
                  rows={3}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:border-emerald-400 dark:focus:border-emerald-600 focus:outline-none resize-none font-mono"
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomNotes(primary.description || "")}
                    className="p-2 rounded-md border border-zinc-200 dark:border-zinc-800 text-left text-zinc-700 dark:text-zinc-300 truncate"
                  >
                    {primary.description || "No notes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomNotes(duplicate.description || "")}
                    className="p-2 rounded-md border border-zinc-200 dark:border-zinc-800 text-left text-zinc-700 dark:text-zinc-300 truncate"
                  >
                    {duplicate.description || "No notes"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={merging}
              onClick={onClose}
              className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Dismiss
            </button>
            <button
              type="submit"
              disabled={merging || !selectedName.trim() || !selectedPhone.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50 active:scale-[0.98]"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{merging ? "Merging Contacts..." : "Merge Contacts"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
