import { supabase } from "./supabase";

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(memberId: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (!VAPID_PUBLIC_KEY) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id) {
    const { data: mem } = await supabase.from("members").select("user_id").eq("id", memberId).maybeSingle();
    const existing = mem?.user_id as string | null | undefined;
    if (existing == null || existing === user.id) {
      await supabase.from("members").update({ user_id: user.id }).eq("id", memberId);
    }
  }

  await supabase.from("push_subscriptions").upsert(
    {
      member_id: memberId,
      subscription: JSON.stringify(subscription),
    },
    { onConflict: "member_id" }
  );
}
