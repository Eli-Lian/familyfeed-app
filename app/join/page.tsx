"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const BG = "#F5EFE6";
const RED = "#C8522A";
const AMBER = "#C47B0A";
const TXT = "#2C1F14";
const TXT_MUTED = "#7A6555";

const MEMBER_COLORS = ["#C8522A", "#3A6DBF", "#3D8C6E", "#C47B0A", "#7B4F8E", "#2A6B50"] as const;
const EMOJI_OPTIONS = ["👩", "👨", "👧", "👦", "👶", "👵", "👴", "🧒", "🐶", "🐱", "⭐", "🌈"];

type Role = "Elternteil" | "Kind";

type InviteInfo = {
  invitation_id: string;
  family_id: string;
  family_name: string;
  email: string;
};

type InvalidReason = "missing" | "not_found" | "used";

/** PostgREST may return one row as an object instead of a one-element array. */
function rowsFromRpcInviteData(data: unknown): InviteInfo[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data as InviteInfo[];
  if (typeof data === "object" && data !== null && "invitation_id" in data) {
    return [data as InviteInfo];
  }
  return [];
}

async function fetchInviteByToken(token: string): Promise<{ invite: InviteInfo | null; reason: InvalidReason | null }> {
  try {
    const res = await fetch(`/api/invite/validate?token=${encodeURIComponent(token)}`);
    const json = (await res.json()) as
      | { ok: true; invite: InviteInfo }
      | { ok: false; reason: string; message?: string };

    if ("ok" in json && json.ok && json.invite) {
      return { invite: json.invite, reason: null };
    }

    const reason = "reason" in json ? json.reason : "";
    if (reason === "already_used") {
      return { invite: null, reason: "used" };
    }
    if (reason === "not_found" || reason === "missing_token") {
      return { invite: null, reason: "not_found" };
    }

    // Server misconfigured or query error — fall back to RPC (same DB rules as get_invitation_by_token)
    if (res.status >= 500 || reason === "config" || reason === "query_error") {
      const { data, error: rpcErr } = await supabase.rpc("get_invitation_by_token", {
        p_token: token,
      });
      if (!rpcErr) {
        const rows = rowsFromRpcInviteData(data);
        if (rows.length > 0) {
          return { invite: rows[0], reason: null };
        }
      }
    }

    return { invite: null, reason: "not_found" };
  } catch {
    const { data, error: rpcErr } = await supabase.rpc("get_invitation_by_token", {
      p_token: token,
    });
    if (!rpcErr) {
      const rows = rowsFromRpcInviteData(data);
      if (rows.length > 0) {
        return { invite: rows[0], reason: null };
      }
    }
    return { invite: null, reason: "not_found" };
  }
}

function JoinPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [checking, setChecking] = useState(true);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [invalidReason, setInvalidReason] = useState<InvalidReason | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("Elternteil");
  const [avatar, setAvatar] = useState(EMOJI_OPTIONS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setInvalidReason("missing");
        setChecking(false);
        return;
      }
      const { invite: row, reason } = await fetchInviteByToken(token);
      if (cancelled) return;
      if (row) {
        setInvite(row);
        setInvalidReason(null);
      } else {
        setInvite(null);
        setInvalidReason(reason ?? "not_found");
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const n = name.trim();
    if (!n || !token) {
      setError("Bitte gib deinen Namen ein.");
      return;
    }
    setSubmitting(true);
    const color = MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)];
    const { error: rpcErr } = await supabase.rpc("accept_family_invitation", {
      p_token: token,
      p_name: n,
      p_role: role,
      p_avatar: avatar || "👤",
      p_color: color,
    });
    setSubmitting(false);
    if (rpcErr) {
      setError(rpcErr.message || "Beitritt fehlgeschlagen.");
      return;
    }
    router.replace("/login");
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

  if (!invite) {
    const title =
      invalidReason === "missing"
        ? "Kein Einladungscode"
        : invalidReason === "used"
          ? "Link bereits verwendet"
          : "Link ungültig oder abgelaufen";
    const message =
      invalidReason === "missing"
        ? "Öffne den Link aus der Einladungs-E-Mail oder lasse dir einen neuen Link schicken."
        : invalidReason === "used"
          ? "Dieser Einladungslink wurde bereits genutzt. Bitte eine neue Einladung anfordern."
          : "Dieser Link ist ungültig oder existiert nicht. Bitte eine neue Einladung anfordern.";
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
        style={{
          backgroundColor: BG,
          color: TXT,
          fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        }}
      >
        <p className="text-4xl">🏡</p>
        <h1 className="mt-4 text-lg font-bold">{title}</h1>
        <p className="mt-2 max-w-sm text-sm" style={{ color: TXT_MUTED }}>
          {message}
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
        </header>

        <div className="mb-6 rounded-2xl border border-black/10 bg-white/80 p-6 text-center shadow-sm backdrop-blur">
          <p className="text-lg font-semibold leading-snug">
            Du wurdest zu DoFam eingeladen! 🎉
          </p>
          <p className="mt-2 text-sm" style={{ color: TXT_MUTED }}>
            Familie <strong style={{ color: TXT }}>{invite.family_name}</strong>
          </p>
          <p className="mt-1 text-xs" style={{ color: TXT_MUTED }}>
            {invite.email}
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm backdrop-blur"
        >
          <p className="text-center text-sm font-medium" style={{ color: TXT_MUTED }}>
            Wie sollen dich deine Familie sehen?
          </p>
          <div>
            <label htmlFor="join-name" className="sr-only">
              Name
            </label>
            <input
              id="join-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dein Name"
              className={inputClass}
              autoComplete="name"
            />
          </div>
          <div>
            <label htmlFor="join-role" className="sr-only">
              Rolle
            </label>
            <select
              id="join-role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className={inputClass}
            >
              <option value="Elternteil">Elternteil</option>
              <option value="Kind">Kind</option>
            </select>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: TXT_MUTED }}>
              Avatar
            </p>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((emo) => (
                <button
                  key={emo}
                  type="button"
                  onClick={() => setAvatar(emo)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border-2 text-xl transition"
                  style={{
                    borderColor: avatar === emo ? RED : "transparent",
                    backgroundColor: avatar === emo ? "rgba(200,82,42,0.08)" : "rgba(0,0,0,0.04)",
                  }}
                  aria-label={`Emoji ${emo}`}
                >
                  {emo}
                </button>
              ))}
            </div>
          </div>
          {error ? (
            <p className="text-sm" style={{ color: RED }} role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-md disabled:opacity-60"
            style={{ backgroundColor: RED }}
          >
            {submitting ? "Speichern…" : "Beitreten & zum Login"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs" style={{ color: TXT_MUTED }}>
          Nach dem Beitritt kannst du dir ein Konto anlegen und dich anmelden.
        </p>
      </div>
    </div>
  );
}

function JoinLoading() {
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

export default function JoinPage() {
  return (
    <Suspense fallback={<JoinLoading />}>
      <JoinPageInner />
    </Suspense>
  );
}
