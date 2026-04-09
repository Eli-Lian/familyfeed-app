import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let body: { to?: string; joinUrl?: string; familyName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const to = body.to?.trim();
  const joinUrl = body.joinUrl?.trim();
  const familyName = body.familyName?.trim() || "DoFam";
  if (!to || !joinUrl) {
    return NextResponse.json({ ok: false, error: "to and joinUrl required" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: true, emailSent: false, reason: "no_resend_key" });
  }

  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: `Einladung zu DoFam — ${familyName}`,
      html: `<p>Du wurdest zu <strong>${escapeHtml(familyName)}</strong> auf DoFam eingeladen.</p>
<p><a href="${escapeHtml(joinUrl)}">Jetzt beitreten</a></p>
<p style="color:#666;font-size:13px">Falls der Link nicht funktioniert, kopiere diese Adresse in den Browser:<br/><span style="word-break:break-all">${escapeHtml(joinUrl)}</span></p>`,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ ok: false, error: text }, { status: 502 });
  }

  return NextResponse.json({ ok: true, emailSent: true });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
