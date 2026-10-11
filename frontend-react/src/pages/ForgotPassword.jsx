import React, { useState } from "react";
import { Link } from "react-router-dom";
import { authApi, parseRfc7807Error } from "../services/api.js";

export default function ForgotPassword({ onNotify }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await authApi.requestPasswordReset(email);
      setSubmitted(true);
      onNotify({
        variant: "success",
        title: "Recovery link sent",
        detail: res.message
      });
    } catch (err) {
      onNotify({ variant: "error", ...parseRfc7807Error(err) });
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Reset your password
        </h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Enter the email address associated with your workspace account.
        </p>

        {submitted ? (
          <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-800 dark:text-emerald-300">
            Recovery instructions have been sent to <strong className="font-mono">{email}</strong>.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950 px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400/30"
              />
            </div>

            <button
              type="submit"
              className="w-full py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
            >
              Send reset link
            </button>
          </form>
        )}

        <div className="mt-5 text-center">
          <Link
            to="/login"
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
          >
            &larr; Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
