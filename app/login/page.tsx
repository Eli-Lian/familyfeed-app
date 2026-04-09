"use client";

import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

const BG = "#F5EFE6";
const TERRACOTTA = "#C8522A";
const AMBER = "#C47B0A";
const TXT = "#2C1F14";
const TXT_MUTED = "#7A6555";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Bitte gib deine E-Mail-Adresse ein.");
      return;
    }
    setLoading(true);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const { error: signError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
      },
    });
    setLoading(false);
    if (signError) {
      setError(signError.message);
      return;
    }
    setSuccess(true);
  }

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

        {success ? (
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
        ) : (
          <form
            onSubmit={handleMagicLink}
            className="space-y-5 rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm backdrop-blur"
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
                className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm text-[#2C1F14] outline-none transition focus:ring-2 focus:ring-[#C8522A]/35 focus:ring-offset-2 focus:ring-offset-[#F5EFE6]"
                disabled={loading}
              />
            </div>

            {error ? (
              <p className="text-sm" style={{ color: TERRACOTTA }} role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-60"
              style={{ backgroundColor: TERRACOTTA }}
            >
              {loading ? "Wird gesendet…" : "Magic Link senden"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
