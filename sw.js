const V = 'mna-v13', SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'logo-192.png', 'logo-512.png', 'logo.png', 'logo-entete.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V && x !== 'mna-meta').map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(x => { const c = x.clone(); caches.open(V).then(k => k.put(r, c)); return x; }).catch(() => caches.match(r)));
});
// Notifications push : affichées seulement si l'application n'est pas ouverte à l'écran
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch (_) {}
  e.waitUntil((async () => {
    const cs = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (cs.some(c => c.visibilityState === 'visible')) return;
    // Ne montre la notification que si elle est destinée au compte actuellement connecté sur cet appareil
    const rep = await (await caches.open('mna-meta')).match('uid'); const uid = rep ? await rep.text() : null;
    if (d.uid && uid !== null && d.uid !== uid) return;
    await self.registration.showNotification(d.title || 'MNA Connect', {
      body: d.body || '', icon: 'logo-192.png', badge: 'logo-192.png', tag: d.tag || 'mna', renotify: true, vibrate: [120, 60, 120], data: d });
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const d = e.notification.data || {};
  e.waitUntil((async () => {
    const cs = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (cs[0]) { await cs[0].focus(); cs[0].postMessage({ type: 'ouvrir', tab: d.tab, conv: d.conv }); }
    else await clients.openWindow('./?ouvrir=' + encodeURIComponent(JSON.stringify({ tab: d.tab, conv: d.conv })));
  })());
});
