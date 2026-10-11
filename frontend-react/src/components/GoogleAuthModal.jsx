import React, { useState, useEffect } from "react";
import { X, AlertCircle, User, Mail, ShieldCheck, UserPlus, Check, ChevronRight } from "lucide-react";
import { authApi, parseRfc7807Error } from "../services/api.js";

const DEFAULT_GOOGLE_ACCOUNTS = [
  {
    name: "Bhupesh Karir",
    email: "bhupeshkarir@gmail.com",
    avatarBg: "bg-purple-600",
    initial: "B"
  },
  {
    name: "Smart Contact Manager",
    email: "scm.project.12@gmail.com",
    avatarBg: "bg-emerald-600",
    initial: "S"
  }
];

export default function GoogleAuthModal({
  isOpen,
  onClose,
  intent = "login",
  initialValue = "",
  onAuthSuccess,
  onNotify,
  onSwitchIntent
}) {
  const [selectedEmail, setSelectedEmail] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [customName, setCustomName] = useState("");
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setFieldError("");
      setSelectedEmail("");
      if (initialValue && !DEFAULT_GOOGLE_ACCOUNTS.some((a) => a.email === initialValue)) {
        setIsCustomMode(true);
        setCustomEmail(initialValue);
        const suggested = initialValue.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        setCustomName(suggested);
      } else {
        setIsCustomMode(false);
      }
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleAuthenticateWithAccount = async (targetEmail, targetName) => {
    const cleanEmail = String(targetEmail || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setFieldError("Please enter a valid Google email address.");
      return;
    }

    setLoading(true);
    setError(null);
    setFieldError("");
    setSelectedEmail(cleanEmail);

    try {
      const cleanName =
        String(targetName || "").trim() ||
        cleanEmail.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      const payload = {
        email: cleanEmail,
        name: cleanName,
        intent
      };

      const data = await authApi.googleOAuthExchange(payload);

      if (intent === "signup") {
        onNotify?.({
          variant: "success",
          title: "Google Account Registered",
          detail: `Account for ${cleanEmail} registered successfully! Please sign in.`
        });
        onClose();
        if (onSwitchIntent) {
          onSwitchIntent("login", cleanEmail);
        }
      } else {
        if (onAuthSuccess) {
          onAuthSuccess(data.user);
        }
        onNotify?.({
          variant: "success",
          title: "Signed in with Google",
          detail: `Authenticated as ${data.user?.name || cleanEmail}`
        });
        onClose();
      }
    } catch (err) {
      const parsed = parseRfc7807Error(err);
      setError(parsed);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    handleAuthenticateWithAccount(customEmail, customName);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="google-auth-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Google Accounts</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title & Prompt */}
        <div className="mt-4 mb-3">
          <h2
            id="google-auth-modal-title"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
          >
            Choose an account
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            to continue to <strong className="text-zinc-800 dark:text-zinc-200">Smart Contact Manager</strong>
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold">{error.title || "Authentication Error"}</div>
              <div className="mt-0.5 text-[11px] opacity-90">{error.detail || error.message}</div>
            </div>
          </div>
        )}

        {/* Account Options List */}
        {!isCustomMode ? (
          <div className="space-y-1.5">
            {DEFAULT_GOOGLE_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                disabled={loading}
                onClick={() => handleAuthenticateWithAccount(acc.email, acc.name)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 hover:border-blue-300 dark:hover:border-blue-700 transition-all text-left group active:scale-[0.99] disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full ${acc.avatarBg} text-white flex items-center justify-center font-bold text-sm shadow-sm`}>
                    {acc.initial}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {acc.name}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                      {acc.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center text-zinc-400 group-hover:text-blue-500">
                  {loading && selectedEmail === acc.email ? (
                    <span className="text-[11px] text-blue-600 animate-pulse">Signing in...</span>
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </div>
              </button>
            ))}

            {/* Option: Use another account */}
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setIsCustomMode(true);
                setCustomEmail("");
                setCustomName("");
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all text-left group"
            >
              <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  Use another account
                </div>
                <div className="text-[11px] text-zinc-400">
                  Enter any other Google account email
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        ) : (
          /* Custom Account Form */
          <form onSubmit={handleCustomSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Google Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  autoFocus
                  value={customEmail}
                  onChange={(e) => {
                    setCustomEmail(e.target.value);
                    setFieldError("");
                    if (!customName && e.target.value.includes("@")) {
                      const prefix = e.target.value.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                      setCustomName(prefix);
                    }
                  }}
                  placeholder="e.g. yourname@gmail.com"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950 pl-9 pr-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              {fieldError && <p className="mt-1 text-[11px] text-rose-500">{fieldError}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Account Name (Optional)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Your Name"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950 pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCustomMode(false)}
                className="py-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                Back to Accounts
              </button>
              <button
                type="submit"
                disabled={loading || !customEmail.trim()}
                className="flex-1 py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                <span>{loading ? "Signing in..." : intent === "signup" ? "Complete Sign Up" : "Continue"}</span>
              </button>
            </div>
          </form>
        )}

        {/* Footer info */}
        <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Encrypted with SCM JWT</span>
          </span>
          {intent === "signup" ? (
            <button
              type="button"
              onClick={() => onSwitchIntent?.("login", selectedEmail || customEmail)}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Sign in instead
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSwitchIntent?.("signup", selectedEmail || customEmail)}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Create account
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
