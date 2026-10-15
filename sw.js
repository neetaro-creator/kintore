// オフライン用の Service Worker。
// アプリ本体は、版ごとのキャッシュにまとめて入れ、起動はキャッシュから行う（電波が弱くても待たない）。
// 更新のたびに CACHE を上げる（app.js の BUILD と同じ値）。新しい版は、全部そろってから切り替わる。
const CACHE = 'kintore-p2-1015-d';
const FILES = ['./', 'index.html', 'style.css', 'logic.js', 'db.js', 'presets.js', 'app.js', 'figure.js', 'drag.js', 'timer.js', 'manifest.json', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  // GitHub Pages はブラウザに約10分キャッシュされるので、必ずサーバーから取り直す
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE)
      .then(c => c.match(e.request, { ignoreSearch: true }))
      .then(hit => hit || fetch(e.request))
  );
});
