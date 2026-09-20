const CACHE='wtu-v0.11.0';
const ASSETS=['./','index.html','styles.css','app.js','manifest.webmanifest','assets/icon.svg','data/2k17.json','data/2k18.json','data/2k19.json','data/2k20.json','data/2k22.json','data/2k23.json','data/2k24.json','data/2k25.json','data/2k26.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.pathname.endsWith('/version.json')){e.respondWith(fetch(e.request,{cache:'no-store'}));return;}
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});