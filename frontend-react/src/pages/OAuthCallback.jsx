import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { authApi, setAuthToken, parseRfc7807Error } from "../services/api.js";

export default function OAuthCallback({ onAuthSuccess, onNotify }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState("Verifying GitHub credentials...");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const error = params.get("error") || params.get("oauth_error");
    const errorDesc = params.get("error_description");
    const stateParam = params.get("state") || "";
    const oauthToken = params.get("oauth_token");
    const oauthUserRaw = params.get("oauth_user");

    const storedIntent =
      typeof window !== "undefined" && window.sessionStorage
        ? window.sessionStorage.getItem("scm_github_oauth_intent")
        : null;
    const intent =
      stateParam.includes("signup") || storedIntent === "signup"
        ? "signup"
        : "login";

    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.removeItem("scm_github_oauth_intent");
    }

    if (error) {
      onNotify({
        variant: "error",
        title: "GitHub Authentication Failed",
        detail: errorDesc || error || "Failed to authenticate with GitHub."
      });
      navigate(intent === "signup" ? "/signup" : "/login", { replace: true });
      return;
    }

    if (oauthToken && oauthUserRaw) {
      try {
        const user = JSON.parse(oauthUserRaw);
        if (intent === "signup") {
          onNotify({
            variant: "success",
            title: "Account Registered",
            detail: "Your GitHub account has been registered! Please sign in."
          });
          navigate(`/login?email=${encodeURIComponent(user.email || "")}`, { replace: true });
        } else {
          setAuthToken(oauthToken, user);
          onAuthSuccess(user);
          onNotify({
            variant: "success",
            title: "Signed in with GitHub",
            detail: user.email
          });
          navigate("/", { replace: true });
        }
        return;
      } catch (_e) {}
    }

    if (code) {
      setStatus("Exchanging authorization code...");
      authApi
        .githubOAuthExchange({ code, state: stateParam, intent })
        .then((data) => {
          if (intent === "signup") {
            onNotify({
              variant: "success",
              title: "Account Registered",
              detail: "Your GitHub account has been registered! Please sign in."
            });
            navigate(`/login?email=${encodeURIComponent(data?.user?.email || "")}`, {
              replace: true
            });
          } else {
            onAuthSuccess(data.user);
            onNotify({
              variant: "success",
              title: "Signed in with GitHub",
              detail: data.user.email
            });
            navigate("/", { replace: true });
          }
        })
        .catch((err) => {
          const parsed = parseRfc7807Error(err);
          onNotify({ variant: "error", ...parsed });
          navigate(intent === "signup" ? "/signup" : "/login", { replace: true });
        });
      return;
    }

    // No code or token found, fallback to login
    navigate("/login", { replace: true });
  }, [location.search]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-3 border-zinc-900 dark:border-zinc-100 border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400">{status}</p>
    </div>
  );
}
