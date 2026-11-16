import React, { useState, useEffect } from "react";
import {
  Mail,
  Send,
  X,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Wand2,
  Users
} from "lucide-react";
import { groupApi, aiApi, parseRfc7807Error } from "../services/api.js";

const AI_PROMPT_PRESETS = [
  { label: "Sprint Planning", prompt: "Write a sprint planning and action items email for the team" },
  { label: "Urgent Update", prompt: "Draft an urgent announcement requiring immediate team attention" },
  { label: "Weekly Sync", prompt: "Friendly weekly check-in, agenda, and milestone review for the team" },
  { label: "Milestone Celebration", prompt: "Congratulate the team on completing our major project milestone" },
  { label: "Meeting Notes", prompt: "Summarize key discussion points and next action items from our meeting" }
];

export default function GroupBroadcastModal({
  isOpen,
  onClose,
  group,
  contacts = [],
  onNotify,
  currentUser
}) {
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);

  // AI Auto-Generate state
  const [aiComposerOpen, setAiComposerOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBroadcastSubject(group ? `Sprint Planning & Action Items [${group.name}]` : "");
      setBroadcastMessage("");
      setBroadcastResult(null);
      setAiComposerOpen(false);
      setAiPrompt("");
    }
  }, [isOpen, group?.id]);

  if (!isOpen || !group) return null;

  // Resolve members from contacts
  const contactsMap = new Map();
  contacts.forEach((c) => {
    if (c && c.id !== undefined && c.id !== null) {
      contactsMap.set(c.id, c);
      contactsMap.set(String(c.id), c);
      if (typeof c.id === "string" && !isNaN(Number(c.id))) {
        contactsMap.set(Number(c.id), c);
      }
    }
  });

  const rawList = Array.isArray(group.members) && group.members.length > 0
    ? group.members
    : group.contactIds || [];

  const memberContacts = rawList
    .map((item) => {
      if (item && typeof item === "object" && (item.name || item.email)) return item;
      const id = item && typeof item === "object" ? item.id : item;
      return (
        contactsMap.get(id) ||
        contactsMap.get(String(id)) ||
        contacts.find((c) => String(c.id) === String(id))
      );
    })
    .filter(Boolean);

  const validRecipients = memberContacts
    .filter((c) => c && c.email && c.email.includes("@"))
    .map((c) => ({ name: c.name, email: c.email }));
  const skippedCount = memberContacts.length - validRecipients.length;

  // Handle AI Auto-Generate Email
  const handleGenerateAiEmail = async (overridePrompt = null) => {
    const promptToUse = (overridePrompt || aiPrompt).trim();
    if (!promptToUse) {
      onNotify?.({
        variant: "error",
        title: "Prompt Required",
        detail: "Please provide a prompt or pick a preset for the AI email drafter."
      });
      return;
    }

    setAiGenerating(true);
    try {
      let senderName = currentUser?.name || "Smart Contact Manager User";
      const result = await aiApi.draftEmail({
        contactName: "team",
        company: group.name,
        prompt: promptToUse,
        senderName
      });

      if (result?.subject) setBroadcastSubject(result.subject);
      if (result?.body) setBroadcastMessage(result.body);

      setAiComposerOpen(false);
      onNotify?.({
        variant: "success",
        title: "✨ Email Generated with AI",
        detail: `Subject and message body tailored for '${group.name}'. Ready to send.`
      });
    } catch (err) {
      onNotify?.({
        variant: "error",
        title: "AI Generation Error",
        detail: "Unable to generate draft with AI. Please try again or write your message manually."
      });
    } finally {
      setAiGenerating(false);
    }
  };

  // Handle Send Broadcast
  const handleSendBroadcast = async (e) => {
    e?.preventDefault?.();
    if (!broadcastSubject.trim()) {
      onNotify?.({
        variant: "error",
        title: "Subject required",
        detail: "Please provide a subject line for the broadcast email."
      });
      return;
    }
    if (!broadcastMessage.trim()) {
      onNotify?.({
        variant: "error",
        title: "Message body required",
        detail: "Please write a message to broadcast to your group members."
      });
      return;
    }

    if (validRecipients.length === 0) {
      onNotify?.({
        variant: "error",
        title: "No valid recipients",
        detail: "None of the members in this group have a valid email address on record."
      });
      return;
    }

    setSendingBroadcast(true);
    setBroadcastResult(null);

    try {
      let userEmail = currentUser?.email;
      let userName = currentUser?.name;
      if (!userEmail) {
        try {
          const stored = localStorage.getItem("scm_user_profile");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.email) userEmail = parsed.email;
            if (parsed?.name) userName = parsed.name;
          }
        } catch (_) {}
      }

      const senderEmail = userEmail || "scm.project.12@gmail.com";
      const senderName = userName || "Smart Contact Manager";

      const res = await groupApi.broadcastEmail({
        groupName: group.name,
        recipients: validRecipients,
        subject: broadcastSubject.trim(),
        message: broadcastMessage.trim(),
        senderName,
        senderEmail
      });

      setBroadcastResult(res);
      onNotify?.({
        variant: "success",
        title: "Broadcast email dispatched",
        detail: `Successfully sent broadcast to ${res.deliveredCount || validRecipients.length} member(s) via Gmail SMTP (Port 465 SSL).`
      });
    } catch (err) {
      onNotify?.({ variant: "error", ...parseRfc7807Error(err) });
    } finally {
      setSendingBroadcast(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Broadcast Email: {group.name}
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Dispatches individualized emails to all members simultaneously via Gmail SMTP (Port 465 SSL)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Delivery Result Banner */}
          {broadcastResult && (
            <div className="p-4 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 text-xs text-emerald-900 dark:text-emerald-100 space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  Broadcast successfully dispatched to {broadcastResult.deliveredCount} recipient(s)!
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                Individualized emails delivered via SCM Enterprise Gmail SMTP (Port 465 SSL). Event audited to MongoDB Atlas.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 font-medium text-[11px]"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => setBroadcastResult(null)}
                  className="px-2.5 py-1 rounded border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/50 text-[11px]"
                >
                  Send Another
                </button>
              </div>
            </div>
          )}

          {/* Group Recipients Chips */}
          <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/50">
            <div className="flex items-center justify-between text-xs mb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Target Group: {group.name}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {validRecipients.length} reachable member{validRecipients.length === 1 ? "" : "s"}
                </span>
              </div>
              <span className="text-[11px] text-zinc-400 hidden sm:inline">
                Via Gmail SMTP • Port 465 SSL
              </span>
            </div>

            {/* Recipient Avatars & Names */}
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {memberContacts.map((c) => {
                const hasEmail = Boolean(c.email && c.email.includes("@"));
                return (
                  <span
                    key={c.id}
                    title={hasEmail ? c.email : "No email address on record"}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                      hasEmail
                        ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
                        : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 opacity-60"
                    }`}
                  >
                    <Mail className={`w-3 h-3 ${hasEmail ? "text-emerald-500" : "text-amber-500"}`} />
                    <span>{c.name}</span>
                    {!hasEmail && <span className="text-[9px] text-amber-500 italic">(skipped)</span>}
                  </span>
                );
              })}
            </div>

            {skippedCount > 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {skippedCount} group member{skippedCount === 1 ? "" : "s"} have no email and will be excluded from this delivery.
                </span>
              </p>
            )}
          </div>

          {/* ✨ AI Auto-Generate Email Feature Drawer/Card */}
          <div className="rounded-xl border border-purple-200 dark:border-purple-900/60 bg-gradient-to-r from-purple-50/70 to-indigo-50/60 dark:from-purple-950/30 dark:to-indigo-950/20 p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-purple-600 text-white flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-purple-950 dark:text-purple-200">
                    AI Auto-Generate Broadcast Email
                  </span>
                  <p className="text-[11px] text-purple-700 dark:text-purple-300">
                    Instantly craft a polished, context-aware group email using AI
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAiComposerOpen((prev) => !prev)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white shadow-xs transition-colors active:scale-[0.98]"
              >
                <Wand2 className="w-3 h-3" />
                <span>{aiComposerOpen ? "Close AI" : "✨ Auto-Draft with AI"}</span>
              </button>
            </div>

            {aiComposerOpen && (
              <div className="mt-3 pt-3 border-t border-purple-200/80 dark:border-purple-800/60 space-y-2.5 animate-in fade-in">
                {/* AI Prompt Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-purple-800 dark:text-purple-300 uppercase tracking-wider">
                    Quick AI Prompts:
                  </span>
                  {AI_PROMPT_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      disabled={aiGenerating}
                      onClick={() => {
                        setAiPrompt(p.prompt);
                        handleGenerateAiEmail(p.prompt);
                      }}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-white dark:bg-purple-900/40 text-purple-700 dark:text-purple-200 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-800/60 transition-colors disabled:opacity-50"
                    >
                      ⚡ {p.label}
                    </button>
                  ))}
                </div>

                {/* Custom Prompt Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Describe what you want to communicate to the group..."
                    className="flex-1 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-zinc-950 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-purple-400 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleGenerateAiEmail();
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={aiGenerating || !aiPrompt.trim()}
                    onClick={() => handleGenerateAiEmail()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white shadow-xs transition-colors disabled:opacity-40 shrink-0"
                  >
                    {aiGenerating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Compose Form */}
          <form onSubmit={handleSendBroadcast} className="space-y-3.5">
            {/* Subject Line */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Subject Line *
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-zinc-400">Presets:</span>
                  <button
                    type="button"
                    onClick={() => setBroadcastSubject(`Sprint Planning & Action Items [${group.name}]`)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"
                  >
                    Sprint
                  </button>
                  <button
                    type="button"
                    onClick={() => setBroadcastSubject(`Weekly Team Sync Notes - ${group.name}`)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"
                  >
                    Weekly Sync
                  </button>
                  <button
                    type="button"
                    onClick={() => setBroadcastSubject(`Important Announcement for ${group.name}`)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"
                  >
                    Announcement
                  </button>
                </div>
              </div>
              <input
                type="text"
                required
                value={broadcastSubject}
                onChange={(e) => setBroadcastSubject(e.target.value)}
                placeholder="e.g. Sprint Planning, Project Kickoff, Quarterly Review"
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none"
              />
            </div>

            {/* Broadcast Message */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Broadcast Message *
                </label>
                <span className="text-[10px] text-zinc-400">
                  {broadcastMessage.length} characters
                </span>
              </div>
              <textarea
                rows={6}
                required
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder={`Hello team,\n\nWriting to share important updates regarding our current milestones...\n\nBest regards,\n${currentUser?.name || "Team Lead"}`}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none font-sans"
              />
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Individual delivery • Participants cannot see other recipient emails</span>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingBroadcast || !broadcastSubject.trim() || !broadcastMessage.trim() || validRecipients.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors disabled:opacity-40 active:scale-[0.98]"
                >
                  {sendingBroadcast ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Dispatching...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Broadcast</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
