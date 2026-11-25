// Unique AI পত্রিকা service worker. build.mjs fills in the version and the precache list.
var V = "__VERSION__";
var SHELL = "uap-shell-" + V, PAGES = "uap-pages", IMGS = "uap-img", DATA = "uap-data";
var PRECACHE = __PRECACHE__;
var DAILY = __DAILY__; // রোজের API (অন্য ডোমেইন): GET আগে নেট, না পেলে শেষ কপি; POST কখনও ধরা হয় না
var SCOPE = self.registration.scope;
var OFFLINE = new URL("offline/", SCOPE).href;

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) { return c.addAll(PRECACHE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("uap-") === 0 && [SHELL, PAGES, IMGS, DATA].indexOf(k) < 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function trim(name, max) {
  return caches.open(name).then(function (c) {
    return c.keys().then(function (keys) { return Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map(function (k) { return c.delete(k); })); });
  });
}

// HTML: আগে নেট, না পেলে আগে রাখা পাতা, তাও না থাকলে অফলাইন পাতা
function page(e) {
  var req = e.request;
  return fetch(req).then(function (res) {
    if (res && res.ok && res.type === "basic") {
      var copy = res.clone();
      e.waitUntil(caches.open(PAGES).then(function (c) { return c.put(req.url.split("?")[0], copy); }).then(function () { return trim(PAGES, 60); }));
    }
    return res;
  }).catch(function () {
    return caches.match(req.url.split("?")[0]).then(function (m) {
      return m || caches.match(req, { ignoreSearch: true });
    }).then(function (m) {
      return m || caches.match(OFFLINE);
    }).then(function (m) {
      return m || new Response("আপনি অফলাইনে আছেন", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    });
  });
}

// ছবি: হাতে থাকা কপি সঙ্গে সঙ্গে, পেছনে নতুন কপি আনা
function images(e) {
  var req = e.request;
  return caches.open(IMGS).then(function (c) {
    return c.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.ok) { c.put(req, res.clone()).then(function () { return trim(IMGS, 120); }); }
        return res;
      }).catch(function () { return hit || caches.match(req, { ignoreSearch: true }).then(function (m) { return m || Response.error(); }); });
      if (hit) { e.waitUntil(net.catch(function () {})); return hit; }
      return net;
    });
  });
}

// ডেটা (search.json): আগে নেট, না পেলে আগের কপি
function data(e) {
  var req = e.request;
  return fetch(req).then(function (res) {
    if (res && res.ok) { var copy = res.clone(); e.waitUntil(caches.open(DATA).then(function (c) { return c.put(req.url.split("?")[0], copy); })); }
    return res;
  }).catch(function () { return caches.match(req.url.split("?")[0]).then(function (m) { return m || new Response("[]", { headers: { "Content-Type": "application/json" } }); }); });
}

// রোজের API: আজকের প্রশ্ন/প্রম্পট আর সাপ্তাহিক সেরা, আগে নেট; অফলাইনে শেষ কপি
function daily(e) {
  var req = e.request;
  return fetch(req).then(function (res) {
    if (res && res.ok) { var copy = res.clone(); e.waitUntil(caches.open(DATA).then(function (c) { return c.put(req.url, copy); })); }
    return res;
  }).catch(function () {
    return caches.match(req.url).then(function (m) { return m || new Response('{"offline":true}', { status: 503, headers: { "Content-Type": "application/json" } }); });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  if (DAILY && req.url.indexOf(DAILY) === 0) { if (/[?&]action=(today|leaderboard)(&|$)/.test(req.url)) e.respondWith(daily(e)); return; }
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") { e.respondWith(page(e)); return; }
  if (/\/search\.json$/.test(url.pathname)) { e.respondWith(data(e)); return; }
  if (req.destination === "image") { e.respondWith(images(e)); return; }
  e.respondWith(caches.match(req).then(function (m) { return m || fetch(req); }));
});

// ---- push notification ----
self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : "" }; }
  var url = (d.data && d.data.url) || d.url || SCOPE;
  var same = function (u) { try { return new URL(u, SCOPE).origin === new URL(SCOPE).origin ? new URL(u, SCOPE).href : null; } catch (x) { return null; } };
  e.waitUntil(self.registration.showNotification(d.title || "Unique AI পত্রিকা", {
    body: d.body || "",
    icon: (d.icon && same(d.icon)) || new URL("assets/app/icon-192.png", SCOPE).href,
    badge: (d.badge && same(d.badge)) || new URL("assets/app/badge-96.png", SCOPE).href,
    tag: d.tag || undefined,
    lang: "bn",
    data: { url: url },
  }));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var target;
  try { target = new URL((e.notification.data && e.notification.data.url) || SCOPE, SCOPE); } catch (err) { target = new URL(SCOPE); }
  if (target.origin !== self.location.origin) target = new URL(SCOPE); // শুধু নিজের সাইটের লিংক খোলে
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url === target.href && "focus" in list[i]) return list[i].focus();
    }
    return self.clients.openWindow(target.href);
  }));
});
