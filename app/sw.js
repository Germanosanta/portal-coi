/* ── SERVICE WORKER — Portal COI (PWA) ────────────────────────────────
   Objetivo real, sem prometer o que não existe: o Portal COI depende do
   Supabase (rede) para todo dado — Horímetro, Paradas, Cadastros, etc.
   NÃO existe modo offline de dados aqui. O que este service worker faz
   de verdade é cachear o "app shell" (HTML/CSS/JS/ícones) para que:
     1) a instalação como app funcione (exigência de PWA instalável);
     2) o app abra rápido (cache local) mesmo em conexão ruim;
     3) se a conexão cair DEPOIS de já ter aberto, a interface (telas,
        menus, layout) continua carregando — só as chamadas ao Supabase
        (dados reais) falham, como já falhavam sem PWA nenhum.
   Chamadas para o Supabase (hzduodmytbkqjbbyizkb.supabase.co) NUNCA são
   interceptadas/cacheadas aqui — sempre vão direto pra rede.
   ──────────────────────────────────────────────────────────────────── */

const CACHE_VERSION = 'coi-shell-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './assets/favicon-coi.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(PRECACHE_URLS).catch(()=>{ /* um recurso ausente não pode travar a instalação */ }))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names.filter(n => n !== CACHE_VERSION).map(n => caches.delete(n))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Só GET, só mesma origem — nunca intercepta o Supabase (outra origem)
  // nem métodos de escrita.
  if(req.method !== 'GET' || url.origin !== self.location.origin){
    return;
  }

  // Navegação (abrir/recarregar a página): network-first, cai pro cache
  // se estiver offline — garante que o app shell abre mesmo sem rede.
  if(req.mode === 'navigate'){
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Estáticos (css/js/imagens/manifest): cache-first, atualiza o cache
  // em segundo plano (stale-while-revalidate) — não serve pra chamadas
  // à API do Supabase porque essas são de outra origem (já filtrado acima).
  event.respondWith(
    caches.match(req).then(cached => {
      const networkFetch = fetch(req).then(res => {
        if(res && res.ok){
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
