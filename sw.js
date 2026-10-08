// ===================================================================
// ======================  SERVICE WORKER  ===========================
// ===================================================================

const CACHE_NAME = "nervus-iris-v1";

// Arquivos que ficam em cache (o app funcionará offline com eles)
const ARQUIVOS_CACHE = [
  "./",
  "./index.html",
  "./agendar.html",
  "./style.css",
  "./agendar.css",
  "./api.js",           
  "./app.js",
  "./agendar.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// ===== Instalação: baixa e guarda tudo =====
self.addEventListener("install", (event) => {
  console.log("[SW] Instalando...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Cacheando arquivos...");
      return cache.addAll(ARQUIVOS_CACHE);
    })
  );
  self.skipWaiting();
});

// ===== Ativação: limpa caches antigos =====
self.addEventListener("activate", (event) => {
  console.log("[SW] Ativado");
  event.waitUntil(
    caches.keys().then((nomes) => {
      return Promise.all(
        nomes
          .filter((nome) => nome !== CACHE_NAME)
          .map((nome) => caches.delete(nome))
      );
    })
  );
  self.clients.claim();
});

// ===== Fetch: serve do cache, e busca da rede se não tiver =====
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((resposta) => {
      return (
        resposta ||
        fetch(event.request).then((respostaRede) => {
          // Guarda no cache pra próxima vez
          return caches.open(CACHE_NAME).then((cache) => {
            // Só cacheia GET e recursos do mesmo domínio
            if (
              event.request.method === "GET" &&
              event.request.url.startsWith(self.location.origin)
            ) {
              cache.put(event.request, respostaRede.clone());
            }
            return respostaRede;
          });
        })
      );
    })
  );
});