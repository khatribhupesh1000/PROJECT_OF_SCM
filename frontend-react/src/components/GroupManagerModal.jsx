import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Plus,
  Mail,
  Send,
  X,
  Search,
  Check,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  UserPlus,
  UserCheck,
  Loader2,
  Wand2
} from "lucide-react";
import { groupApi, aiApi, getInitials, parseRfc7807Error } from "../services/api.js";

const AI_PROMPT_PRESETS = [
  { label: "Sprint Planning", prompt: "Write a sprint planning and action items email for the team" },
  { label: "Urgent Update", prompt: "Draft an urgent announcement requiring immediate team attention" },
  { label: "Weekly Sync", prompt: "Friendly weekly check-in, agenda, and milestone review for the team" },
  { label: "Milestone Celebration", prompt: "Congratulate the team on completing our major project milestone" },
  { label: "Meeting Notes", prompt: "Summarize key discussion points and next action items from our meeting" }
];

const GROUP_COLORS = [
  { id: "emerald", label: "Emerald", bg: "bg-emerald-500", light: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" },
  { id: "blue", label: "Blue", bg: "bg-blue-500", light: "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
  { id: "violet", label: "Violet", bg: "bg-purple-500", light: "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800" },
  { id: "rose", label: "Rose", bg: "bg-rose-500", light: "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800" },
  { id: "amber", label: "Amber", bg: "bg-amber-500", light: "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
  { id: "cyan", label: "Cyan", bg: "bg-cyan-500", light: "bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800" }
];

export function getGroupColorClasses(colorId) {
  const match = GROUP_COLORS.find((c) => c.id === colorId);
  return match || GROUP_COLORS[0];
}

export default function GroupManagerModal({
  isOpen,
  onClose,
  contacts = [],
  onNotify,
  currentUser,
  initialView = "LIST",
  initialGroupId = null
}) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(initialView); // "LIST" | "EDIT" | "BROADCAST"
  const [selectedGroup, setSelectedGroup] = useState(null);

  // Group Form state
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupColor, setGroupColor] = useState("emerald");
  const [selectedContactIds, setSelectedContactIds] = useState(new Set());
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);

  // Broadcast Email state
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);

  // AI Auto-Generate state
  const [aiComposerOpen, setAiComposerOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  const contactsMap = useMemo(() => {
    const map = new Map();
    contacts.forEach((c) => {
      if (c && c.id !== undefined && c.id !== null) {
        map.set(c.id, c);
        map.set(String(c.id), c);
        if (typeof c.id === "string" && !isNaN(Number(c.id))) {
          map.set(Number(c.id), c);
        }
      }
    });
    return map;
  }, [contacts]);

  // Robustly resolve member contacts supporting ID strings, numbers, or full objects
  const resolveGroupMembers = (group) => {
    if (!group) return [];
    const rawList = Array.isArray(group.members) && group.members.length > 0
      ? group.members
      : group.contactIds || [];

    return rawList
      .map((item) => {
        if (item && typeof item === "object" && (item.name || item.email)) {
          return item;
        }
        const rawId = item && typeof item === "object" ? item.id : item;
        const matched =
          contactsMap.get(rawId) ||
          contactsMap.get(String(rawId)) ||
          contacts.find((c) => String(c.id) === String(rawId));

        if (matched) return matched;

        return {
          id: String(rawId),
          name: `Contact #${rawId}`,
          email: null,
          isPlaceholder: true
        };
      })
      .filter(Boolean);
  };

  // Load groups on open
  const loadGroups = async () => {
    setLoading(true);
    try {
      const list = await groupApi.getGroups();
      setGroups(list);
      if (initialGroupId) {
        const target = list.find((g) => g.id === initialGroupId);
        if (target) {
          setSelectedGroup(target);
          if (initialView === "BROADCAST") setView("BROADCAST");
        }
      }
    } catch (_err) {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadGroups();
      setView(initialView);
    } else {
      setSelectedGroup(null);
      setBroadcastResult(null);
      setAiComposerOpen(false);
      setAiPrompt("");
    }
  }, [isOpen, initialView, initialGroupId]);

  // Open Create/Edit View
  const handleOpenEdit = (group = null) => {
    if (group) {
      setSelectedGroup(group);
      setGroupName(group.name || "");
      setGroupDescription(group.description || "");
      setGroupColor(group.color || "emerald");
      const ids = (group.contactIds || []).map((id) => (typeof id === "object" ? String(id.id) : String(id)));
      setSelectedContactIds(new Set(ids));
    } else {
      setSelectedGroup(null);
      setGroupName("");
      setGroupDescription("");
      setGroupColor("emerald");
      setSelectedContactIds(new Set());
    }
    setMemberSearchQuery("");
    setView("EDIT");
  };

  // Open Broadcast View
  const handleOpenBroadcast = (group) => {
    setSelectedGroup(group);
    setBroadcastSubject(`Sprint Planning & Action Items [${group.name}]`);
    setBroadcastMessage("");
    setBroadcastResult(null);
    setAiComposerOpen(false);
    setAiPrompt("");
    setView("BROADCAST");
  };

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
        company: selectedGroup?.name || "Team",
        prompt: promptToUse,
        senderName
      });

      if (result?.subject) setBroadcastSubject(result.subject);
      if (result?.body) setBroadcastMessage(result.body);

      setAiComposerOpen(false);
      onNotify?.({
        variant: "success",
        title: "✨ Email Generated with AI",
        detail: `Subject and message body tailored for '${selectedGroup?.name || "Group"}'. Ready to send.`
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

  // Toggle Contact Selection
  const handleToggleContact = (contactId) => {
    const key = String(contactId);
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Select/Deselect All Contacts
  const handleSelectAllContacts = (selectAll) => {
    if (selectAll) {
      setSelectedContactIds(new Set(contacts.map((c) => String(c.id))));
    } else {
      setSelectedContactIds(new Set());
    }
  };

  // Save Group (Create or Update)
  const handleSaveGroup = async (e) => {
    e?.preventDefault?.();
    if (!groupName.trim()) {
      onNotify?.({
        variant: "error",
        title: "Validation error",
        detail: "Please provide a name for the group."
      });
      return;
    }

    setSavingGroup(true);
    try {
      const payload = {
        name: groupName.trim(),
        description: groupDescription.trim(),
        color: groupColor,
        contactIds: Array.from(selectedContactIds)
      };

      if (selectedGroup) {
        await groupApi.updateGroup(selectedGroup.id, payload);
        onNotify?.({
          variant: "success",
          title: "Group updated",
          detail: `Updated '${groupName}' with ${payload.contactIds.length} member(s).`
        });
      } else {
        await groupApi.createGroup(payload);
        onNotify?.({
          variant: "success",
          title: "Group created",
          detail: `Created new group '${groupName}' with ${payload.contactIds.length} member(s).`
        });
      }
      await loadGroups();
      setView("LIST");
    } catch (err) {
      onNotify?.({ variant: "error", ...parseRfc7807Error(err) });
    } finally {
      setSavingGroup(false);
    }
  };

  // Delete Group
  const handleDeleteGroup = async (groupId, name, e) => {
    e?.stopPropagation?.();
    if (!window.confirm(`Are you sure you want to delete the group '${name}'?`)) return;

    // Optimistically remove immediately from local UI state
    setGroups((prev) =>
      prev.filter((g) => g.id !== groupId && String(g.id).toLowerCase() !== String(groupId).toLowerCase())
    );
    if (selectedGroup?.id === groupId) {
      setSelectedGroup(null);
      setView("LIST");
    }

    try {
      await groupApi.deleteGroup(groupId);
      onNotify?.({
        variant: "success",
        title: "Group deleted",
        detail: `Removed '${name}'.`
      });
      await loadGroups();
    } catch (err) {
      onNotify?.({ variant: "error", ...parseRfc7807Error(err) });
      await loadGroups();
    }
  };

  // Send Broadcast Email
  const handleSendBroadcast = async (e) => {
    e?.preventDefault?.();
    if (!broadcastSubject.trim()) {
      onNotify?.({
        variant: "error",
        title: "Subject required",
        detail: "Please enter a subject line for the broadcast email."
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

    // Get group members with email addresses via robust resolver
    const resolvedMembers = resolveGroupMembers(selectedGroup);
    const recipients = resolvedMembers
      .filter((c) => c && c.email && c.email.includes("@"))
      .map((c) => ({ name: c.name, email: c.email }));

    if (recipients.length === 0) {
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
        groupName: selectedGroup?.name || "Contact Group",
        recipients,
        subject: broadcastSubject.trim(),
        message: broadcastMessage.trim(),
        senderName,
        senderEmail
      });

      setBroadcastResult(res);
      onNotify?.({
        variant: "success",
        title: "Broadcast email dispatched",
        detail: `Successfully sent broadcast to ${res.deliveredCount || recipients.length} group member(s) via Gmail SMTP (Port 465 SSL).`
      });
    } catch (err) {
      onNotify?.({ variant: "error", ...parseRfc7807Error(err) });
    } finally {
      setSendingBroadcast(false);
    }
  };

  // Filter contacts in member picker
  const filteredContactsForPicker = useMemo(() => {
    const q = memberSearchQuery.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.company || "").toLowerCase().includes(q) ||
        (c.phoneNumber || "").includes(q)
    );
  }, [contacts, memberSearchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {view === "LIST" && "Contact Groups & Broadcast"}
                {view === "EDIT" && (selectedGroup ? `Edit: ${selectedGroup.name}` : "Create New Group")}
                {view === "BROADCAST" && `Broadcast Email: ${selectedGroup?.name}`}
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {view === "LIST" && "Organize contacts like WhatsApp groups and send bulk emails via Gmail SMTP (Port 465 SSL)"}
                {view === "EDIT" && "Select contacts to include in this group"}
                {view === "BROADCAST" && "Dispatches individualized emails to all members simultaneously"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {view !== "LIST" && (
              <button
                type="button"
                onClick={() => setView("LIST")}
                className="px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-md hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors"
              >
                Back to Groups
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* ============================================================== */}
          {/* VIEW: LIST (All Groups) */}
          {/* ============================================================== */}
          {view === "LIST" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                  Your Groups ({groups.length})
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors active:scale-[0.98]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Group</span>
                </button>
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-zinc-400 animate-pulse">
                  Loading contact groups...
                </div>
              ) : groups.length === 0 ? (
                <div className="py-12 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mx-auto mb-3 flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                    No custom groups created yet
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mb-4">
                    Create your first group (e.g. "Core Team", "Project SCM", "VIP Clients") to easily organize contacts and broadcast bulk emails.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(null)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Your First Group</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {groups.map((group) => {
                    const colorCfg = getGroupColorClasses(group.color);
                    const memberContacts = resolveGroupMembers(group);
                    const memberCount = Math.max((group.contactIds || []).length, memberContacts.length);
                    const withEmailCount = memberContacts.filter((c) => c.email && c.email.includes("@")).length;

                    return (
                      <div
                        key={group.id}
                        className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/70 p-4 flex flex-col justify-between gap-3 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group/card"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`w-3 h-3 rounded-full ${colorCfg.bg} ring-2 ring-white dark:ring-zinc-900 shrink-0`} />
                              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                {group.name}
                              </h3>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shrink-0">
                              {memberCount} {memberCount === 1 ? "contact" : "contacts"}
                            </span>
                          </div>

                          {group.description && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                              {group.description}
                            </p>
                          )}

                          {/* Member Avatars Stack */}
                          <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80">
                            {memberContacts.length === 0 ? (
                              <span className="text-[11px] text-zinc-400 italic">No members added yet</span>
                            ) : (
                              <div className="flex items-center -space-x-1.5 overflow-hidden">
                                {memberContacts.slice(0, 4).map((m) => (
                                  <div
                                    key={m.id}
                                    title={`${m.name} (${m.email || "No email"})`}
                                    className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[9px] font-bold"
                                  >
                                    {getInitials(m.name)}
                                  </div>
                                ))}
                                {memberContacts.length > 4 && (
                                  <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[9px] font-semibold">
                                    +{memberContacts.length - 4}
                                  </div>
                                )}
                              </div>
                            )}
                            <span className="text-[10px] text-zinc-400 ml-auto">
                              {withEmailCount > 0
                                ? `${withEmailCount} reachable via email`
                                : memberCount > 0
                                ? "0 with email on record"
                                : "No members added"}
                            </span>
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="flex items-center justify-between gap-1.5 pt-2">
                          <button
                            type="button"
                            onClick={() => handleOpenBroadcast(group)}
                            disabled={withEmailCount === 0}
                            title={withEmailCount === 0 ? "Add members with email addresses to broadcast" : `Send bulk email to ${withEmailCount} members`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span>Broadcast Email</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(group)}
                              title="Manage group members and details"
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteGroup(group.id, group.name, e)}
                              title="Delete group"
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* VIEW: EDIT (Create/Edit Group & Select Members) */}
          {/* ============================================================== */}
          {view === "EDIT" && (
            <form onSubmit={handleSaveGroup} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Group Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Project SCM Team, Family, Leads"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Theme Color
                  </label>
                  <div className="flex items-center gap-2 pt-1">
                    {GROUP_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setGroupColor(c.id)}
                        className={`w-6 h-6 rounded-full ${c.bg} transition-all ${
                          groupColor === c.id ? "ring-2 ring-offset-2 ring-zinc-900 dark:ring-white scale-110" : "opacity-80 hover:opacity-100"
                        }`}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="Purpose or context for this group..."
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none"
                />
              </div>

              {/* Members Selection List (WhatsApp Style) */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                      Add / Remove Members
                    </span>
                    <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      {selectedContactIds.size} of {contacts.length} selected
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAllContacts(selectedContactIds.size !== contacts.length)}
                      className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                    >
                      {selectedContactIds.size === contacts.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                </div>

                {/* Instant Member Search */}
                <div className="relative mb-2.5">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder="Search contacts by name, email, role..."
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none"
                  />
                </div>

                {/* Contact Checkbox Stream */}
                <div className="max-h-56 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-950/40">
                  {filteredContactsForPicker.length === 0 ? (
                    <div className="py-6 text-center text-xs text-zinc-400">
                      No contacts matched "{memberSearchQuery}"
                    </div>
                  ) : (
                    filteredContactsForPicker.map((c) => {
                      const isSelected = selectedContactIds.has(String(c.id));
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-emerald-50/70 dark:bg-emerald-950/30"
                              : "hover:bg-zinc-100/70 dark:hover:bg-zinc-900/60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleContact(c.id)}
                            className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                          />
                          <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {getInitials(c.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                {c.name}
                              </span>
                              {c.company && (
                                <span className="text-[10px] text-zinc-400 truncate hidden sm:inline">
                                  • {c.company}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                              {c.email ? (
                                <span>{c.email}</span>
                              ) : (
                                <span className="text-amber-500 dark:text-amber-400 italic">No email on record</span>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setView("LIST")}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingGroup || !groupName.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors disabled:opacity-40"
                >
                  {savingGroup ? "Saving..." : selectedGroup ? "Update Group" : "Create Group"}
                </button>
              </div>
            </form>
          )}

          {/* ============================================================== */}
          {/* VIEW: BROADCAST (Bulk Email Dispatcher) */}
          {/* ============================================================== */}
          {view === "BROADCAST" && (
            <div className="space-y-4">
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
                      onClick={() => setView("LIST")}
                      className="px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 font-medium text-[11px]"
                    >
                      Return to Groups
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
                      Target Group: {selectedGroup?.name}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {Math.max((selectedGroup?.contactIds || []).length, resolveGroupMembers(selectedGroup).length)} members
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    Via Gmail SMTP • Port 465 SSL
                  </span>
                </div>

                {/* Recipient Avatars & Names */}
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {resolveGroupMembers(selectedGroup).map((c) => {
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
              </div>

              {/* ✨ AI Auto-Generate Broadcast Email Card */}
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
                {/* Quick Subject Presets */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Subject Line *
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-zinc-400">Presets:</span>
                      <button
                        type="button"
                        onClick={() => setBroadcastSubject(`Sprint Planning & Action Items [${selectedGroup?.name}]`)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"
                      >
                        Sprint
                      </button>
                      <button
                        type="button"
                        onClick={() => setBroadcastSubject(`Weekly Team Sync Notes - ${selectedGroup?.name}`)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"
                      >
                        Weekly Sync
                      </button>
                      <button
                        type="button"
                        onClick={() => setBroadcastSubject(`Important Announcement for ${selectedGroup?.name}`)}
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

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Individual delivery • Participants cannot see other recipient emails</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setView("LIST")}
                      className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={sendingBroadcast || !broadcastSubject.trim() || !broadcastMessage.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors disabled:opacity-40 active:scale-[0.98]"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sendingBroadcast ? "Dispatching..." : "Send Broadcast"}</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
