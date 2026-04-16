"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const BG = "#F5EFE6";
const RED = "#C8522A";
const TXT = "#2C1F14";
const TXT_MUTED = "#7A6555";

const EMOJI_OPTIONS = ["👶", "🧒", "👧", "👦", "🧑", "👩", "👨", "👴", "👵", "🧔"] as const;

type Role = "Elternteil" | "Kind" | "Grosseltern" | "Andere";

type InviteInfo = {
  invitation_id: string;
  family_id: string;
  family_name: string;
  email: string;
};

type InvalidReason = "missing" | "not_found" | "used";

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
  const [avatar, setAvatar] = useState<string>(EMOJI_OPTIONS[0]);
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
      if (!row) {
        setInvite(null);
        setInvalidReason(reason ?? "not_found");
        setChecking(false);
        return;
      }
      setInvite(row);
      setInvalidReason(null);
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function goToLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const n = name.trim();
    if (!n || !token) {
      setError("Bitte gib deinen Namen ein.");
      return;
    }
    const q = [
      `token=${encodeURIComponent(token)}`,
      `name=${encodeURIComponent(n)}`,
      `role=${encodeURIComponent(role)}`,
      `avatar=${encodeURIComponent(avatar || "👤")}`,
    ].join("&");
    router.push(`/login?${q}`);
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
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: RED }}>
            Willkommen bei DoFam! 🏡
          </h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: TXT_MUTED }}>
            Bitte gib deinen Namen ein bevor du beitrittst
          </p>
          <p className="mt-2 text-xs" style={{ color: TXT_MUTED }}>
            Familie <strong style={{ color: TXT }}>{invite.family_name}</strong>
          </p>
        </header>

        <form
          onSubmit={goToLogin}
          className="space-y-5 rounded-2xl border border-black/10 bg-white/85 p-6 shadow-sm backdrop-blur"
        >
          <div>
            <label
              htmlFor="join-name"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide"
              style={{ color: TXT_MUTED }}
            >
              Name & Profil <span style={{ color: RED }}>*</span>
            </label>
            <input
              id="join-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dein Vorname"
              className={inputClass}
              autoComplete="given-name"
            />
          </div>

          <div>
            <label
              htmlFor="join-role"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide"
              style={{ color: TXT_MUTED }}
            >
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
              <option value="Grosseltern">Grosseltern</option>
              <option value="Andere">Andere</option>
            </select>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: TXT_MUTED }}>
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
                  aria-label={`Avatar ${emo}`}
                  aria-pressed={avatar === emo}
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
            className="w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
            style={{ backgroundColor: RED }}
          >
            Weiter →
          </button>
        </form>
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
