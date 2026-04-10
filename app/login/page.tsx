"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const BG = "#F5EFE6";
const RED = "#C8522A";
const TXT = "#2C1F14";
const TXT_MUTED = "#7A6555";

function toGermanAuthError(message: string): string {
  const m = message.trim();
  if (m === "Invalid login credentials" || m.includes("Invalid login credentials")) {
    return "E-Mail oder Passwort falsch";
  }
  if (m === "User already registered" || m.includes("User already registered")) {
    return "Diese E-Mail ist bereits registriert";
  }
  if (m.includes("Password should be at least 6 characters")) {
    return "Passwort muss mindestens 6 Zeichen haben";
  }
  return m;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm text-[#2C1F14] outline-none transition focus:ring-2 focus:ring-[#C8522A]/35 focus:ring-offset-2 focus:ring-offset-[#F5EFE6]";

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Bitte gib deine E-Mail-Adresse ein.");
      return;
    }
    if (!password) {
      setError("Bitte gib dein Passwort ein.");
      return;
    }
    setLoading(true);
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });
    setLoading(false);
    if (signError) {
      setError(toGermanAuthError(signError.message));
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Bitte gib deine E-Mail-Adresse ein.");
      return;
    }
    if (!password) {
      setError("Bitte gib ein Passwort ein.");
      return;
    }
    if (password.length < 6) {
      setError("Passwort muss mindestens 6 Zeichen haben.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }
    setLoading(true);
    const { error: signError } = await supabase.auth.signUp({
      email: trimmed,
      password,
    });
    setLoading(false);
    if (signError) {
      setError(toGermanAuthError(signError.message));
      return;
    }
    router.push("/onboarding");
    router.refresh();
  }

  function switchMode(next: "login" | "register") {
    setMode(next);
    setError(null);
    if (next === "login") {
      setConfirmPassword("");
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-5 py-10"
      style={{
        backgroundColor: BG,
        color: TXT,
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
      }}
    >
      <div className="w-full max-w-[430px]">
        <header className="mb-8 text-center">
          <p className="mb-2 text-3xl" aria-hidden>
            🏡
          </p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: RED }}>
            Do.Fam
          </h1>
          <p className="mt-2 text-sm" style={{ color: TXT_MUTED }}>
            Deine Familie. Dein Ort.
          </p>
        </header>

        <div
          className="mb-6 flex rounded-xl border border-black/10 p-1"
          style={{ backgroundColor: "rgba(255,255,255,0.65)" }}
          role="tablist"
          aria-label="Anmeldung oder Registrierung"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition"
            style={{
              backgroundColor: mode === "login" ? RED : "transparent",
              color: mode === "login" ? "#fff" : TXT_MUTED,
            }}
            onClick={() => switchMode("login")}
          >
            Anmelden
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition"
            style={{
              backgroundColor: mode === "register" ? RED : "transparent",
              color: mode === "register" ? "#fff" : TXT_MUTED,
            }}
            onClick={() => switchMode("register")}
          >
            Registrieren
          </button>
        </div>

        <form
          onSubmit={mode === "login" ? handleLogin : handleRegister}
          className="space-y-4 rounded-2xl border border-black/10 bg-white/85 p-6 shadow-sm backdrop-blur"
        >
          <div>
            <label
              htmlFor="auth-email"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide"
              style={{ color: TXT_MUTED }}
            >
              E-Mail
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="du@beispiel.ch"
              className={inputClass}
              disabled={loading}
            />
          </div>
          <div>
            <label
              htmlFor="auth-password"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide"
              style={{ color: TXT_MUTED }}
            >
              Passwort
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "Mindestens 6 Zeichen" : "••••••••"}
              className={inputClass}
              disabled={loading}
            />
          </div>
          {mode === "register" ? (
            <div>
              <label
                htmlFor="auth-confirm"
                className="mb-2 block text-xs font-semibold uppercase tracking-wide"
                style={{ color: TXT_MUTED }}
              >
                Passwort bestätigen
              </label>
              <input
                id="auth-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Passwort wiederholen"
                className={inputClass}
                disabled={loading}
              />
            </div>
          ) : null}

          {error ? (
            <p className="text-sm" style={{ color: RED }} role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-60"
            style={{ backgroundColor: RED }}
          >
            {loading
              ? mode === "login"
                ? "Anmeldung…"
                : "Wird erstellt…"
              : mode === "login"
                ? "Anmelden"
                : "Konto erstellen"}
          </button>
        </form>
      </div>
    </div>
  );
}
