import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle2, Shield } from "lucide-react";
import { authApi, parseRfc7807Error } from "../services/api.js";

export default function ForgotPassword({ onNotify }) {
  const location = useLocation();
  const [email, setEmail] = useState(() => location.state?.email || "");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      onNotify?.({
        variant: "error",
        title: "Invalid Email",
        detail: "Please enter a valid email address."
      });
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.requestPasswordReset(email);
      setSubmitted(true);
      onNotify?.({
        variant: "success",
        title: "Recovery link dispatched",
        detail: res.message || "If this email is registered, a password reset link has been sent."
      });
    } catch (err) {
      onNotify?.({ variant: "error", ...parseRfc7807Error(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[82vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center font-mono text-xs font-bold">
            <Shield className="w-3.5 h-3.5" />
          </span>
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Forgot Password
          </h1>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 leading-relaxed">
          Enter your registered email address to receive a secure password recovery link via Gmail.
        </p>

        {submitted ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 p-3.5 text-xs text-emerald-800 dark:text-emerald-300">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Reset Link Dispatched</p>
                  <p className="leading-relaxed">
                    If <strong className="font-mono">{email}</strong> is registered, password reset instructions have been sent via Gmail. Check your inbox and spam folder.
                  </p>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-2">
                    ⏱️ The link will expire in <strong>15 minutes</strong> for security.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
              }}
              className="w-full py-1.5 rounded-md text-xs font-medium border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
            >
              Didn&apos;t receive it? Try another email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Registered Email Address
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950 pl-8 pr-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400/30"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
            >
              {loading ? "Sending reset link..." : "Send reset link"}
            </button>
          </form>
        )}

        <div className="mt-5 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Back to sign in</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
