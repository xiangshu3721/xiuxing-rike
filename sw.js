/* 修行日课 service worker
 * 页面（HTML）走「网络优先」，有网就拿最新版，没网才用缓存；
 * 静态资源都带 ?v= 版本号，走「缓存优先」。发新版时改下面的 VERSION 和 index.html 里的 ?v=。 */
var VERSION = 'v17';
var CACHE = 'xiuxing-rike-' + VERSION;
var ASSETS = [
  './',
  'index.html',
  'style.css?v=17',
  'app.js?v=17',
  'manifest.webmanifest?v=17',
  'icons/icon-192.png?v=17',
  'icons/icon-512.png?v=17',
  'icons/apple-touch-icon.png?v=17',
  'icons/favicon-64.png?v=17',
  'img/chanhui.jpg?v=17'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('xiuxing-rike-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // 只管本应用目录下的请求；同域其他项目（如 /huichun/）和外链一律不拦截、不缓存
  if (url.pathname.indexOf(new URL(self.registration.scope).pathname) !== 0) return;

  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req, { cache: 'no-store' }).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./', copy); });
        return res;
      }).catch(function () {
        return caches.match('./').then(function (r) { return r || caches.match('index.html'); });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    })
  );
});
