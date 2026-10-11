import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { COUNTRY_DIAL_CODES } from "../components/ContactModal.jsx";
import GithubAuthModal from "../components/GithubAuthModal.jsx";
import { authApi, parseRfc7807Error } from "../services/api.js";

export default function Signup({ onNotify }) {
  const navigate = useNavigate();
  const [githubModalOpen, setGithubModalOpen] = useState(false);
  const [countryCode, setCountryCode] = useState("+91");
  const [form, setForm] = useState({
    name: "",
    email: "",
    localPhone: "",
    password: ""
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.location?.search) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("github_modal") === "1" || params.get("github_fallback") === "1") {
      setGithubModalOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanDigits = String(form.localPhone || "").replace(/\D/g, "");
      const combinedPhone = cleanDigits ? `${countryCode}${cleanDigits}` : "";
      await authApi.signup({
        name: form.name.trim(),
        email: form.email.trim(),
        phoneNumber: combinedPhone,
        password: form.password
      });
      onNotify({
        variant: "success",
        title: "Account registered",
        detail: "Account registered successfully! Please sign in with your email and password."
      });
      navigate("/login", { state: { registeredEmail: form.email.trim() } });
    } catch (err) {
      onNotify({ variant: "error", ...parseRfc7807Error(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    setLoading(true);
    window.location.assign(authApi.getGoogleOAuthUrl("signup"));
  };

  const handleGithubSignup = async () => {
    setLoading(true);
    try {
      const config = await authApi.getGithubConfig();
      if (config?.isLive) {
        window.location.assign(authApi.getGithubOAuthUrl("signup"));
      } else {
        setGithubModalOpen(true);
      }
    } catch (_e) {
      setGithubModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400/30";

  return (
    <div className="min-h-[82vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-mono text-xs font-bold">
            SC
          </span>
          <div>
            <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
              Create your account
            </h1>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Register first to access Smart Contact Manager
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={loading}
            className="py-1.5 px-3 rounded-md text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.8 9.1-9.2 0-.6-.1-1.1-.2-1.6H12z"
              />
            </svg>
            <span>Google</span>
          </button>

          <button
            type="button"
            onClick={handleGithubSignup}
            disabled={loading}
            className="py-1.5 px-3 rounded-md text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
            </svg>
            <span>GitHub</span>
          </button>
        </div>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
            Or with email
          </span>
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Full name
            </label>
            <input
              type="text"
              required
              autoComplete="off"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. John Doe"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Email address
            </label>
            <input
              type="email"
              required
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="john@example.com"
              className={`${inputClass} font-mono`}
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Phone number
            </label>
            <div className="flex items-stretch">
              <select
                aria-label="Country dial code"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="rounded-l-md border border-r-0 border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900 px-2 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none"
              >
                {COUNTRY_DIAL_CODES.map((c) => (
                  <option key={c.code} value={c.code} title={c.name}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                inputMode="numeric"
                required
                autoComplete="off"
                value={form.localPhone}
                onChange={(e) =>
                  setForm({
                    ...form,
                    localPhone: e.target.value.replace(/\D/g, "").slice(0, 15)
                  })
                }
                placeholder="9876543210"
                className="w-full rounded-r-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950 px-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Password (minimum 6 characters)
            </label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-zinc-900 dark:text-zinc-100 font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>

      <GithubAuthModal
        isOpen={githubModalOpen}
        onClose={() => setGithubModalOpen(false)}
        intent="signup"
        initialValue={form.email}
        onNotify={onNotify}
        onSwitchIntent={(targetIntent, mail) =>
          navigate(targetIntent === "signup" ? "/signup" : "/login", {
            state: { registeredEmail: mail }
          })
        }
      />
    </div>
  );
}
