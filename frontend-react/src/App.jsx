import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Toast from "./components/Toast.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ContactsList from "./pages/ContactsList.jsx";
import ContactDetails from "./pages/ContactDetails.jsx";
import AddContact from "./pages/AddContact.jsx";
import OAuthCallback from "./pages/OAuthCallback.jsx";
import { authApi, getStoredUser, consumePendingOAuthToast } from "./services/api.js";

export default function App() {
  const [user, setUser] = useState(() => getStoredUser());
  const [toast, setToast] = useState(() => {
    const oauthToast = consumePendingOAuthToast();
    return oauthToast ? { ...oauthToast, id: Date.now() } : null;
  });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [cachedContacts, setCachedContacts] = useState([]);
  const [newContactTrigger, setNewContactTrigger] = useState(0);
  const [tagFilterTrigger, setTagFilterTrigger] = useState(null);
  const [favFilterTrigger, setFavFilterTrigger] = useState(0);
  const [selectedPaletteContact, setSelectedPaletteContact] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("scm_theme");
    return saved ? saved === "dark" : true;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      localStorage.setItem("scm_theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("scm_theme", "light");
    }
  }, [darkMode]);

  // Global Cmd+K / Ctrl+K shortcut for Command Palette (ONLY when signed in)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (!user) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [user]);

  const handleNotify = (nextToast) => {
    setToast({ ...nextToast, id: Date.now() });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleLogout = async () => {
    await authApi.logout();
    setPaletteOpen(false);
    setCachedContacts([]);
    setUser(null);
    handleNotify({
      variant: "success",
      title: "Signed out",
      detail: "Your session has been closed."
    });
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <Navbar
          user={user}
          onLogout={handleLogout}
          onOpenCommandPalette={() => user && setPaletteOpen(true)}
          onNewContact={() => user && setNewContactTrigger((n) => n + 1)}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((d) => !d)}
        />

        <main className="flex-1">
          <Routes>
            <Route
              path="/"
              element={
                user ? (
                  <ContactsList
                    onNotify={handleNotify}
                    externalNewTrigger={newContactTrigger}
                    externalTagFilter={tagFilterTrigger}
                    externalFavTrigger={favFilterTrigger}
                    selectedFromPalette={selectedPaletteContact}
                    onContactsLoaded={setCachedContacts}
                  />
                ) : (
                  <Navigate to="/signup" replace />
                )
              }
            />
            <Route
              path="/contacts/:id"
              element={
                user ? (
                  <ContactDetails onNotify={handleNotify} />
                ) : (
                  <Navigate to="/signup" replace />
                )
              }
            />
            <Route
              path="/add"
              element={
                user ? (
                  <AddContact onNotify={handleNotify} />
                ) : (
                  <Navigate to="/signup" replace />
                )
              }
            />
            <Route
              path="/login"
              element={
                user ? (
                  <Navigate to="/" replace />
                ) : (
                  <Login onAuthSuccess={setUser} onNotify={handleNotify} />
                )
              }
            />
            <Route
              path="/signup"
              element={
                user ? (
                  <Navigate to="/" replace />
                ) : (
                  <Signup onNotify={handleNotify} />
                )
              }
            />
            <Route
              path="/forgot-password"
              element={<ForgotPassword onNotify={handleNotify} />}
            />
            <Route
              path="/oauth/callback"
              element={<OAuthCallback onAuthSuccess={setUser} onNotify={handleNotify} />}
            />
            <Route
              path="/login/oauth2/code/github"
              element={<OAuthCallback onAuthSuccess={setUser} onNotify={handleNotify} />}
            />
            <Route
              path="/login/oauth2/code/google"
              element={<OAuthCallback onAuthSuccess={setUser} onNotify={handleNotify} />}
            />
            <Route
              path="*"
              element={<Navigate to={user ? "/" : "/signup"} replace />}
            />
          </Routes>
        </main>

        {user && (
          <CommandPalette
            isOpen={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            contacts={cachedContacts}
            onSelectContact={(c) => setSelectedPaletteContact({ ...c })}
            onNewContact={() => setNewContactTrigger((n) => n + 1)}
            onFilterTag={(t) => setTagFilterTrigger(t)}
            onFilterFavorites={() => setFavFilterTrigger((f) => f + 1)}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode((d) => !d)}
          />
        )}

        <Toast key={toast?.id} toast={toast} onClose={() => setToast(null)} />
      </div>
    </BrowserRouter>
  );
}
