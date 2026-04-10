"use client";

import { useState, type FormEvent, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const BG = "#F5EFE6";
const RED = "#C8522A";
const TXT = "#2C1F14";
const TXT_MUTED = "#7A6555";

function toGermanPasswordError(message: string): string {
  const m = message.trim();
  if (m.includes("Password should be at least 6 characters")) {
    return "Passwort muss mindestens 6 Zeichen haben";
  }
  if (m.includes("same as the old password") || m.includes("different from the old")) {
    return "Das neue Passwort muss sich vom alten unterscheiden.";
  }
  if (m.includes("session") || m.includes("JWT")) {
    return "Link ungültig oder abgelaufen. Bitte fordere einen neuen Link an.";
  }
  return m;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const inputClass =
    "w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm text-[#2C1F14] outline-none transition focus:ring-2 focus:ring-[#C8522A]/35 focus:ring-offset-2 focus:ring-offset-[#F5EFE6]";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }
      let {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        await new Promise((r) => setTimeout(r, 200));
        ({
          data: { session },
        } = await supabase.auth.getSession());
      }
      if (!cancelled) {
        setReady(!!session);
        setSessionChecked(true);
      }
    })();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError("Bitte gib ein neues Passwort ein.");
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
    const { error: updErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updErr) {
      setError(toGermanPasswordError(updErr.message));
      return;
    }
    setSuccess(true);
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1600);
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

        {success ? (
          <div
            className="rounded-2xl border px-5 py-6 text-center text-sm leading-relaxed shadow-sm"
            style={{
              backgroundColor: "rgba(200, 82, 42, 0.08)",
              borderColor: "rgba(200, 82, 42, 0.25)",
              color: TXT,
            }}
          >
            Passwort wurde gespeichert!
          </div>
        ) : !sessionChecked ? (
          <div
            className="rounded-2xl border border-black/10 bg-white/85 p-6 text-center text-sm shadow-sm"
            style={{ color: TXT_MUTED }}
          >
            Link wird geprüft…
          </div>
        ) : !ready ? (
          <div className="space-y-4 rounded-2xl border border-black/10 bg-white/85 p-6 text-center shadow-sm backdrop-blur">
            <p className="text-sm" style={{ color: RED }}>
              Link ungültig oder abgelaufen. Bitte fordere einen neuen Link auf der Login-Seite an.
            </p>
            <Link
              href="/login"
              className="inline-block text-sm font-semibold underline decoration-[#C8522A]/40 underline-offset-2"
              style={{ color: RED }}
            >
              Zum Login
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border border-black/10 bg-white/85 p-6 shadow-sm backdrop-blur"
          >
            <h2 className="text-center text-base font-semibold" style={{ color: TXT }}>
              Neues Passwort setzen
            </h2>
            <div>
              <label
                htmlFor="reset-password"
                className="mb-2 block text-xs font-semibold uppercase tracking-wide"
                style={{ color: TXT_MUTED }}
              >
                Neues Passwort
              </label>
              <input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mindestens 6 Zeichen"
                className={inputClass}
                disabled={loading}
              />
            </div>
            <div>
              <label
                htmlFor="reset-password-confirm"
                className="mb-2 block text-xs font-semibold uppercase tracking-wide"
                style={{ color: TXT_MUTED }}
              >
                Passwort bestätigen
              </label>
              <input
                id="reset-password-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Passwort wiederholen"
                className={inputClass}
                disabled={loading}
              />
            </div>
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
              {loading ? "Wird gespeichert…" : "Passwort speichern"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
