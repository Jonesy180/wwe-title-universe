const CACHE='wtu-v1.1.1';
const ASSETS=[
  './',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest',
  'version.json',
  'assets/deadman-arena-bg.webp',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable-512.png',
  'assets/apple-touch-icon.png',
  'data/2k15.json',
  'data/2k16.json',
  'data/2k17.json',
  'data/2k18.json',
  'data/2k19.json',
  'data/2k20.json',
  'data/2k22.json',
  'data/2k23.json',
  'data/2k24.json',
  'data/2k25.json',
  'data/2k26.json'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;

  if(event.request.mode==='navigate'){
    event.respondWith(
      fetch(event.request)
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put('./',copy)).catch(()=>{});
          return response;
        })
        .catch(()=>caches.match('./'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>cached||fetch(event.request))
  );
});