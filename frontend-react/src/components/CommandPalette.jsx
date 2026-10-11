import React, { useEffect, useRef, useState } from "react";
import {
  Search,
  UserPlus,
  Star,
  Tag,
  Sun,
  Moon,
  Download,
  ArrowRight,
  CornerDownLeft
} from "lucide-react";
import { formatPhoneWithFlag, getInitials, inferContactTag } from "../services/api.js";

export default function CommandPalette({
  isOpen,
  onClose,
  contacts = [],
  onSelectContact,
  onNewContact,
  onFilterTag,
  onFilterFavorites,
  onExportCsv,
  darkMode,
  onToggleDarkMode
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const normalizedQuery = query.trim().toLowerCase();

  const quickActions = [
    {
      id: "act-new",
      label: "Create new contact",
      shortcut: "N",
      icon: UserPlus,
      action: () => {
        onClose();
        onNewContact?.();
      }
    },
    {
      id: "act-fav",
      label: "Toggle Favorites filter",
      shortcut: "F",
      icon: Star,
      action: () => {
        onClose();
        onFilterFavorites?.();
      }
    },
    {
      id: "act-vip",
      label: "Filter by tag: VIP",
      shortcut: "1",
      icon: Tag,
      action: () => {
        onClose();
        onFilterTag?.("VIP");
      }
    },
    {
      id: "act-colleague",
      label: "Filter by tag: Colleague",
      shortcut: "2",
      icon: Tag,
      action: () => {
        onClose();
        onFilterTag?.("Colleague");
      }
    },
    {
      id: "act-lead",
      label: "Filter by tag: Lead",
      shortcut: "3",
      icon: Tag,
      action: () => {
        onClose();
        onFilterTag?.("Lead");
      }
    },
    {
      id: "act-export",
      label: "Export directory to CSV",
      shortcut: "E",
      icon: Download,
      action: () => {
        onClose();
        onExportCsv?.();
      }
    },
    {
      id: "act-theme",
      label: darkMode ? "Switch to Light Mode" : "Switch to Dark Mode",
      shortcut: "T",
      icon: darkMode ? Sun : Moon,
      action: () => {
        onClose();
        onToggleDarkMode?.();
      }
    }
  ].filter(
    (item) => !normalizedQuery || item.label.toLowerCase().includes(normalizedQuery)
  );

  const matchingContacts = contacts
    .filter((c) => {
      if (!normalizedQuery) return true;
      return (
        c.name?.toLowerCase().includes(normalizedQuery) ||
        c.email?.toLowerCase().includes(normalizedQuery) ||
        c.phoneNumber?.toLowerCase().includes(normalizedQuery) ||
        c.description?.toLowerCase().includes(normalizedQuery) ||
        c.company?.toLowerCase().includes(normalizedQuery)
      );
    })
    .slice(0, 6);

  const totalItems = matchingContacts.length + quickActions.length;

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (totalItems > 0 ? (prev + 1) % totalItems : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        totalItems > 0 ? (prev - 1 + totalItems) % totalItems : 0
      );
    } else if (e.key === "Enter" && totalItems > 0) {
      e.preventDefault();
      if (activeIndex < matchingContacts.length) {
        const chosen = matchingContacts[activeIndex];
        onClose();
        onSelectContact?.(chosen);
      } else {
        const actionItem = quickActions[activeIndex - matchingContacts.length];
        actionItem?.action();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-zinc-950/60 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        onKeyDown={handleKeyDown}
        className="w-full max-w-xl rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center px-3.5 border-b border-zinc-200 dark:border-zinc-800">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Type a command or search contacts by name, role, phone..."
            className="w-full bg-transparent px-3 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded">
            ESC
          </kbd>
        </div>

        <div className="max-h-[360px] overflow-y-auto p-1.5 divide-y divide-zinc-100 dark:divide-zinc-800/70">
          {matchingContacts.length > 0 && (
            <div className="pb-1.5">
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                Contacts ({matchingContacts.length})
              </div>
              {matchingContacts.map((c, idx) => {
                const isSelected = idx === activeIndex;
                const phoneInfo = formatPhoneWithFlag(c.phoneNumber);
                const tag = inferContactTag(c);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => {
                      onClose();
                      onSelectContact?.(c);
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
                      isSelected
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-md bg-zinc-200 dark:bg-zinc-800 border border-zinc-300/60 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono text-[10px] font-semibold flex items-center justify-center shrink-0">
                        {getInitials(c.name)}
                      </span>
                      <div className="truncate">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {c.name}
                        </span>
                        <span className="ml-2 text-zinc-400 dark:text-zinc-500 truncate">
                          {c.description || c.email}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                        {phoneInfo.flag} {phoneInfo.formatted}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                        {tag}
                      </span>
                      <ArrowRight className="w-3 h-3 text-zinc-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {quickActions.length > 0 && (
            <div className="pt-1.5">
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                Commands
              </div>
              {quickActions.map((act, idx) => {
                const itemIndex = matchingContacts.length + idx;
                const isSelected = itemIndex === activeIndex;
                const Icon = act.icon;
                return (
                  <button
                    key={act.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(itemIndex)}
                    onClick={act.action}
                    className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
                      isSelected
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{act.label}</span>
                    </div>
                    <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded">
                      {act.shortcut}
                    </kbd>
                  </button>
                );
              })}
            </div>
          )}

          {totalItems === 0 && (
            <div className="py-8 text-center text-xs text-zinc-500">
              No matching contacts or commands for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>

        <div className="px-3.5 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/60 flex items-center justify-between text-[11px] text-zinc-400">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <CornerDownLeft className="w-3 h-3" /> Select
            </span>
            <span>↑↓ Navigate</span>
          </div>
          <span className="font-mono">⌘K Palette</span>
        </div>
      </div>
    </div>
  );
}
