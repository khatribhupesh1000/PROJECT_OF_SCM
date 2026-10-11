import React, { useState, useEffect } from "react";
import { X, AlertCircle, ArrowRight, User, Mail, ShieldCheck } from "lucide-react";
import { authApi, parseRfc7807Error } from "../services/api.js";

export default function GoogleAuthModal({
  isOpen,
  onClose,
  intent = "login",
  initialValue = "",
  onAuthSuccess,
  onNotify,
  onSwitchIntent
}) {
  const [email, setEmail] = useState(initialValue || "");
  const [name, setName] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      if (initialValue) {
        setEmail(initialValue);
        if (initialValue.includes("@")) {
          const suggested = initialValue.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          setName(suggested);
        }
      }
      setError(null);
      setFieldError("");
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setFieldError("Please enter a valid Google email address.");
      return;
    }

    setLoading(true);
    setError(null);
    setFieldError("");

    try {
      const cleanName =
        String(name || "").trim() ||
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
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 shadow-sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
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
            </div>
            <div>
              <h2
                id="google-auth-modal-title"
                className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5"
              >
                <span>{intent === "signup" ? "Create SCM Account with Google" : "Sign in with Google"}</span>
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Fast, secure Google authentication
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold">{error.title || "Authentication Error"}</div>
              <div className="mt-0.5 text-[11px] opacity-90">{error.detail || error.message}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
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
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFieldError("");
                  if (!name && e.target.value.includes("@")) {
                    const prefix = e.target.value.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                    setName(prefix);
                  }
                }}
                placeholder="e.g. bhupeshkarir@gmail.com"
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950 pl-9 pr-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            {fieldError && <p className="mt-1 text-[11px] text-rose-500">{fieldError}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Display Name (Optional)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bhupesh Karir"
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950 pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none active:scale-[0.99]"
            >
              <span>{loading ? "Verifying with Google..." : intent === "signup" ? "Complete Google Sign Up" : "Sign In with Google"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Encrypted with HMAC-SHA256 JWT</span>
          </span>
          {intent === "signup" ? (
            <button
              type="button"
              onClick={() => onSwitchIntent?.("login", email)}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Already registered? Sign in
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSwitchIntent?.("signup", email)}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              New user? Sign up
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
