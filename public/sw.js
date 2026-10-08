/* GoofyAhhTalk service worker: push + notification click. No offline caching. */
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'GoofyAhhTalk'
  const url = data.url || '/'
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const focused = wins.find((c) => c.focused)
      if (focused) {
        focused.postMessage({ type: 'push', data })
        return
      }
      await self.registration.showNotification(title, {
        body: data.body || '',
        tag: data.tag || undefined,
        renotify: !!data.tag,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url },
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const same = wins.filter((c) => new URL(c.url).origin === self.location.origin)
      const client = same.find((c) => c.focused) || same.find((c) => c.visibilityState === 'visible') || same[0]
      if (client) {
        try {
          await client.focus()
        } catch (e) {
          /* ignore */
        }
        // in-app navigation (no reload); fall back to a real navigation
        try {
          client.postMessage({ type: 'navigate', url: target })
        } catch (e) {
          if ('navigate' in client) {
            try {
              await client.navigate(target)
            } catch (e2) {
              /* ignore */
            }
          }
        }
        return
      }
      await self.clients.openWindow(target)
    })(),
  )
})
