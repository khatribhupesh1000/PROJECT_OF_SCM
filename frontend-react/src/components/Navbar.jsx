import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Search,
  Plus,
  Sun,
  Moon,
  LogOut,
  LogIn,
  ExternalLink,
  Command
} from "lucide-react";
import { getInitials } from "../services/api.js";

export default function Navbar({
  user,
  onLogout,
  onOpenCommandPalette,
  onNewContact,
  darkMode,
  onToggleDarkMode
}) {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-30 h-12 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-3">
        {/* Left: Workspace & Breadcrumb Navigation */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={user ? "/" : "/signup"}
            className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded-md"
          >
            <span className="w-6 h-6 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-mono text-xs font-bold tracking-tighter shadow-sm">
              SC
            </span>
            <span className="tracking-tight">Smart Contacts</span>
          </Link>

          {user && (
            <>
              <span className="text-zinc-300 dark:text-zinc-700 text-sm select-none">/</span>

              <nav className="hidden sm:flex items-center gap-1">
                <Link
                  to="/"
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    location.pathname === "/"
                      ? "bg-zinc-100 dark:bg-zinc-800/90 text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100/60 dark:hover:bg-zinc-900"
                  }`}
                >
                  Directory
                </Link>
                <a
                  href="http://localhost:8080/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100/60 dark:hover:bg-zinc-900 transition-colors"
                >
                  <span>API Spec</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
              </nav>
            </>
          )}
        </div>

        {/* Center/Right: Global Command Palette Trigger & Actions */}
        <div className="flex items-center gap-2">
          {user && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="inline-flex items-center justify-between gap-6 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/90 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-xs text-zinc-500 dark:text-zinc-400 transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
            >
              <span className="inline-flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-zinc-400" />
                <span className="hidden md:inline">Search or jump to...</span>
                <span className="md:hidden">Search</span>
              </span>
              <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded">
                <Command className="w-2.5 h-2.5" />K
              </kbd>
            </button>
          )}

          {user && onNewContact && location.pathname === "/" && (
            <button
              type="button"
              onClick={onNewContact}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
              <kbd className="ml-0.5 px-1 py-0.2 text-[10px] font-mono bg-emerald-700/80 text-emerald-100 rounded">
                N
              </kbd>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleDarkMode}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle color theme"
            className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5" />

          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-zinc-100/80 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800">
                {user.pictureUrl ? (
                  <img
                    src={user.pictureUrl}
                    alt={user.name}
                    className="w-4 h-4 rounded-sm object-cover"
                  />
                ) : (
                  <span className="w-4 h-4 rounded-sm bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 font-mono text-[10px] font-semibold flex items-center justify-center">
                    {getInitials(user.name)}
                  </span>
                )}
                <span className="hidden lg:inline text-xs font-medium text-zinc-800 dark:text-zinc-200 max-w-[140px] truncate">
                  {user.name}
                </span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                title="Sign out"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  location.pathname === "/login"
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm"
                    : "border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign in</span>
              </Link>
              <Link
                to="/signup"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  location.pathname === "/signup"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <span>Sign up</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
