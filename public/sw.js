/* eslint-disable no-undef */

/**
 * De service worker: zorgt dat de keuken blijft werken als de wifi hapert.
 *
 * Wat dit expliciet níét is: een offline-versie van de app. De recepten staan
 * in een database op een server, dus zonder verbinding kun je niets nieuws
 * ophalen en niets opslaan. Wat het wél doet is het laatste dat je bekeek
 * bewaren, zodat je midden in het koken niet naar een foutmelding staart
 * omdat de router in de gang even niksdoet.
 *
 * Dezelfde worker werkt straks binnen een Capacitor-schil: die laadt gewoon
 * dezelfde origin, dus hier hoeft dan niets aan te veranderen.
 */

// Ophogen bij een wijziging hieronder; de oude caches worden dan opgeruimd.
const VERSIE = "v3";
const STATISCH = `statisch-${VERSIE}`;
const PAGINAS = `paginas-${VERSIE}`;
const PLAATJES = `plaatjes-${VERSIE}`;

/** Hoeveel pagina's we bewaren. Genoeg voor een week koken. */
const MAX_PAGINAS = 60;

/** Wat er meteen bij het installeren in de cache mag: alles wat nooit wijzigt. */
const VOORAF = [
  "/fonts/nunito-latin.woff2",
  "/fonts/nunitosans-latin.woff2",
  "/icoon/icoon-192.png",
  "/icoon/apple-touch-icon.png",
];

/**
 * Hier blijven we vanaf.
 *
 * De ingest-endpoints omdat een Shortcut geen cache wil, en het inloggen omdat
 * een bewaarde inlogpagina precies het verkeerde is om terug te geven.
 */
const NOOIT = ["/api/share", "/api/items", "/api/extract-preview", "/login", "/wie"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATISCH).then((cache) => cache.addAll(VOORAF)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((namen) =>
        Promise.all(
          namen
            .filter((naam) => !naam.endsWith(VERSIE))
            .map((naam) => caches.delete(naam)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Alleen onze eigen GET-verzoeken. Alles wat schrijft — server actions,
  // formulieren, de ingest — gaat rechtstreeks naar de server.
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (NOOIT.some((pad) => url.pathname.startsWith(pad))) return;

  // De losse data-verzoeken die Next tijdens het navigeren doet. Die bewaren
  // we niet: ze horen bij één versie van de pagina en verouderen stil. Faalt
  // zo'n verzoek, dan doet Next vanzelf een hele paginalading, en díé vangen
  // we hieronder wel op.
  if (url.searchParams.has("_rsc")) return;

  const onveranderlijk =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/icoon/");

  if (onveranderlijk) {
    event.respondWith(uitCacheEerst(request, STATISCH));
    return;
  }

  // Foto's krijgen bij het opslaan een naam die nooit terugkomt, dus wat er
  // een keer onder staat blijft kloppen.
  if (url.pathname.startsWith("/api/foto/")) {
    event.respondWith(uitCacheEerst(request, PLAATJES));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(netwerkEerst(request));
  }
});

/** Staat het er al? Dan meteen. Zo niet: halen en bewaren. */
async function uitCacheEerst(request, cacheNaam) {
  const cache = await caches.open(cacheNaam);
  const bewaard = await cache.match(request);
  if (bewaard) return bewaard;

  try {
    const antwoord = await fetch(request);
    if (antwoord.ok) cache.put(request, antwoord.clone());
    return antwoord;
  } catch {
    // Geen verbinding en niets in de cache. Een leeg antwoord is hier eerlijker
    // dan een foutpagina in de plaats van een lettertype of een plaatje.
    return new Response("", { status: 504, statusText: "Geen verbinding" });
  }
}

/**
 * Eerst de server, en alleen als die er niet is wat we nog hadden.
 *
 * Andersom zou sneller voelen maar levert oude recepten op nadat je er net een
 * hebt bijgewerkt — en dan sta je met verkeerde hoeveelheden in de keuken.
 */
async function netwerkEerst(request) {
  const cache = await caches.open(PAGINAS);

  try {
    const antwoord = await fetch(request);

    // Een omleiding komt hier terug als ondoorzichtig antwoord (status 0):
    // niet bewaren, wel doorgeven, want dan stuurt de server je bijvoorbeeld
    // naar het inlogscherm.
    if (antwoord.ok && antwoord.type !== "opaqueredirect") {
      cache.put(request, antwoord.clone());
      snoei(cache);
    }
    return antwoord;
  } catch {
    const bewaard = await cache.match(request, { ignoreSearch: false });
    if (bewaard) return bewaard;

    // Zonder zoekterm of portie-parameter is het dezelfde pagina; die mag ook.
    const zonderVragen = await cache.match(request, { ignoreSearch: true });
    if (zonderVragen) return zonderVragen;

    return offlinePagina();
  }
}

/** De oudste eruit als het er te veel worden. */
async function snoei(cache) {
  const sleutels = await cache.keys();
  if (sleutels.length <= MAX_PAGINAS) return;
  for (const sleutel of sleutels.slice(0, sleutels.length - MAX_PAGINAS)) {
    await cache.delete(sleutel);
  }
}

/**
 * Geen verbinding en niets bewaard.
 *
 * Als los bestand zou dit achter het inlogscherm vallen, dus hij staat hier.
 * Dezelfde kleuren als de app, zodat het geen browserfout lijkt.
 */
function offlinePagina() {
  const html = `<!doctype html>
<html lang="nl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Geen verbinding</title>
<style>
  :root { color-scheme: light dark; --bg:#f8f5ef; --ink:#1e1c18; --muted:#6e6760; --accent:#477060; }
  @media (prefers-color-scheme: dark) { :root { --bg:#151412; --ink:#f5efe5; --muted:#9a9287; --accent:#93bda6; } }
  body { margin:0; min-height:100dvh; display:grid; place-items:center; padding:1.35rem;
         background:var(--bg); color:var(--ink); text-align:center;
         font:400 16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif; }
  h1 { font:500 1.5rem/1.2 ui-serif,Georgia,serif; margin:0 0 .4rem; }
  p { margin:0 0 1.2rem; color:var(--muted); font-size:.9rem; max-width:22rem; }
  button { font:inherit; font-size:.95rem; min-height:2.9rem; padding:0 1.2rem; cursor:pointer;
           border:0; border-radius:8px; background:var(--accent); color:var(--bg); }
</style></head>
<body><div>
  <h1>Geen verbinding</h1>
  <p>Deze pagina stond nog niet in het geheugen van je telefoon. Recepten die je
     eerder bekeek werken wel — die staan er nog.</p>
  <button onclick="location.reload()">Opnieuw proberen</button>
</div></body></html>`;

  return new Response(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
