import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side validation: queries `invitations` by token with service role.
 * The browser cannot safely SELECT from `invitations` as anon (RLS only allows family owners).
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ ok: false as const, reason: "missing_token" });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false as const, reason: "config" }, { status: 500 });
  }

  // Service role bypasses RLS; use only on the server. Never expose this key to the client.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: inv, error } = await admin
    .from("invitations")
    .select("id, family_id, email, used_at, families(name)")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false as const, reason: "query_error", message: error.message },
      { status: 500 }
    );
  }

  if (!inv) {
    return NextResponse.json({ ok: false as const, reason: "not_found" });
  }

  if (inv.used_at != null) {
    return NextResponse.json({ ok: false as const, reason: "already_used" });
  }

  const famRaw = inv.families as unknown as { name: string | null } | { name: string | null }[] | null;
  const familyName =
    Array.isArray(famRaw) ? (famRaw[0]?.name ?? "Deine Familie") : (famRaw?.name ?? "Deine Familie");

  return NextResponse.json({
    ok: true as const,
    invite: {
      invitation_id: inv.id,
      family_id: inv.family_id,
      family_name: familyName,
      email: inv.email,
    },
  });
}
