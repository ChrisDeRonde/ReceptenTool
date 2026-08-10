# ReceptenTool

Recepten van Instagram, de AH-app en willekeurige websites via de iOS-share
sheet opslaan, en ze automatisch laten uitschrijven tot één helder,
kookbaar recept.

## Hoe het werkt

```
iOS share sheet
      │  POST /api/share   { url?, text?, sharedBy? }
      ▼
  ShareItem opgeslagen  ──▶  202 terug (de Shortcut wacht nergens op)
      │
      │  achtergrondverwerking
      ▼
  1. Bron ophalen        keten van strategieën, per bron een eigen aanpak
  2. Recept eruit halen  Claude met een vast JSON-schema
  3. Opslaan             Recipe-rij, zichtbaar in de web-app
```

Alles wat binnenkomt landt eerst als `ShareItem` in de database, ook als de
verwerking daarna misgaat. In de inbox zie je per item welke strategie het
ophaalde en kun je het opnieuw proberen — desnoods met tekst die je zelf plakt.

## Wat de scraper aankan

| Bron                        | Hoe                                                    |
| --------------------------- | ------------------------------------------------------ |
| AH Allerhande, receptenblogs | schema.org/Recipe uit JSON-LD of microdata             |
| Willekeurige webpagina's    | Leesbare paginatekst, ontdaan van navigatie en scripts |
| Instagram                   | De publieke embed-pagina, zonder API-key of login      |
| TikTok                      | De publieke oEmbed-endpoint                            |
| YouTube                     | De videobeschrijving uit de watch-pagina               |
| JS-only sites               | Optioneel gerenderd in een echte browser               |
| Geplakte tekst              | Direct, zonder link                                    |

Lukt het niet, dan zie je in de inbox precies welke strategieën zijn geprobeerd
en waarop ze afketsten. Details en uitbreiden: **[docs/scraper.md](docs/scraper.md)**.

Met `/api/extract-preview` test je een bron zonder een modelaanroep te doen —
handig om te zien waarom iets niet lukt zonder tokens te verbranden.

## Kookmodus

Vanaf een recept start je `/recepten/<id>/koken`: één stap tegelijk, groot
genoeg om vanaf het aanrecht te lezen. Per stap staan de ingrediënten die je op
dát moment nodig hebt, met dezelfde hoeveelheden als de hoofdlijst — de stap
verwijst ernaar in plaats van ze te kopiëren, zodat er niets uit de pas kan
lopen.

Heeft een stap een wachttijd, dan zit er een timer bij. Die blijft doorlopen als
je naar een volgende stap gaat: bovenin verschijnt een knopje met de resterende
tijd waarmee je terugspringt. Als hij afgaat piept en trilt de telefoon en
kleurt de timer rood. Het scherm blijft aan zolang je in kookmodus zit.

Deze modus leunt op drie velden per stap (`ingredientRefs`, `timerMinutes`,
`tip`) die het model invult. Recepten van vóór deze functie missen die en
werken gewoon, alleen zonder ingrediëntenpaneel en timer — verwerk de bron
opnieuw vanuit de inbox om ze alsnog te krijgen.

## Aan de praat krijgen

```bash
cp .env.example .env      # vul ANTHROPIC_API_KEY en INGEST_TOKEN in
npm install
npm run db:push           # maakt dev.db aan
npm run dev               # http://localhost:3000
```

`INGEST_TOKEN` is het gedeelde geheim tussen de iOS-kant en de server.
Genereer er een met `openssl rand -hex 32`; zonder token van minstens 16 tekens
weigert `/api/share` álle verzoeken.

Zonder iOS kun je alles testen via **Inbox → Handmatig toevoegen**.

## Delen vanaf iOS

Zie **[docs/ios-delen.md](docs/ios-delen.md)**. Kort samengevat: Safari op iOS
ondersteunt de Web Share Target API niet, dus een PWA kan zichzelf niet in de
share sheet zetten. De route die vandaag werkt is een iOS Shortcut die naar
`/api/share` post; een native Share Extension (de Lijstje-ervaring) kan later
op dezelfde endpoint worden aangesloten.

## Structuur

| Pad                          | Wat het doet                                              |
| ---------------------------- | --------------------------------------------------------- |
| `src/app/api/share/`         | Ingest-endpoint voor iOS. Slaat op, verwerkt via `after()`. |
| `src/app/api/items/[id]/`    | Statuscheck voor de Shortcut.                              |
| `src/app/api/extract-preview/` | Alleen de scraper draaien, zonder modelaanroep.           |
| `src/app/(app)/`             | De gewone app: koptekst met navigatie eromheen.            |
| `src/app/recepten/[id]/koken/` | Kookmodus. Valt buiten `(app)` zodat er geen chrome boven staat. |
| `src/components/CookMode.tsx` | Stapnavigatie, timers, wake lock.                         |
| `src/app/actions.ts`         | Server actions voor de web-UI (toevoegen, opnieuw, wissen). |
| `src/lib/extract/`           | De ophaalketen. `providers/` bevat de bronspecifieke strategieën. |
| `src/lib/recipe/prompt.ts`   | **De huisstijl van een recept.** Hier sleutel je aan toon.  |
| `src/lib/recipe/schema.ts`   | Vorm van een recept — Zod plus JSON Schema, samen bijhouden. |
| `src/lib/pipeline.ts`        | Rijgt extractie en parsing aan elkaar, bewaakt de status.   |

## Aan de output sleutelen

De toon en het detailniveau van een recept zitten volledig in
`src/lib/recipe/prompt.ts`. Wil je bijvoorbeeld altijd een tijdsindicatie per
stap, of juist kortere stappen, dan pas je alleen dat bestand aan.

Verander je de *vorm* (een veld erbij), dan hoort dat op drie plekken:
`recipeSchema` en `recipeJsonSchema` in `src/lib/recipe/schema.ts`, en de
weergave in `src/app/(app)/recepten/[id]/page.tsx`. TypeScript wijst de laatste
twee vanzelf aan zodra je de eerste aanpast.

Geef een nieuw veld een `.default()` in `recipeSchema`, anders lopen recepten
die al in de database staan stuk op de validatie.

## Keuzes en hun grenzen

- **SQLite** houdt de opzet klein en is ruim voldoende voor twee mensen. De
  database is één bestand op de server, dus dit vraagt een host met een
  blijvende schijf (een kleine VPS, Fly.io met volume, een Raspberry Pi).
  Op serverless platforms als Vercel verdwijnt het bestand tussen aanroepen —
  wissel dan in `prisma/schema.prisma` naar `postgresql`.
- **Verwerken gebeurt in hetzelfde proces** via Next's `after()`. Bij twee
  gebruikers is een echte wachtrij overbodig; komt daar ooit volume bij, dan is
  `processShareItem` het enige dat een worker hoeft aan te roepen.
- **Eén gedeeld token** in plaats van accounts. Genoeg voor twee mensen die
  elkaar vertrouwen, maar er is dus geen onderscheid tussen gebruikers behalve
  het `sharedBy`-veld dat de Shortcut meestuurt.
- **De web-UI zelf is niet afgeschermd.** Wie de URL kent, kan de recepten
  lezen. Zet er authenticatie voor als de app publiek bereikbaar is.

## Commando's

| Commando            | Doet                                     |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Ontwikkelserver                          |
| `npm run build`     | Productiebuild (draait ook `prisma generate`) |
| `npm run typecheck` | TypeScript zonder build                  |
| `npm run db:push`   | Schema naar de database                  |
| `npm run db:studio` | Database in de browser bekijken          |
