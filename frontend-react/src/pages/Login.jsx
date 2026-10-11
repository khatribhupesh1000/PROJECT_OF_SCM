import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Lock, Mail } from "lucide-react";
import GithubAuthModal from "../components/GithubAuthModal.jsx";
import { authApi, setAuthToken, parseRfc7807Error } from "../services/api.js";

export default function Login({ onAuthSuccess, onNotify }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [githubModalOpen, setGithubModalOpen] = useState(false);
  const [email, setEmail] = useState(() => {
    if (location.state?.registeredEmail) {
      return location.state.registeredEmail;
    }
    if (typeof window !== "undefined" && window.location?.search) {
      const params = new URLSearchParams(window.location.search);
      return params.get("email") || "";
    }
    return "";
  });
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.location?.search) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("github_modal") === "1" || params.get("github_fallback") === "1") {
      setGithubModalOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Handle Google OAuth landing (?oauth_token=... or ?signup_success=1 or ?oauth_error=...)
  useEffect(() => {
    if (typeof window === "undefined" || !window.location?.search) return;
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get("oauth_token");
    const oauthUserRaw = params.get("oauth_user");
    const signupSuccess = params.get("signup_success");
    const oauthError = params.get("oauth_error");

    if (oauthToken) {
      let parsedUser = null;
      try {
        if (oauthUserRaw) parsedUser = JSON.parse(oauthUserRaw);
      } catch (_e) {}
      setAuthToken(oauthToken, parsedUser);
      if (parsedUser) {
        onAuthSuccess(parsedUser);
        onNotify({
          variant: "success",
          title: "Signed in with Google",
          detail: `Signed in with Google as ${parsedUser.email}`
        });
      }
      window.history.replaceState({}, document.title, "/");
      navigate("/");
      return;
    }

    if (signupSuccess === "1") {
      const emailParam = params.get("email");
      if (emailParam) {
        setEmail(emailParam);
      }
      onNotify({
        variant: "success",
        title: "Account registered",
        detail: "Account registered successfully! Please sign in with your email and password."
      });
      window.history.replaceState({}, document.title, "/login");
      return;
    }

    if (oauthError) {
      const detail =
        oauthError === "no_account_found"
          ? "No account found with this Google email. Please sign up first."
          : `Google authentication failed: ${oauthError}`;
      onNotify({
        variant: "error",
        title: "Authentication Failed",
        detail
      });
      window.history.replaceState({}, document.title, "/login");
    }
  }, [navigate, onAuthSuccess, onNotify]);

  // Handle GitHub OAuth 2.0 callback (?code=...) on http://localhost:3000/login
  useEffect(() => {
    if (typeof window === "undefined" || !window.location?.search) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;

    const stateParam = params.get("state") || "";
    const storedIntent = window.sessionStorage?.getItem("scm_github_oauth_intent") || "login";
    const intent = stateParam.includes("signup") || storedIntent === "signup" ? "signup" : "login";
    window.sessionStorage?.removeItem("scm_github_oauth_intent");
    window.history.replaceState({}, document.title, "/login");

    setLoading(true);
    authApi
      .githubOAuthExchange({
        code,
        intent,
        email: params.get("email") || undefined,
        name: params.get("name") || undefined
      })
      .then((data) => {
        if (intent === "signup") {
          if (data?.user?.email) {
            setEmail(data.user.email);
          }
          onNotify({
            variant: "success",
            title: "Account registered",
            detail: "Account registered successfully! Please sign in with your email and password."
          });
          return;
        }
        onAuthSuccess(data.user);
        onNotify({
          variant: "success",
          title: "Signed in with GitHub",
          detail: data.user.email
        });
        navigate("/");
      })
      .catch((err) => {
        onNotify({ variant: "error", ...parseRfc7807Error(err) });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [navigate, onAuthSuccess, onNotify]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await authApi.login(email, password);
      onAuthSuccess(data.user);
      onNotify({
        variant: "success",
        title: "Signed in",
        detail: `Welcome back, ${data.user.name}`
      });
      navigate("/");
    } catch (err) {
      onNotify({ variant: "error", ...parseRfc7807Error(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setLoading(true);
    const GOOGLE_CLIENT_ID = "";
    const REDIRECT_URI = encodeURIComponent("http://localhost:8081/login/oauth2/code/google");
    const SCOPE = encodeURIComponent("openid profile email");
    
    // prompt=select_account forces Google to show all accounts on the device
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${SCOPE}&prompt=select_account&state=${encodeURIComponent(JSON.stringify({ intent: "login" }))}`;
    
    window.location.assign(googleAuthUrl);
  };

  const handleGithubLogin = async () => {
    setLoading(true);
    try {
      const config = await authApi.getGithubConfig();
      if (config?.isLive) {
        window.location.assign(authApi.getGithubOAuthUrl("login"));
      } else {
        setGithubModalOpen(true);
      }
    } catch (_e) {
      setGithubModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[82vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-mono text-xs font-bold">
            SC
          </span>
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Sign in to Smart Contacts
          </h1>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Email address
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950 pl-8 pr-3 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400/30"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950 pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400/30"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
            Or continue with
          </span>
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleGoogleLogin()}
            disabled={loading}
            className="py-1.5 px-3 rounded-md text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
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
            onClick={handleGithubLogin}
            disabled={loading}
            className="py-1.5 px-3 rounded-md text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
            </svg>
            <span>GitHub</span>
          </button>
        </div>

        <p className="mt-5 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Don&apos;t have an account?{" "}
          <Link
            to="/signup"
            className="text-zinc-900 dark:text-zinc-100 font-medium hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>

      <GithubAuthModal
        isOpen={githubModalOpen}
        onClose={() => setGithubModalOpen(false)}
        intent="login"
        initialValue={email}
        onAuthSuccess={onAuthSuccess}
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
