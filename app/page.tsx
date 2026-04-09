"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import FamilyApp from "@/app/components/FamilyApp";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session) {
        router.push("/login");
        return;
      }

      const { data: family, error: famErr } = await supabase
        .from("families")
        .select("id")
        .eq("created_by", session.user.id)
        .single();

      if (cancelled) return;

      // 0 rows → PGRST116; treat as "no family" → onboarding
      if (famErr && famErr.code !== "PGRST116") {
        setLoading(false);
        return;
      }

      if (!family) {
        router.push("/onboarding");
        return;
      }

      setReady(true);
      setLoading(false);
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <div
        style={{
          background: "#F5EFE6",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-dm-sans), DM Sans, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏡</div>
          <div style={{ fontSize: 16, color: "#7A6555", fontWeight: 600 }}>DoFam lädt...</div>
        </div>
      </div>
    );
  }

  if (ready) return <FamilyApp />;
  return null;
}
