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
  1. Bron ophalen        schema.org/Recipe als die er is, anders paginatekst
  2. Recept eruit halen  Claude met een vast JSON-schema
  3. Opslaan             Recipe-rij, zichtbaar in de web-app
```

Alles wat binnenkomt landt eerst als `ShareItem` in de database, ook als de
verwerking daarna misgaat. In de inbox zie je per item wat er gebeurde en kun
je het opnieuw proberen — bijvoorbeeld door zelf de tekst te plakken bij een
Instagram-post achter een loginmuur.

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
| `src/app/actions.ts`         | Server actions voor de web-UI (toevoegen, opnieuw, wissen). |
| `src/lib/extract/`           | Pagina ophalen, JSON-LD zoeken, leesbare tekst maken.       |
| `src/lib/recipe/prompt.ts`   | **De huisstijl van een recept.** Hier sleutel je aan toon.  |
| `src/lib/recipe/schema.ts`   | Vorm van een recept — Zod plus JSON Schema, samen bijhouden. |
| `src/lib/pipeline.ts`        | Rijgt extractie en parsing aan elkaar, bewaakt de status.   |

## Aan de output sleutelen

De toon en het detailniveau van een recept zitten volledig in
`src/lib/recipe/prompt.ts`. Wil je bijvoorbeeld altijd een tijdsindicatie per
stap, of juist kortere stappen, dan pas je alleen dat bestand aan.

Verander je de *vorm* (een veld erbij), dan hoort dat op drie plekken:
`recipeSchema` en `recipeJsonSchema` in `src/lib/recipe/schema.ts`, en de
weergave in `src/app/recepten/[id]/page.tsx`. TypeScript wijst de laatste twee
vanzelf aan zodra je de eerste aanpast.

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
