# De scraper

Uit een geplakte of gedeelde link zoveel mogelijk zelf ophalen, zonder API-keys
van platforms. Eén poging is niet genoeg: elke bron wil iets anders, dus de
ophaalstap is een keten van strategieën die net zo lang doorgaat tot er
bruikbare tekst is.

## De keten

Providers worden op volgorde geprobeerd. De eerste die de URL herkent én iets
oplevert, wint; `web` staat achteraan en accepteert alles.

| Provider              | Voor                  | Hoe                                                              |
| --------------------- | --------------------- | ---------------------------------------------------------------- |
| `instagram-embed`     | instagram.com         | De publieke embed-pagina, die geen login vraagt                   |
| `tiktok-oembed`       | tiktok.com            | De publieke oEmbed-endpoint; het bijschrift zit in `title`        |
| `youtube-description` | youtube.com, youtu.be | `shortDescription` uit de player-JSON op de watch-pagina          |
| `web`                 | al het overige        | JSON-LD → microdata → paginatekst, eventueel na browser-rendering |

Levert geen enkele strategie genoeg op, dan valt de app terug op tekst die je
zelf hebt meegestuurd of geplakt. Blijft ook dat leeg, dan komt het item als
**Tekst nodig** in de inbox met het volledige spoor erbij.

## Binnen de web-provider

1. **Ophalen** met een desktop-UA. Bij 403 of 429 volgt één herkansing met een
   mobiele UA — sites die datacenter-verkeer weren serveren de mobiele variant
   vaak wél, en die pagina's zijn lichter.
2. **schema.org/Recipe als JSON-LD.** AH Allerhande en de meeste receptensites
   publiceren dit. Reviews, breadcrumbs en video-metadata worden eruit geknipt.
3. **schema.org/Recipe als microdata** (`itemprop`-attributen), voor oudere
   WordPress-receptenplugins die geen JSON-LD schrijven.
4. **Leesbare paginatekst** als er geen gestructureerde data is. Scripts,
   navigatie, headers en footers gaan eruit; regelovergangen blijven staan,
   want die dragen de structuur van een ingrediëntenlijst.
5. **Browser-rendering**, alleen als `SCRAPER_BROWSER=1`. Zie hieronder.

Wat er ook gevonden wordt, het gaat als één tekst naar het model — met de
gestructureerde data bovenaan gelabeld als betrouwbaarste bron. Het model
normaliseert de rest.

## Instagram

De gewone post-URL geeft bots vrijwel altijd een loginmuur. De **embed-pagina**
(`/p/<code>/embed/captioned/`) niet: die bestaat om posts op externe sites te
tonen en is daarom publiek. Daar halen we het bijschrift uit, in deze volgorde:

1. het JSON-blok met `edge_media_to_caption` — ongevoelig voor CSS-wijzigingen
2. de zichtbare `.Caption`-div, met gebruikersnaam en reactieteller eraf geknipt

`/p/`, `/reel/`, `/reels/` en `/tv/` leiden allemaal naar dezelfde post, dus
alle vier werken.

Wat hier **niet** mee lukt: privé-accounts, en posts waarvan Instagram besluit
dat jouw server-IP ze niet mag zien. Dat laatste treft vooral datacenter-IP's;
draai je dit thuis op een Raspberry Pi of NAS, dan heb je er veel minder last
van. Blokkeert Instagram je server toch, dan kun je met
`INSTAGRAM_EMBED_BASE` de embed via een eigen proxy routeren.

Staat het recept alleen in de gesproken tekst van een Reel en niet in het
bijschrift, dan houdt het op — daar zou audiotranscriptie voor nodig zijn.

## Browser-fallback

Standaard uit. Sites die hun recept pas met JavaScript opbouwen leveren anders
een lege pagina op; met deze fallback wordt de pagina alsnog gerenderd.

```bash
npm install playwright && npx playwright install chromium
# in .env:
SCRAPER_BROWSER="1"
```

De meeste receptensites hebben dit niet nodig, en een browser maakt de deploy
fors zwaarder — vandaar dat het een keuze is. Playwright is geen dependency van
het project; is het niet geïnstalleerd terwijl de vlag aanstaat, dan zegt het
spoor dat precies in plaats van stil te falen.

Heb je al een Chromium op de machine, dan bespaart dit de download:

```bash
SCRAPER_BROWSER_MODULE="playwright-core"
SCRAPER_BROWSER_EXECUTABLE="/usr/bin/chromium"
```

## Uitproberen zonder tokens te verbranden

`/api/extract-preview` draait alleen de ophaalstap en laat zien wat eruit komt.
Geen modelaanroep, dus gratis.

```bash
curl -X POST https://jouw-app/api/extract-preview \
  -H "authorization: Bearer $INGEST_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.instagram.com/p/XXXXXXX/"}'
```

Je krijgt de gekozen strategie, het volledige spoor van pogingen, en de tekst
die naar het model zou gaan. Dit is de snelste manier om te zien waaróm een
bron niet lukt.

## Een bron toevoegen

Een provider is een object met drie velden in `src/lib/extract/providers/`:

```ts
export const mijnProvider: Provider = {
  name: "mijn-bron",
  canHandle: (url) => url.hostname.endsWith("mijnbron.nl"),
  async run(url, sharedText, note) {
    // null = deze strategie vond niets, volgende mag het proberen
    // gooien  = mislukt, reden komt in het spoor
    // note()  = tussenstap vastleggen zonder af te breken
    return { strategy: "mijn-bron", text, meta, canonicalUrl: url.toString() };
  },
};
```

Zet hem in de lijst `PROVIDERS` in `src/lib/extract/index.ts`, vóór
`genericWebProvider` — die vangt namelijk alles op.
