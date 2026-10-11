import React from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

/**
 * Tactile Toast notification with close button and smooth animated progress bar.
 */
export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  const isError = toast.variant === "error";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 max-w-sm w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xl overflow-hidden transition-all"
    >
      <div className="p-3.5 flex items-start gap-2.5">
        {isError ? (
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0 text-xs">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {toast.title}
          </div>
          {toast.detail && (
            <p className="mt-0.5 text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {toast.detail}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div
        className={`h-0.5 w-full animate-toast-progress ${
          isError ? "bg-rose-500" : "bg-emerald-500"
        }`}
      />
    </div>
  );
}
