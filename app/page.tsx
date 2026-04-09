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
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        router.push("/login");
        return;
      }

      // limit(1): reliable with 0 or 1+ rows (avoid .single() PGRST116 / multiple-row errors)
      const { data: famRows, error: famErr } = await supabase
        .from("families")
        .select("id")
        .eq("created_by", user.id)
        .limit(1);

      if (cancelled) return;

      if (famErr) {
        setLoading(false);
        return;
      }

      if (!famRows?.length) {
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
