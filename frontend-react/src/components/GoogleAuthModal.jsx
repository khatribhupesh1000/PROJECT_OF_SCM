import React, { useState, useEffect } from "react";
import { X, AlertCircle, User, Mail, ShieldCheck, UserPlus, ChevronRight, Trash2, ArrowLeft } from "lucide-react";
import { authApi, parseRfc7807Error } from "../services/api.js";

const LOCAL_STORAGE_KEY = "scm_device_google_accounts";

function getLocalDeviceAccounts() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

function saveLocalDeviceAccount(account) {
  try {
    const existing = getLocalDeviceAccounts();
    const updated = [
      account,
      ...existing.filter((a) => a.email.toLowerCase() !== account.email.toLowerCase())
    ].slice(0, 5);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (_e) {
    // ignore localStorage quota errors
  }
}

function removeLocalDeviceAccount(emailToRemove) {
  try {
    const existing = getLocalDeviceAccounts();
    const updated = existing.filter(
      (a) => a.email.toLowerCase() !== emailToRemove.toLowerCase()
    );
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (_e) {
    return [];
  }
}

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-purple-600",
  "bg-emerald-600",
  "bg-rose-600",
  "bg-amber-600"
];

function getAvatarColor(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function GoogleAuthModal({
  isOpen,
  onClose,
  intent = "login",
  initialValue = "",
  onAuthSuccess,
  onNotify,
  onSwitchIntent
}) {
  const [deviceAccounts, setDeviceAccounts] = useState([]);
  const [emailInput, setEmailInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [viewMode, setViewMode] = useState("form"); // "list" (if saved accounts exist) or "form"
  const [fieldError, setFieldError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setFieldError("");
      const saved = getLocalDeviceAccounts();
      setDeviceAccounts(saved);

      if (initialValue) {
        setEmailInput(initialValue);
        const namePart = initialValue
          .split("@")[0]
          .replace(/[._-]+/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        setNameInput(namePart);
        setViewMode("form");
      } else if (saved.length > 0) {
        setViewMode("list");
      } else {
        setViewMode("form");
        setEmailInput("");
        setNameInput("");
      }
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleAuthenticate = async (targetEmail, targetName) => {
    const cleanEmail = String(targetEmail || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setFieldError("Please enter a valid Google email address.");
      return;
    }

    setLoading(true);
    setError(null);
    setFieldError("");

    try {
      const cleanName =
        String(targetName || "").trim() ||
        cleanEmail
          .split("@")[0]
          .replace(/[._-]+/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());

      const payload = {
        email: cleanEmail,
        name: cleanName,
        intent
      };

      const data = await authApi.googleOAuthExchange(payload);

      // Save to this device's localStorage so only THIS user sees it on this device
      saveLocalDeviceAccount({
        name: data.user?.name || cleanName,
        email: cleanEmail,
        avatarBg: getAvatarColor(cleanEmail),
        initial: (data.user?.name || cleanName || "U").charAt(0).toUpperCase()
      });

      if (intent === "signup") {
        onNotify?.({
          variant: "success",
          title: "Account Created",
          detail: `Google account ${cleanEmail} registered! Please sign in.`
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
          detail: `Welcome back, ${data.user?.name || cleanEmail}!`
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

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleAuthenticate(emailInput, nameInput);
  };

  const handleDeleteSavedAccount = (e, email) => {
    e.stopPropagation();
    const updated = removeLocalDeviceAccount(email);
    setDeviceAccounts(updated);
    if (updated.length === 0) {
      setViewMode("form");
    }
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
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              Google Accounts
            </span>
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
        <div className="mt-4 mb-4">
          <h2
            id="google-auth-modal-title"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
          >
            {viewMode === "list"
              ? "Choose an account"
              : intent === "signup"
              ? "Create your Google Account"
              : "Sign in with Google"}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            to continue to{" "}
            <strong className="text-zinc-800 dark:text-zinc-200">
              Smart Contact Manager
            </strong>
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold">
                {error.title || "Authentication Error"}
              </div>
              <div className="mt-0.5 text-[11px] opacity-90">
                {error.detail || error.message}
              </div>
            </div>
          </div>
        )}

        {/* View Mode: Saved Accounts on THIS Device */}
        {viewMode === "list" && deviceAccounts.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 px-1">
              Accounts used recently on this device:
            </p>
            {deviceAccounts.map((acc) => (
              <div
                key={acc.email}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 hover:border-blue-300 dark:hover:border-blue-700 transition-all text-left group cursor-pointer"
                onClick={() => handleAuthenticate(acc.email, acc.name)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full ${
                      acc.avatarBg || "bg-blue-600"
                    } text-white flex items-center justify-center font-bold text-sm shadow-sm`}
                  >
                    {acc.initial || acc.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {acc.name || acc.email}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                      {acc.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title="Remove from this device"
                    onClick={(e) => handleDeleteSavedAccount(e, acc.email)}
                    className="p-1 rounded text-zinc-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-blue-500" />
                </div>
              </div>
            ))}

            {/* Option: Use another account */}
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setViewMode("form");
                setEmailInput("");
                setNameInput("");
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
                  Enter your Google account email
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        ) : (
          /* View Mode: Fresh / Enter Google Account */
          <form onSubmit={handleFormSubmit} className="space-y-3.5">
            {deviceAccounts.length > 0 && (
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline mb-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to accounts on this device</span>
              </button>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Email or phone *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  autoFocus
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setFieldError("");
                    if (!nameInput && e.target.value.includes("@")) {
                      const prefix = e.target.value
                        .split("@")[0]
                        .replace(/[._-]+/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase());
                      setNameInput(prefix);
                    }
                  }}
                  placeholder="Enter your Google email (e.g. name@gmail.com)"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950 pl-9 pr-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              {fieldError && (
                <p className="mt-1 text-[11px] text-rose-500">{fieldError}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Your Name {intent === "signup" ? "*" : "(Optional)"}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950 pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !emailInput.trim()}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white text-xs font-medium flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                <span>
                  {loading
                    ? "Authenticating..."
                    : intent === "signup"
                    ? "Next (Create Account)"
                    : "Next (Sign In)"}
                </span>
                {!loading && <ChevronRight className="w-4 h-4" />}
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
              onClick={() =>
                onSwitchIntent?.("login", emailInput)
              }
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Sign in instead
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                onSwitchIntent?.("signup", emailInput)
              }
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
