import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

type PushBody = {
  familyId?: string;
  title?: string;
  body?: string;
  url?: string;
};

export async function POST(req: NextRequest) {
  let body: PushBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const familyId = body.familyId?.trim();
  const title = body.title?.trim() || "DoFam";
  const text = body.body?.trim() || "Neue Nachricht";
  const url = body.url?.trim() || "/";

  if (!familyId) {
    return NextResponse.json({ ok: false, error: "familyId required" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicVapid = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateVapid = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:support@dofam.app";

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
  }
  if (!publicVapid || !privateVapid) {
    return NextResponse.json({ ok: false, error: "VAPID keys missing" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser(token);
  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: fam, error: famErr } = await admin.from("families").select("id").eq("id", familyId).maybeSingle();
  if (famErr || !fam) {
    return NextResponse.json({ ok: false, error: "Family not found" }, { status: 404 });
  }

  const { data: familyMembers, error: memErr } = await admin.from("members").select("id").eq("family_id", familyId);
  if (memErr) {
    return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 });
  }

  const memberIds = (familyMembers || []).map((m) => m.id);
  if (memberIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, failed: 0, subscriptions: 0 });
  }

  const { data: subs, error: subErr } = await admin
    .from("push_subscriptions")
    .select("member_id, subscription")
    .in("member_id", memberIds);
  if (subErr) {
    return NextResponse.json({ ok: false, error: subErr.message }, { status: 500 });
  }

  webpush.setVapidDetails(vapidSubject, publicVapid, privateVapid);

  const payload = JSON.stringify({ title, body: text, url });
  let sent = 0;
  let failed = 0;

  for (const row of subs || []) {
    let sub: webpush.PushSubscription;
    try {
      sub = JSON.parse(row.subscription) as webpush.PushSubscription;
    } catch {
      failed += 1;
      continue;
    }
    try {
      await webpush.sendNotification(sub, payload);
      sent += 1;
    } catch (err: unknown) {
      failed += 1;
      const status =
        typeof err === "object" && err !== null && "statusCode" in err
          ? (err as { statusCode?: number }).statusCode
          : undefined;
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").delete().eq("member_id", row.member_id);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    failed,
    subscriptions: (subs || []).length,
    members: memberIds.length,
  });
}
