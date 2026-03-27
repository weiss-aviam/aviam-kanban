/// <reference lib="webworker" />

// Cast self to ServiceWorkerGlobalScope — the project tsconfig includes "dom"
// which types self as Window, so we need an explicit cast here.
 
const sw = self as unknown as ServiceWorkerGlobalScope;

/**
 * Handle notification clicks.
 *
 * Chrome requires a notificationclick handler in the SW; without one it silently
 * drops showNotification() calls in installed PWAs.  This handler closes the
 * notification and brings the app to the foreground (or opens a new window if
 * the app is not already open).
 */
sw.addEventListener("notificationclick", (event) => {
  const e = event as NotificationEvent;
  e.notification.close();

  const urlToOpen = new URL("/boards", sw.location.origin).href;

  e.waitUntil(
    sw.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // If the app is already open in a window, focus it
        for (const client of windowClients) {
          if (client.url.startsWith(sw.location.origin) && "focus" in client) {
            return (client as WindowClient).focus();
          }
        }
        // Otherwise open a new window to the boards page
        return sw.clients.openWindow(urlToOpen);
      }),
  );
});
