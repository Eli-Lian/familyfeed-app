"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const BG = "#F5EFE6";
const RED = "#C8522A";
const AMBER = "#C47B0A";
const TXT = "#2C1F14";
const TXT_MUTED = "#7A6555";
const MAX_MEMBERS = 6;

const MEMBER_COLORS = ["#C8522A", "#3A6DBF", "#3D8C6E", "#C47B0A", "#7B4F8E", "#2A6B50"] as const;

const EMOJI_OPTIONS = ["👩", "👨", "👧", "👦", "👶", "👵", "👴", "🧒", "🐶", "🐱", "⭐", "🌈"];

type Role = "Elternteil" | "Kind";

interface DraftMember {
  id: string;
  name: string;
  role: Role;
  avatar: string;
}

function uid() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [familyName, setFamilyName] = useState("");
  const [members, setMembers] = useState<DraftMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const { data: existing, error: famErr } = await supabase
        .from("families")
        .select("id")
        .eq("created_by", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (famErr && famErr.code !== "PGRST116" && !famErr.message?.includes("does not exist")) {
        setError(famErr.message);
        setChecking(false);
        return;
      }
      if (existing?.id) {
        router.replace("/");
        return;
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function addMember() {
    if (members.length >= MAX_MEMBERS) return;
    setMembers((prev) => [
      ...prev,
      {
        id: uid(),
        name: "",
        role: "Elternteil",
        avatar: EMOJI_OPTIONS[prev.length % EMOJI_OPTIONS.length],
      },
    ]);
  }

  function updateMember(id: string, patch: Partial<DraftMember>) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function removeMember(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  function goStep2(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const name = familyName.trim();
    if (!name) {
      setError("Bitte gib einen Familiennamen ein.");
      return;
    }
    setStep(2);
    setMembers((prev) =>
      prev.length > 0
        ? prev
        : [
            {
              id: uid(),
              name: "",
              role: "Elternteil",
              avatar: EMOJI_OPTIONS[0],
            },
          ]
    );
  }

  async function finishOnboarding(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (members.length === 0) {
      setError("Füge mindestens ein Mitglied hinzu.");
      return;
    }
    for (const m of members) {
      if (!m.name.trim()) {
        setError("Bitte für jedes Mitglied einen Namen eintragen.");
        return;
      }
    }

    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      router.replace("/login");
      return;
    }

    const { data: family, error: famErr } = await supabase
      .from("families")
      .insert({ name: familyName.trim(), created_by: user.id })
      .select("id")
      .single();

    if (famErr || !family) {
      setLoading(false);
      setError(
        famErr?.message ??
          "Familie konnte nicht gespeichert werden. Ist die Datenbank-Migration ausgeführt?"
      );
      return;
    }

    const ownerUserId = session?.user?.id ?? user.id;
    const rows = members.map((m, i) => ({
      family_id: family.id,
      name: m.name.trim(),
      role: m.role,
      avatar: m.avatar || "👤",
      color: MEMBER_COLORS[i % MEMBER_COLORS.length],
      photo_url: null as string | null,
      user_id: i === 0 ? ownerUserId : null,
    }));

    const { error: memErr } = await supabase.from("members").insert(rows);

    if (memErr) {
      await supabase.from("families").delete().eq("id", family.id);
      setLoading(false);
      setError(memErr.message);
      return;
    }

    // Confirm family is readable (same query shape as home) before leaving onboarding
    const { data: verifyRows, error: verifyErr } = await supabase
      .from("families")
      .select("id")
      .eq("created_by", user.id)
      .eq("id", family.id)
      .limit(1);

    if (verifyErr || !verifyRows?.length) {
      setLoading(false);
      setError(
        verifyErr?.message ??
          "Daten gespeichert, aber die Familie ist noch nicht sichtbar. Bitte Seite neu laden."
      );
      return;
    }

    setLoading(false);
    router.push("/");
    router.refresh();
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
        </header>

        {step === 1 ? (
          <form
            onSubmit={goStep2}
            className="space-y-5 rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm backdrop-blur"
          >
            <h2 className="text-center text-lg font-semibold">Willkommen bei DoFam! 🏡</h2>
            <p className="text-center text-sm" style={{ color: TXT_MUTED }}>
              Wie heisst eure Familie?
            </p>
            <div>
              <label htmlFor="family-name" className="sr-only">
                Familienname
              </label>
              <input
                id="family-name"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="z.B. Familie Müller"
                className={inputClass}
                autoComplete="organization"
              />
            </div>
            {error ? (
              <p className="text-sm" style={{ color: RED }} role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              className="w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-md"
              style={{ backgroundColor: RED }}
            >
              Weiter
            </button>
          </form>
        ) : (
          <form
            onSubmit={finishOnboarding}
            className="space-y-5 rounded-2xl border border-black/10 bg-white/80 p-6 shadow-sm backdrop-blur"
          >
            <h2 className="text-center text-lg font-semibold">Wer gehört dazu?</h2>
            <p className="text-center text-xs" style={{ color: TXT_MUTED }}>
              Bis zu {MAX_MEMBERS} Mitglieder
            </p>

            <div className="space-y-4">
              {members.map((m, index) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-black/10 bg-white/90 p-4"
                  style={{
                    borderLeftWidth: 3,
                    borderLeftColor: MEMBER_COLORS[index % MEMBER_COLORS.length],
                  }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase" style={{ color: TXT_MUTED }}>
                      Mitglied {index + 1}
                    </span>
                    {members.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeMember(m.id)}
                        className="text-xs font-medium underline"
                        style={{ color: RED }}
                      >
                        Entfernen
                      </button>
                    ) : null}
                  </div>
                  <input
                    value={m.name}
                    onChange={(e) => updateMember(m.id, { name: e.target.value })}
                    placeholder="Name"
                    className={`${inputClass} mb-3`}
                  />
                  <select
                    value={m.role}
                    onChange={(e) => updateMember(m.id, { role: e.target.value as Role })}
                    className={`${inputClass} mb-3`}
                  >
                    <option value="Elternteil">Elternteil</option>
                    <option value="Kind">Kind</option>
                  </select>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase" style={{ color: TXT_MUTED }}>
                      Avatar
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {EMOJI_OPTIONS.map((emo) => (
                        <button
                          key={emo}
                          type="button"
                          onClick={() => updateMember(m.id, { avatar: emo })}
                          className="flex h-10 w-10 items-center justify-center rounded-lg border-2 text-xl transition"
                          style={{
                            borderColor: m.avatar === emo ? RED : "transparent",
                            backgroundColor: m.avatar === emo ? "rgba(200,82,42,0.08)" : "rgba(0,0,0,0.04)",
                          }}
                          aria-label={`Emoji ${emo}`}
                        >
                          {emo}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {members.length < MAX_MEMBERS ? (
              <button
                type="button"
                onClick={addMember}
                className="w-full rounded-xl border-2 py-3 text-sm font-semibold"
                style={{ borderColor: AMBER, color: AMBER }}
              >
                Mitglied hinzufügen
              </button>
            ) : null}

            {error ? (
              <p className="text-sm" style={{ color: RED }} role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-md disabled:opacity-60"
              style={{ backgroundColor: RED }}
            >
              {loading ? "Speichern…" : "DoFam starten"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
