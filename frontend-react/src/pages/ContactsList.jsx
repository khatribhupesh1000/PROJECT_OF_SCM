import React, { useEffect, useRef, useState } from "react";
import {
  Search,
  Star,
  Plus,
  Copy,
  Check,
  MessageCircle,
  Mail,
  Edit3,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Clock,
  Merge,
  Shield,
  ShieldCheck,
  FileText,
  ChevronDown
} from "lucide-react";
import ContactModal from "../components/ContactModal.jsx";
import ContactDrawer, { getTagBadgeStyle } from "../components/ContactDrawer.jsx";
import DuplicateMergeModal from "../components/DuplicateMergeModal.jsx";
import { formatPhoneForWhatsApp } from "../components/CallWhatsAppActions.jsx";
import {
  contactApi,
  parseRfc7807Error,
  formatPhoneWithFlag,
  getInitials,
  inferContactTag,
  formatShortDate,
  downloadVCard,
  getFollowUpStatus,
  maskPhoneNumber,
  maskEmailAddress,
  exportContactsToCsv,
  exportContactsToPdf
} from "../services/api.js";

const SEGMENT_TABS = [
  { id: "ALL", label: "All Contacts" },
  { id: "FAVORITES", label: "Favorites" },
  { id: "FOLLOW_UPS", label: "⏰ Follow-ups" },
  { id: "VIP", label: "VIP" },
  { id: "Colleague", label: "Colleague" },
  { id: "Lead", label: "Lead" },
  { id: "Family", label: "Family" }
];

export default function ContactsList({
  onNotify,
  externalNewTrigger,
  externalTagFilter,
  externalFavTrigger,
  selectedFromPalette,
  onContactsLoaded
}) {
  const [contacts, setContacts] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeSegment, setActiveSegment] = useState("ALL");
  const [cursorHistory, setCursorHistory] = useState([null]);
  const [currentCursor, setCurrentCursor] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [inspectedContact, setInspectedContact] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [selectedDuplicatePair, setSelectedDuplicatePair] = useState(null);
  const [mergingDuplicates, setMergingDuplicates] = useState(false);
  const [dismissedDuplicates, setDismissedDuplicates] = useState(false);

  // Privacy Safe Demo Mode & Export state
  const [demoMaskEnabled, setDemoMaskEnabled] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [maskExportSetting, setMaskExportSetting] = useState(false);
  const exportMenuRef = useRef(null);

  const searchInputRef = useRef(null);
  const fetchSeqRef = useRef(0);

  // Close export dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setExportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scan loaded contacts for duplicate normalized phone numbers or emails
  const duplicatePairs = React.useMemo(() => {
    const pairs = [];
    const seenPhone = new Map();
    const seenEmail = new Map();

    for (const c of contacts) {
      const rawDigits = (c.phoneNumber || "").replace(/\D/g, "");
      const phoneKey = rawDigits.length >= 10 ? rawDigits.slice(-10) : rawDigits;
      const emailKey = (c.email || "").trim().toLowerCase();

      let match = null;
      let reason = "";

      if (phoneKey && phoneKey.length >= 7) {
        if (seenPhone.has(phoneKey)) {
          match = seenPhone.get(phoneKey);
          reason = "same phone number";
        } else {
          seenPhone.set(phoneKey, c);
        }
      }

      if (!match && emailKey) {
        if (seenEmail.has(emailKey)) {
          match = seenEmail.get(emailKey);
          reason = "same email address";
        } else {
          seenEmail.set(emailKey, c);
        }
      }

      if (match && match.id !== c.id) {
        pairs.push({ primary: match, duplicate: c, reason });
      }
    }
    return pairs;
  }, [contacts]);

  // Filter contacts client-side for Follow-ups tab
  const displayedContacts = React.useMemo(() => {
    if (activeSegment === "FOLLOW_UPS") {
      return contacts.filter((c) => Boolean(c.followUpDate));
    }
    return contacts;
  }, [contacts, activeSegment]);

  // Respond to Command Palette or Navbar triggers
  useEffect(() => {
    if (externalNewTrigger > 0) {
      setEditingContact(null);
      setModalOpen(true);
    }
  }, [externalNewTrigger]);

  useEffect(() => {
    if (externalTagFilter) {
      setActiveSegment(externalTagFilter);
      setCurrentCursor(null);
      setCursorHistory([null]);
    }
  }, [externalTagFilter]);

  useEffect(() => {
    if (externalFavTrigger > 0) {
      setActiveSegment((prev) => (prev === "FAVORITES" ? "ALL" : "FAVORITES"));
      setCurrentCursor(null);
      setCursorHistory([null]);
    }
  }, [externalFavTrigger]);

  useEffect(() => {
    if (selectedFromPalette) {
      setInspectedContact(selectedFromPalette);
    }
  }, [selectedFromPalette]);

  // Global keyboard shortcuts: '/' to focus search, 'N' to create contact, 'Escape' to clear search
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        document.activeElement?.isContentEditable;

      if (e.key === "/" && !isTyping && !modalOpen) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if ((e.key === "n" || e.key === "N") && !isTyping && !modalOpen && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setEditingContact(null);
        setModalOpen(true);
      } else if (e.key === "Escape" && !modalOpen && !inspectedContact) {
        if (searchInput) {
          setSearchInput("");
          setDebouncedSearch("");
        }
        if (activeSegment !== "ALL") {
          setActiveSegment("ALL");
        }
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchInput, activeSegment, modalOpen, inspectedContact]);

  // Debounce search (180ms for snappy feel)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentCursor(null);
      setCursorHistory([null]);
    }, 180);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchContacts = async (cursorToUse = currentCursor) => {
    const reqSeq = ++fetchSeqRef.current;
    setLoading(true);
    try {
      const favoriteParam = activeSegment === "FAVORITES" ? true : null;
      const tagParam =
        activeSegment !== "ALL" && activeSegment !== "FAVORITES" && activeSegment !== "FOLLOW_UPS"
          ? activeSegment
          : null;

      const result = await contactApi.list({
        cursor: cursorToUse,
        limit: 15,
        search: debouncedSearch,
        favorite: favoriteParam,
        tag: tagParam
      });

      if (reqSeq !== fetchSeqRef.current) return;

      const list = result.data || [];
      setContacts(list);
      setNextCursor(result.nextCursor || null);
      setHasMore(Boolean(result.hasMore));
      setTotalCount(result.totalCount ?? list.length);
      onContactsLoaded?.(list);

      if (inspectedContact) {
        const refreshed = list.find((c) => c.id === inspectedContact.id);
        if (refreshed) setInspectedContact(refreshed);
      }
    } catch (err) {
      if (reqSeq !== fetchSeqRef.current) return;
      onNotify({ variant: "error", ...parseRfc7807Error(err) });
    } finally {
      if (reqSeq === fetchSeqRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchContacts(currentCursor);
  }, [debouncedSearch, activeSegment, currentCursor]);

  const handleToggleFavorite = async (contact, e) => {
    e?.stopPropagation?.();
    try {
      const updated = await contactApi.patch(contact.id, {
        favorite: !contact.favorite
      });
      setContacts((prev) => prev.map((c) => (c.id === contact.id ? updated : c)));
      if (inspectedContact?.id === contact.id) {
        setInspectedContact(updated);
      }
      onNotify({
        variant: "success",
        title: updated.favorite ? "Added to favorites" : "Removed from favorites",
        detail: updated.name
      });
    } catch (err) {
      onNotify({ variant: "error", ...parseRfc7807Error(err) });
    }
  };

  const handleUpdateTag = async (contact, newTag) => {
    try {
      const updated = await contactApi.patch(contact.id, { tag: newTag });
      setContacts((prev) => prev.map((c) => (c.id === contact.id ? updated : c)));
      if (inspectedContact?.id === contact.id) {
        setInspectedContact(updated);
      }
      onNotify({
        variant: "success",
        title: "Segment updated",
        detail: `${updated.name} tagged as ${newTag}`
      });
    } catch (err) {
      onNotify({ variant: "error", ...parseRfc7807Error(err) });
    }
  };

  const handleUpdateNotes = async (contact, nextDescription) => {
    try {
      const updated = await contactApi.patch(contact.id, {
        description: nextDescription
      });
      setContacts((prev) => prev.map((c) => (c.id === contact.id ? updated : c)));
      if (inspectedContact?.id === contact.id) {
        setInspectedContact(updated);
      }
      onNotify({
        variant: "success",
        title: "Notes saved",
        detail: `Updated notes for ${updated.name}`
      });
    } catch (err) {
      onNotify({ variant: "error", ...parseRfc7807Error(err) });
    }
  };

  const handleUpdateFollowUpDate = async (contact, followUpData) => {
    try {
      const payload =
        typeof followUpData === "object" && followUpData !== null
          ? followUpData
          : { followUpDate: followUpData };
      const updated = await contactApi.patch(contact.id, payload);
      setContacts((prev) => prev.map((c) => (c.id === contact.id ? updated : c)));
      if (inspectedContact?.id === contact.id) {
        setInspectedContact(updated);
      }
      onNotify({
        variant: "success",
        title: payload.followUpDate ? "Follow-up scheduled" : "Follow-up cleared",
        detail: payload.followUpDate
          ? "Follow-up scheduled! Confirmation email sent via SCM Mail."
          : `Reminder removed for ${updated.name}`
      });
    } catch (err) {
      onNotify({ variant: "error", ...parseRfc7807Error(err) });
    }
  };

  const handleMergeDuplicates = async ({ primaryId, duplicateId, mergedPayload }) => {
    setMergingDuplicates(true);
    try {
      const updated = await contactApi.update(primaryId, mergedPayload);
      await contactApi.remove(duplicateId);

      setContacts((prev) =>
        prev
          .map((c) => (c.id === primaryId ? updated : c))
          .filter((c) => c.id !== duplicateId)
      );
      if (inspectedContact?.id === duplicateId) {
        setInspectedContact(updated);
      } else if (inspectedContact?.id === primaryId) {
        setInspectedContact(updated);
      }
      setSelectedDuplicatePair(null);
      onNotify({
        variant: "success",
        title: "Contacts merged successfully!",
        detail: `${mergedPayload.name} updated; duplicate entry removed.`
      });
      await fetchContacts(currentCursor);
    } catch (err) {
      onNotify({ variant: "error", ...parseRfc7807Error(err) });
    } finally {
      setMergingDuplicates(false);
    }
  };

  const handleDelete = async (id, e) => {
    e?.stopPropagation?.();
    const target = contacts.find((c) => c.id === id);
    const confirmed = window.confirm(
      `Are you sure you want to delete ${target?.name || "this contact"}?`
    );
    if (!confirmed) return;

    // Optimistically remove from state immediately
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setTotalCount((prev) => Math.max(0, prev - 1));
    if (inspectedContact?.id === id) setInspectedContact(null);

    try {
      await contactApi.remove(id);
      onNotify({
        variant: "success",
        title: "Contact deleted",
        detail: target ? `${target.name} removed from directory.` : `Removed ${id}.`
      });
      await fetchContacts(currentCursor);
    } catch (err) {
      if (err?.response?.status === 404) {
        // Already deleted on server — refresh list cleanly
        await fetchContacts(currentCursor);
        return;
      }
      onNotify({ variant: "error", ...parseRfc7807Error(err) });
      await fetchContacts(currentCursor);
    }
  };

  const handleSaveModal = async (payload) => {
    try {
      if (editingContact) {
        const updated = await contactApi.update(editingContact.id, payload);
        setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        if (inspectedContact?.id === updated.id) setInspectedContact(updated);
        onNotify({
          variant: "success",
          title: "Contact updated",
          detail: `${updated.name} changes saved to MySQL.`
        });
      } else {
        const created = await contactApi.create(payload);
        setContacts((prev) => [created, ...prev]);
        setTotalCount((prev) => prev + 1);
        onNotify({
          variant: "success",
          title: "Contact created",
          detail: `${created.name} added to MySQL directory.`
        });
      }
      await fetchContacts(currentCursor);
    } catch (err) {
      onNotify({ variant: "error", ...parseRfc7807Error(err) });
      throw err;
    }
  };

  const handleSoapVerify = async (contact) => {
    try {
      const res = await contactApi.verifyPhoneViaSoap(contact.phoneNumber);
      onNotify({
        variant: "success",
        title: `Carrier verified: ${res.carrier}`,
        detail: `${res.phoneNumber} (${res.lineType})`
      });
      return res;
    } catch (err) {
      onNotify({ variant: "error", ...parseRfc7807Error(err) });
      return null;
    }
  };

  const handleQuickCopyPhone = (contact, e) => {
    e?.stopPropagation?.();
    navigator.clipboard?.writeText(contact.phoneNumber);
    setCopiedId(contact.id);
    onNotify({
      variant: "success",
      title: "Copied to clipboard",
      detail: `${contact.name}: ${contact.phoneNumber}`
    });
    setTimeout(() => setCopiedId(null), 1600);
  };

  const handleExport = (format = "csv", forceMask = null) => {
    const isMasked = forceMask !== null ? forceMask : (maskExportSetting || demoMaskEnabled);
    if (format === "csv") {
      exportContactsToCsv(contacts, isMasked);
      onNotify({
        variant: "success",
        title: isMasked ? "Safe Demo CSV Exported" : "Directory Exported",
        detail: `Downloaded ${contacts.length} contacts ${isMasked ? "with masked PII" : "as CSV"}.`
      });
    } else if (format === "pdf") {
      exportContactsToPdf(contacts, isMasked);
      onNotify({
        variant: "success",
        title: isMasked ? "Safe Demo PDF Exported" : "Directory PDF Opened",
        detail: `Opened printable directory for ${contacts.length} contacts ${isMasked ? "(PII Masked)" : ""}.`
      });
    }
    setExportMenuOpen(false);
  };

  const handleNextPage = () => {
    if (!nextCursor) return;
    setCursorHistory((prev) => [...prev, nextCursor]);
    setCurrentCursor(nextCursor);
  };

  const handlePrevPage = () => {
    if (cursorHistory.length <= 1) return;
    const nextHist = cursorHistory.slice(0, -1);
    setCursorHistory(nextHist);
    setCurrentCursor(nextHist[nextHist.length - 1]);
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Contacts
          </h1>
          <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
            {totalCount} {totalCount === 1 ? "record" : "records"}
          </span>
          {demoMaskEnabled && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 animate-in fade-in">
              <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Demo Mode Active (PII Masked)</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Privacy Safe Demo Mode Toggle */}
          <button
            type="button"
            onClick={() => {
              const nextState = !demoMaskEnabled;
              setDemoMaskEnabled(nextState);
              onNotify({
                variant: "info",
                title: nextState ? "Demo Mode Activated" : "Demo Mode Deactivated",
                detail: nextState
                  ? "Sensitive phone numbers & emails are masked on-screen for safe presentation."
                  : "Showing original contact phone numbers and emails."
              });
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98] ${
              demoMaskEnabled
                ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20"
                : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/80"
            }`}
            title="Toggle Privacy Mask for Live Presentation / Screen Share"
          >
            {demoMaskEnabled ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Shield className="w-3.5 h-3.5 text-zinc-400" />
            )}
            <span>{demoMaskEnabled ? "Demo Mode (Masked)" : "Demo Mode"}</span>
          </button>

          {/* Export Dropdown with Safe Demo Options */}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setExportMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
            >
              <Download className="w-3.5 h-3.5 text-zinc-400" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3 text-zinc-400 ml-0.5" />
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-64 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg py-1.5 z-30 animate-in fade-in slide-in-from-top-1 text-xs">
                <div className="px-3 py-1.5 font-semibold text-zinc-500 dark:text-zinc-400 text-[11px] uppercase tracking-wider">
                  Export Directory
                </div>
                
                <button
                  type="button"
                  onClick={() => handleExport("csv", false)}
                  className="w-full text-left px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-zinc-400" />
                  <div>
                    <div className="font-medium">Export CSV (Standard)</div>
                    <div className="text-[10px] text-zinc-400">All original contact details</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleExport("csv", true)}
                  className="w-full text-left px-3 py-2 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-2 transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <div className="font-medium">Export Safe Demo CSV</div>
                    <div className="text-[10px] text-zinc-400">Mask phone numbers & emails</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleExport("pdf", demoMaskEnabled || maskExportSetting)}
                  className="w-full text-left px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors border-b border-zinc-100 dark:border-zinc-800"
                >
                  <FileText className="w-3.5 h-3.5 text-zinc-400" />
                  <div>
                    <div className="font-medium">Export PDF (Print / Save)</div>
                    <div className="text-[10px] text-zinc-400">
                      {demoMaskEnabled || maskExportSetting ? "Safe masked format" : "Standard printable table"}
                    </div>
                  </div>
                </button>

                <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-zinc-600 dark:text-zinc-400">
                    <input
                      type="checkbox"
                      checked={maskExportSetting}
                      onChange={(e) => setMaskExportSetting(e.target.checked)}
                      className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                    />
                    <span>Mask sensitive PII by default</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingContact(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Contact</span>
            <kbd className="ml-1 px-1 py-0.2 text-[10px] font-mono bg-emerald-700/80 text-emerald-100 rounded">
              N
            </kbd>
          </button>
        </div>
      </div>

      {/* ⚠️ Discreet Smart Duplicate Detector Top Banner */}
      {!dismissedDuplicates && duplicatePairs.length > 0 && (
        <div className="mb-3.5 p-3 rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50/90 dark:bg-amber-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-base shrink-0">⚠️</span>
            <span>
              <strong>{duplicatePairs.length} duplicate contact{duplicatePairs.length > 1 ? "s" : ""} detected</strong>
              {" "}(e.g., <span className="font-semibold">{duplicatePairs[0].primary.name}</span> and <span className="font-semibold">{duplicatePairs[0].duplicate.name}</span> share the {duplicatePairs[0].reason}).
            </span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setSelectedDuplicatePair(duplicatePairs[0])}
              className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
            >
              Review &amp; Merge
            </button>
            <button
              type="button"
              onClick={() => setDismissedDuplicates(true)}
              className="p-1 text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 text-xs rounded hover:bg-amber-100 dark:hover:bg-amber-900/50"
              title="Dismiss alert"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Linear/Supabase Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-3">
        {/* Segment Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          {SEGMENT_TABS.map((tab) => {
            const active = activeSegment === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveSegment(tab.id);
                  setCurrentCursor(null);
                  setCursorHistory([null]);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98] ${
                  active
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-900"
                }`}
              >
                {tab.id === "FAVORITES" && (
                  <Star className={`w-3 h-3 ${active ? "fill-current" : ""}`} />
                )}
                {tab.id === "FOLLOW_UPS" && (
                  <Clock className="w-3 h-3 text-amber-500" />
                )}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Inline Instant Filter Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Filter by name, email, role..."
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-8 pr-12 py-1 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 shadow-sm focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400/30"
          />
          {searchInput ? (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-2 top-1.5 px-1 text-[10px] font-mono text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 rounded"
            >
              ESC
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2 top-1.5 px-1.5 text-[10px] font-mono text-zinc-400 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded">
              /
            </kbd>
          )}
        </div>
      </div>

      {/* High-Density Data Table */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/60 text-[11px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 select-none">
                <th className="py-2 pl-4 pr-2 w-8 text-center">
                  <Star className="w-3 h-3 inline-block opacity-60" />
                </th>
                <th className="py-2 px-3 font-medium">Contact</th>
                <th className="py-2 px-3 font-medium hidden md:table-cell">Role &amp; Organization</th>
                <th className="py-2 px-3 font-medium w-28">Tag</th>
                <th className="py-2 px-3 font-medium w-44">Phone</th>
                <th className="py-2 px-3 font-medium hidden lg:table-cell">Email</th>
                <th className="py-2 pl-3 pr-4 font-medium text-right w-40">Updated</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70 text-xs">
              {loading ? (
                /* Realistic Skeleton Loader Rows */
                Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={`skel-${idx}`} className="animate-pulse">
                    <td className="py-2.5 pl-4 pr-2">
                      <div className="w-3.5 h-3.5 rounded bg-zinc-200 dark:bg-zinc-800 mx-auto" />
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-md bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                        <div className="h-3.5 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
                      </div>
                    </td>
                    <td className="py-2.5 px-3 hidden md:table-cell">
                      <div className="h-3 w-48 rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="h-4 w-14 rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="h-3 w-28 rounded bg-zinc-200/80 dark:bg-zinc-800/80" />
                    </td>
                    <td className="py-2.5 px-3 hidden lg:table-cell">
                      <div className="h-3 w-36 rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
                    </td>
                    <td className="py-2.5 pl-3 pr-4 text-right">
                      <div className="h-3 w-12 rounded bg-zinc-200/70 dark:bg-zinc-800/70 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : displayedContacts.length === 0 ? (
                /* Thoughtful Empty State */
                <tr>
                  <td colSpan={7} className="py-14 px-4 text-center">
                    <div className="max-w-md mx-auto">
                      <div className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center mx-auto mb-2.5 text-zinc-400">
                        <SlidersHorizontal className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                        {activeSegment === "FOLLOW_UPS" ? (
                          <span>No contacts have follow-up reminders scheduled. Open any contact to set a reminder date.</span>
                        ) : (
                          <>
                            No contacts matching &ldquo;{searchInput || activeSegment}&rdquo; — Press{" "}
                            <button
                              type="button"
                              onClick={() => {
                                setSearchInput("");
                                setActiveSegment("ALL");
                              }}
                              className="inline-flex items-center px-1.5 py-0.5 mx-0.5 font-mono text-[11px] rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                            >
                              [Esc]
                            </button>{" "}
                            to clear or{" "}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingContact(null);
                                setModalOpen(true);
                              }}
                              className="inline-flex items-center px-1.5 py-0.5 mx-0.5 font-mono text-[11px] rounded border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100"
                            >
                              [N]
                            </button>{" "}
                            to create new contact.
                          </>
                        )}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedContacts.map((contact) => {
                  const phoneInfo = formatPhoneWithFlag(contact.phoneNumber);
                  const tag = inferContactTag(contact);
                  const followUp = getFollowUpStatus(contact.followUpDate);
                  const isSelected = inspectedContact?.id === contact.id;
                  const waHref = `https://wa.me/${formatPhoneForWhatsApp(
                    contact.phoneNumber
                  )}?text=${encodeURIComponent(`Hi ${contact.name}, reaching out to connect.`)}`;

                  return (
                    <tr
                      key={contact.id}
                      onClick={() => setInspectedContact(contact)}
                      className={`group cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-zinc-100/90 dark:bg-zinc-800/70"
                          : "hover:bg-zinc-50/90 dark:hover:bg-zinc-800/40"
                      }`}
                    >
                      {/* Star Toggle */}
                      <td
                        className="py-2.5 pl-4 pr-2 text-center"
                        onClick={(e) => handleToggleFavorite(contact, e)}
                      >
                        <button
                          type="button"
                          aria-label={
                            contact.favorite ? "Remove from favorites" : "Mark as favorite"
                          }
                          className={`p-1 rounded transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                            contact.favorite
                              ? "text-amber-500 dark:text-amber-400 opacity-100"
                              : "text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-zinc-500"
                          }`}
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${contact.favorite ? "fill-current" : ""}`}
                          />
                        </button>
                      </td>

                      {/* Contact Avatar + Name + Follow-up badge */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {contact.pictureUrl ? (
                            <img
                              src={contact.pictureUrl}
                              alt={contact.name}
                              className="w-6 h-6 rounded-md object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                            />
                          ) : (
                            <span className="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono text-[10px] font-semibold flex items-center justify-center shrink-0">
                              {getInitials(contact.name)}
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate flex items-center gap-1.5">
                              <span className="truncate">{contact.name}</span>
                              {followUp && (
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium border shrink-0 ${followUp.style}`}
                                  title={`Follow up date: ${contact.followUpDate}`}
                                >
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>{followUp.label}</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-400 md:hidden truncate">
                              {contact.description || (demoMaskEnabled ? maskEmailAddress(contact.email) : contact.email)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role & Organization */}
                      <td className="py-2.5 px-3 hidden md:table-cell max-w-[260px]">
                        <div className="text-zinc-600 dark:text-zinc-400 truncate">
                          {contact.description || "—"}
                        </div>
                      </td>

                      {/* Status Tag Badge */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${getTagBadgeStyle(
                            tag
                          )}`}
                        >
                          {tag}
                        </span>
                      </td>

                      {/* International Phone with Flag */}
                      <td className="py-2.5 px-3 font-mono text-xs text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                        <span className="mr-1.5">{phoneInfo.flag}</span>
                        <span>{demoMaskEnabled ? maskPhoneNumber(contact.phoneNumber) : phoneInfo.formatted}</span>
                      </td>

                      {/* Email */}
                      <td className="py-2.5 px-3 hidden lg:table-cell font-mono text-xs text-zinc-500 dark:text-zinc-400 max-w-[220px] truncate">
                        {demoMaskEnabled ? maskEmailAddress(contact.email) : (contact.email || "—")}
                      </td>

                      {/* Updated Date + Hover Quick Action Bar */}
                      <td
                        className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap relative"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500 group-hover:opacity-0 transition-opacity">
                          {formatShortDate(contact.updatedAt)}
                        </span>

                        {/* Quick Action Bar revealed on row hover */}
                        <div className=" opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity absolute inset-y-0 right-3 flex items-center gap-1 bg-zinc-50/95 dark:bg-zinc-800/95 px-1.5 my-1 rounded-md border border-zinc-200/80 dark:border-zinc-700 shadow-sm">
                          <button
                            type="button"
                            onClick={(e) => handleQuickCopyPhone(contact, e)}
                            title="Copy phone number"
                            className="p-1 rounded text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 transition-colors"
                          >
                            {copiedId === contact.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <a
                            href={waHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Message on WhatsApp"
                            className="p-1 rounded text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>

                          {contact.email && contact.email.trim() ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectedContact(contact);
                              }}
                              title="Email via SCM Mail Service"
                              className="p-1 rounded text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 transition-colors"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              title="No email address saved"
                              className="p-1 rounded text-zinc-300 dark:text-zinc-600 cursor-not-allowed opacity-50"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadVCard(contact, onNotify);
                            }}
                            title="Download vCard (.vcf)"
                            className="p-1 rounded text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingContact(contact);
                              setModalOpen(true);
                            }}
                            title="Edit contact"
                            className="p-1 rounded text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDelete(contact.id, e)}
                            title="Delete contact"
                            className="p-1 rounded text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Bar */}
        <div className="px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-4 font-mono">
            <span>
              Showing {displayedContacts.length} of {totalCount}
            </span>
            <span className="hidden md:inline text-zinc-400 dark:text-zinc-600">•</span>
            <span className="hidden md:inline text-zinc-400 dark:text-zinc-500">
              Click any row to inspect • <kbd className="px-1 border border-zinc-200 dark:border-zinc-800 rounded">⌘K</kbd> Command Palette
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={cursorHistory.length <= 1}
              onClick={handlePrevPage}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              disabled={!hasMore || !nextCursor}
              onClick={handleNextPage}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide-Over Inspection Drawer */}
      <ContactDrawer
        contact={inspectedContact}
        onClose={() => setInspectedContact(null)}
        onToggleFavorite={handleToggleFavorite}
        onUpdateTag={handleUpdateTag}
        onUpdateNotes={handleUpdateNotes}
        onUpdateFollowUpDate={handleUpdateFollowUpDate}
        onEdit={(c) => {
          setEditingContact(c);
          setModalOpen(true);
        }}
        onDelete={handleDelete}
        onSoapVerify={handleSoapVerify}
        onCopyPhone={(val, label) =>
          onNotify({
            variant: "success",
            title: `${label} copied`,
            detail: val
          })
        }
        onNotify={onNotify}
      />

      {/* Create / Edit Contact Modal */}
      <ContactModal
        isOpen={modalOpen}
        initialContact={editingContact}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveModal}
        onNotify={onNotify}
      />

      {/* Duplicate Merge Modal */}
      <DuplicateMergeModal
        isOpen={Boolean(selectedDuplicatePair)}
        pair={selectedDuplicatePair}
        onClose={() => setSelectedDuplicatePair(null)}
        onMerge={handleMergeDuplicates}
        merging={mergingDuplicates}
      />
    </div>
  );
}
