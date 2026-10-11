import React, { useState, useEffect } from "react";
import { X, AlertCircle, ArrowRight, User } from "lucide-react";
import { authApi, parseRfc7807Error } from "../services/api.js";

export default function GithubAuthModal({
  isOpen,
  onClose,
  intent = "login",
  initialValue = "",
  onAuthSuccess,
  onNotify,
  onSwitchIntent
}) {
  const [identifier, setIdentifier] = useState(initialValue || "");
  const [fieldError, setFieldError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      if (initialValue) {
        setIdentifier(initialValue);
      }
      setError(null);
      setFieldError("");
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanId = String(identifier || "").trim();
    if (!cleanId) {
      setFieldError("Please enter your GitHub username or email address.");
      return;
    }

    setLoading(true);
    setError(null);
    setFieldError("");

    try {
      let resolvedUsername = cleanId;
      let resolvedEmail = undefined;

      if (cleanId.includes("@")) {
        resolvedEmail = cleanId.toLowerCase();
        resolvedUsername = cleanId.split("@")[0].replace(/^@/, "");
      } else {
        resolvedUsername = cleanId.replace(/^@/, "");
      }

      const payload = {
        username: resolvedUsername,
        email: resolvedEmail,
        intent
      };

      const data = await authApi.githubOAuthExchange(payload);

      if (intent === "signup") {
        onNotify({
          variant: "success",
          title: "GitHub Account Registered",
          detail: `Account for ${data.user?.email || resolvedUsername} registered successfully! Please sign in.`
        });
        onClose();
        if (onSwitchIntent) {
          onSwitchIntent("login", data.user?.email);
        }
      } else {
        if (onAuthSuccess) {
          onAuthSuccess(data.user);
        }
        onNotify({
          variant: "success",
          title: "Signed in with GitHub",
          detail: `Authenticated as ${data.user?.name || data.user?.email}`
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
        aria-labelledby="github-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="github-modal-title"
                  className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
                >
                  {intent === "signup" ? "Sign up with GitHub" : "Sign in with GitHub"}
                </h2>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                  Instant Access
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Verify your GitHub profile to connect directly to SCM.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informational banner */}
        <div className="mb-4 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-[11px] text-zinc-600 dark:text-zinc-400">
          <p className="leading-relaxed">
            Enter your GitHub username or email. We verify your profile via GitHub&apos;s API, provision your account in MySQL, and issue your secure SCM session token.
          </p>
        </div>

        {/* Error notification from API */}
        {error && (
          <div className="mb-4 p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <div className="flex-1">
                <p className="font-medium">{error.title || "Authentication Error"}</p>
                <p className="text-[11px] mt-0.5 opacity-90">{error.detail}</p>

                {error.status === 404 && intent === "login" && onSwitchIntent && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      onSwitchIntent("signup", identifier);
                    }}
                    className="mt-2 text-xs font-semibold underline text-red-800 dark:text-red-200 flex items-center gap-1 hover:opacity-80"
                  >
                    <span>Click here to create your GitHub account on Sign Up</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}

                {error.status === 409 && intent === "signup" && onSwitchIntent && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      onSwitchIntent("login", identifier);
                    }}
                    className="mt-2 text-xs font-semibold underline text-red-800 dark:text-red-200 flex items-center gap-1 hover:opacity-80"
                  >
                    <span>Account exists. Click here to Sign In</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              GitHub Username or Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute left-3 top-2.5 text-zinc-400 select-none pointer-events-none">
                <User className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                autoFocus
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (fieldError) setFieldError("");
                  if (error) setError(null);
                }}
                placeholder="e.g. octocat or user@example.com"
                className={`w-full rounded-lg border bg-zinc-50/70 dark:bg-zinc-950 pl-8 pr-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 transition-colors ${
                  fieldError
                    ? "border-red-400 dark:border-red-600 focus:ring-red-400/30"
                    : "border-zinc-200 dark:border-zinc-800 focus:border-zinc-500 dark:focus:border-zinc-500 focus:ring-zinc-400/20"
                }`}
              />
            </div>
            {fieldError && (
              <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{fieldError}</span>
              </p>
            )}
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5">
              Supports your GitHub handle (e.g. <span className="font-mono text-zinc-600 dark:text-zinc-300">octocat</span>) or any registered email address.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Connecting GitHub...</span>
                </>
              ) : (
                <>
                  <span>{intent === "signup" ? "Sign Up with GitHub" : "Sign In with GitHub"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
