"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const BG = "#F5EFE6";
const TERRACOTTA = "#C8522A";
const AMBER = "#C47B0A";
const TXT = "#2C1F14";
const TXT_MUTED = "#7A6555";

function authCallbackUrl(): string {
  if (typeof window === "undefined") {
    return "https://familyfeed-app.vercel.app/auth/callback";
  }
  return `${window.location.origin}/auth/callback`;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState<"password" | "magic" | "signup" | null>(null);
  const [success, setSuccess] = useState<"magic" | "signup" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRegister, setIsRegister] = useState(false);

  async function handlePasswordLogin(e: FormEvent) {
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
    setLoading("password");
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });
    setLoading(null);
    if (signError) {
      setError(signError.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handleMagicLink() {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Bitte gib deine E-Mail-Adresse ein.");
      return;
    }
    setLoading("magic");
    const { error: signError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: authCallbackUrl(),
      },
    });
    setLoading(null);
    if (signError) {
      setError(signError.message);
      return;
    }
    setSuccess("magic");
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Bitte gib deine E-Mail-Adresse ein.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Passwort mindestens 6 Zeichen.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }
    setLoading("signup");
    const { error: signError } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: {
        emailRedirectTo: authCallbackUrl(),
      },
    });
    setLoading(null);
    if (signError) {
      setError(signError.message);
      return;
    }
    setSuccess("signup");
  }

  const inputClass =
    "w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm text-[#2C1F14] outline-none transition focus:ring-2 focus:ring-[#C8522A]/35 focus:ring-offset-2 focus:ring-offset-[#F5EFE6]";
  const busy = loading !== null;

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 py-12"
      style={{ backgroundColor: BG, color: TXT, fontFamily: "var(--font-dm-sans), system-ui, sans-serif" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            <span style={{ color: TXT }}>Do</span>
            <span style={{ color: AMBER }}>.</span>
            <span style={{ color: TERRACOTTA }}>Fam</span>
          </h1>
          <p className="mt-2 text-sm" style={{ color: TXT_MUTED }}>
            Deine Familie. Dein Ort.
          </p>
        </div>

        {success === "magic" ? (
          <div
            className="rounded-2xl border px-5 py-6 text-center text-sm leading-relaxed shadow-sm"
            style={{
              backgroundColor: "rgba(200, 82, 42, 0.08)",
              borderColor: "rgba(200, 82, 42, 0.25)",
              color: TXT,
            }}
          >
            Wir haben dir einen Link geschickt! Prüfe deine E-Mails.
          </div>
        ) : success === "signup" ? (
          <div
            className="rounded-2xl border px-5 py-6 text-center text-sm leading-relaxed shadow-sm"
            style={{
              backgroundColor: "rgba(200, 82, 42, 0.08)",
              borderColor: "rgba(200, 82, 42, 0.25)",
              color: TXT,
            }}
          >
            Fast geschafft — wir haben dir eine Bestätigungs-E-Mail geschickt. Bitte den Link in der Mail
            anklicken, um dein Konto zu aktivieren.
          </div>
        ) : isRegister ? (
          <form
            onSubmit={handleRegister}
            className="space-y-4 rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm backdrop-blur"
          >
            <h2 className="text-center text-base font-semibold" style={{ color: TXT }}>
              Registrieren
            </h2>
            <div>
              <label
                htmlFor="register-email"
                className="mb-2 block text-xs font-semibold uppercase tracking-wide"
                style={{ color: TXT_MUTED }}
              >
                E-Mail
              </label>
              <input
                id="register-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="du@beispiel.ch"
                className={inputClass}
                disabled={busy}
              />
            </div>
            <div>
              <label
                htmlFor="register-password"
                className="mb-2 block text-xs font-semibold uppercase tracking-wide"
                style={{ color: TXT_MUTED }}
              >
                Passwort
              </label>
              <input
                id="register-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mindestens 6 Zeichen"
                className={inputClass}
                disabled={busy}
              />
            </div>
            <div>
              <label
                htmlFor="register-confirm"
                className="mb-2 block text-xs font-semibold uppercase tracking-wide"
                style={{ color: TXT_MUTED }}
              >
                Passwort bestätigen
              </label>
              <input
                id="register-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Passwort wiederholen"
                className={inputClass}
                disabled={busy}
              />
            </div>
            {error ? (
              <p className="text-sm" style={{ color: TERRACOTTA }} role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-60"
              style={{ backgroundColor: TERRACOTTA }}
            >
              {loading === "signup" ? "Wird erstellt…" : "Konto erstellen"}
            </button>
            <p className="text-center text-sm" style={{ color: TXT_MUTED }}>
              <button
                type="button"
                className="font-semibold underline decoration-[#C8522A]/40 underline-offset-2 hover:opacity-80"
                style={{ color: TERRACOTTA }}
                onClick={() => {
                  setIsRegister(false);
                  setError(null);
                  setConfirmPassword("");
                }}
              >
                Zurück zur Anmeldung
              </button>
            </p>
          </form>
        ) : (
          <form
            onSubmit={handlePasswordLogin}
            className="space-y-4 rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm backdrop-blur"
          >
            <div>
              <label
                htmlFor="login-email"
                className="mb-2 block text-xs font-semibold uppercase tracking-wide"
                style={{ color: TXT_MUTED }}
              >
                E-Mail
              </label>
              <input
                id="login-email"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="du@beispiel.ch"
                className={inputClass}
                disabled={busy}
              />
            </div>
            <div>
              <label
                htmlFor="login-password"
                className="mb-2 block text-xs font-semibold uppercase tracking-wide"
                style={{ color: TXT_MUTED }}
              >
                Passwort
              </label>
              <input
                id="login-password"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputClass}
                disabled={busy}
              />
            </div>
            {error ? (
              <p className="text-sm" style={{ color: TERRACOTTA }} role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-col gap-3 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-60"
                style={{ backgroundColor: TERRACOTTA }}
              >
                {loading === "password" ? "Anmeldung…" : "Mit Passwort anmelden"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleMagicLink}
                className="w-full rounded-xl border-2 py-3.5 text-sm font-semibold transition hover:bg-black/[0.03] disabled:opacity-60"
                style={{ borderColor: TERRACOTTA, color: TERRACOTTA }}
              >
                {loading === "magic" ? "Wird gesendet…" : "Magic Link senden"}
              </button>
            </div>
            <p className="pt-2 text-center text-sm" style={{ color: TXT_MUTED }}>
              Noch kein Konto?{" "}
              <button
                type="button"
                className="font-semibold underline decoration-[#C8522A]/40 underline-offset-2 hover:opacity-80"
                style={{ color: TERRACOTTA }}
                onClick={() => {
                  setIsRegister(true);
                  setError(null);
                }}
              >
                Registrieren
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
