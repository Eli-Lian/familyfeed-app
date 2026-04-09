"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const BG = "#F5EFE6";
const RED = "#C8522A";
const AMBER = "#C47B0A";
const TXT = "#2C1F14";
const TXT_MUTED = "#7A6555";

const APP_BASE = (process.env.NEXT_PUBLIC_APP_URL ?? "https://familyfeed-app.vercel.app").replace(
  /\/$/,
  ""
);

function randomToken(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

function joinUrlForToken(token: string) {
  return `${APP_BASE}/join?token=${encodeURIComponent(token)}`;
}

type PendingRow = {
  id: string;
  email: string;
  token: string;
  created_at: string;
};

export default function InvitePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyId, setCopyId] = useState<string | null>(null);
  const [emailHint, setEmailHint] = useState<string | null>(null);

  const loadPending = useCallback(async (fid: string) => {
    const { data, error: qErr } = await supabase
      .from("invitations")
      .select("id, email, token, created_at")
      .eq("family_id", fid)
      .is("used_at", null)
      .order("created_at", { ascending: false });
    if (qErr) return;
    setPending((data || []) as PendingRow[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: fam, error: famErr } = await supabase
        .from("families")
        .select("id, name")
        .eq("created_by", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (famErr && !famErr.message?.includes("does not exist")) {
        setError(famErr.message);
        setChecking(false);
        return;
      }
      if (!fam?.id) {
        router.replace("/onboarding");
        return;
      }
      setFamilyId(fam.id);
      setFamilyName(fam.name || "Deine Familie");
      await loadPending(fam.id);
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, loadPending]);

  async function copyLink(token: string, rowId: string) {
    const url = joinUrlForToken(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopyId(rowId);
      setTimeout(() => setCopyId(null), 2000);
    } catch {
      setError("Link konnte nicht kopiert werden.");
    }
  }

  async function sendInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailHint(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !familyId) {
      setError("Bitte eine gültige E-Mail-Adresse eingeben.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Bitte eine gültige E-Mail-Adresse eingeben.");
      return;
    }

    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      router.replace("/login");
      return;
    }

    const token = randomToken();
    const { data: row, error: insErr } = await supabase
      .from("invitations")
      .insert({
        family_id: familyId,
        email: trimmed,
        token,
        invited_by: user.id,
      })
      .select("id, email, token, created_at")
      .single();

    if (insErr || !row) {
      setLoading(false);
      setError(insErr?.message ?? "Einladung konnte nicht gespeichert werden.");
      return;
    }

    const url = joinUrlForToken(token);
    try {
      const res = await fetch("/api/invite/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: trimmed,
          joinUrl: url,
          familyName,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEmailHint("Einladung gespeichert, aber E-Mail-Versand fehlgeschlagen. Nutze «Link kopieren».");
      } else if (json.emailSent === false && json.reason === "no_resend_key") {
        setEmailHint("Einladung gespeichert. Für automatischen E-Mail-Versand RESEND_API_KEY setzen — sonst Link kopieren.");
      }
    } catch {
      setEmailHint("Einladung gespeichert. E-Mail-Versand nicht erreichbar — nutze «Link kopieren».");
    }

    setEmail("");
    await loadPending(familyId);
    setLoading(false);
  }

  const inputClass =
    "w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm text-[#2C1F14] outline-none transition focus:ring-2 focus:ring-[#C8522A]/35 focus:ring-offset-2 focus:ring-offset-[#F5EFE6]";

  if (checking) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ backgroundColor: BG, fontFamily: "var(--font-dm-sans), system-ui, sans-serif" }}
      >
        <p className="text-sm" style={{ color: TXT_MUTED }}>
          Wird geladen…
        </p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen px-4 py-10"
      style={{
        backgroundColor: BG,
        color: TXT,
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
      }}
    >
      <div className="mx-auto w-full max-w-[430px]">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            <span style={{ color: TXT }}>Do</span>
            <span style={{ color: AMBER }}>.</span>
            <span style={{ color: RED }}>Fam</span>
          </h1>
          <p className="mt-2 text-sm font-semibold" style={{ color: TXT }}>
            Familie einladen
          </p>
          <p className="mt-1 text-sm" style={{ color: TXT_MUTED }}>
            Aktuelle Familie: <strong style={{ color: TXT }}>{familyName}</strong>
          </p>
        </header>

        <form
          onSubmit={sendInvite}
          className="mb-8 space-y-4 rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm backdrop-blur"
        >
          <label className="block text-xs font-bold uppercase tracking-wide" style={{ color: TXT_MUTED }}>
            E-Mail-Adresse
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@beispiel.de"
            className={inputClass}
            autoComplete="email"
          />
          {error ? (
            <p className="text-sm" style={{ color: RED }} role="alert">
              {error}
            </p>
          ) : null}
          {emailHint ? (
            <p className="text-xs" style={{ color: AMBER }}>
              {emailHint}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-md disabled:opacity-60"
            style={{ backgroundColor: RED }}
          >
            {loading ? "Wird gesendet…" : "Einladung senden"}
          </button>
        </form>

        <div className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm backdrop-blur">
          <h2 className="mb-3 text-center text-sm font-bold uppercase tracking-wide" style={{ color: TXT_MUTED }}>
            Ausstehende Einladungen
          </h2>
          {pending.length === 0 ? (
            <p className="text-center text-sm" style={{ color: TXT_MUTED }}>
              Noch keine offenen Einladungen.
            </p>
          ) : (
            <ul className="space-y-3">
              {pending.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white/90 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold" style={{ color: TXT }}>
                        {row.email}
                      </div>
                      <div className="text-xs" style={{ color: TXT_MUTED }}>
                        {new Date(row.created_at).toLocaleString("de-DE", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyLink(row.token, row.id)}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                      style={{ backgroundColor: RED }}
                    >
                      {copyId === row.id ? "Kopiert!" : "Link kopieren"}
                    </button>
                  </div>
                  <p
                    className="break-all text-[10px] leading-snug font-mono"
                    style={{ color: TXT_MUTED }}
                  >
                    {joinUrlForToken(row.token)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-6 text-center text-[11px]" style={{ color: TXT_MUTED }}>
          Beitrittslink: {APP_BASE}/join?token=…
        </p>
      </div>
    </div>
  );
}
