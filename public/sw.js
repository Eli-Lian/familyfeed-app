self.addEventListener("install", (e) => {
  e.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", (e) => {
  e.respondWith(fetch(e.request));
});

self.addEventListener("push", function (event) {
  let data = {};
  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed && typeof parsed === "object") data = parsed;
    } catch {
      data = {};
    }
  }
  const title = data.title || "DoFam";
  const options = {
    body: data.body || "Neue Nachricht",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [100, 50, 100],
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
  event.waitUntil(self.clients.openWindow(url));
});
