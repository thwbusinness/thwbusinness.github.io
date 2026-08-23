/* Service Worker: App-Hülle offline verfügbar halten.
   Strategie: network-first mit Cache-Fallback – so ist ein Update
   sofort da, die App startet aber auch ohne Netz. */
var CACHE = "frequenz-v10";
var ASSETS = ["./", "./index.html", "./config.js", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener("fetch", function(e){
  if(e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(function(res){
      var copy = res.clone();
      caches.open(CACHE).then(function(c){ c.put(e.request, copy); }).catch(function(){});
      return res;
    }).catch(function(){
      return caches.match(e.request).then(function(hit){
        return hit || caches.match("./index.html");
      });
    })
  );
});

/* ---------------------------------------------------------
   Push-Erinnerungen

   Die Nachricht kommt von der Edge Function send-reminders;
   der Service Worker zeigt sie an und öffnet beim Antippen
   die passende Stelle in der App.
   --------------------------------------------------------- */
self.addEventListener("push", function(e){
  var data = {};
  try{ data = e.data ? e.data.json() : {}; }catch(err){ data = { body: e.data ? e.data.text() : "" }; }
  var title = data.title || "Frequenz-Tagebuch";
  var opts = {
    body: data.body || "Zeit für deinen Eintrag.",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    tag: data.tag || "erinnerung",
    renotify: false,
    data: { url: data.url || "./index.html#/tagebuch" }
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener("notificationclick", function(e){
  e.notification.close();
  var target = (e.notification.data && e.notification.data.url) || "./index.html#/tagebuch";
  e.waitUntil(
    self.clients.matchAll({ type:"window", includeUncontrolled:true }).then(function(list){
      for(var i = 0; i < list.length; i++){
        if(list[i].url.indexOf(self.registration.scope) === 0 && "focus" in list[i]){
          list[i].navigate(target);
          return list[i].focus();
        }
      }
      if(self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
