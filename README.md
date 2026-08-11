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
| Een foto van een kookboek   | Rechtstreeks naar het model, meerdere pagina's tegelijk |
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

## Recept fotograferen

In de inbox staat **Recept fotograferen**: één knop opent de camera van je
telefoon (`capture="environment"`), de andere je fotobibliotheek. Een kookboek
dat over twee pagina's loopt fotografeer je in twee keer — die gaan als één
recept naar het model, in de volgorde waarin je ze koos. Maximaal vijf foto's
van 5 MB per stuk.

De foto's gaan rechtstreeks naar het model; de ophaalketen wordt overgeslagen,
want de foto *is* de bron. Ze worden eerst opgeslagen en het inbox-item wordt
aangemaakt vóór de modelaanroep, zodat een mislukte verwerking je foto niet
kost — in de inbox staan de miniaturen en kun je het opnieuw proberen.

De bestanden staan op schijf in `uploads/` (te verzetten met `UPLOAD_DIR`), niet
in de database en niet in `public/`: ze horen bij je data, niet bij de code.
`/api/foto/<naam>` is de enige weg ernaartoe en laat alleen namen door die wij
zelf geschreven hebben.

Twee dingen om te weten. **HEIC werkt niet** — dat leest het model niet, en
omzetten vraagt een native afhankelijkheid. Kies je een bestaande HEIC-foto, dan
krijg je een melding met wat je eraan kunt doen; een foto die je binnen de app
maakt levert iOS zelf als JPEG aan. En **een foto van alleen een gerecht levert
geen recept op**: de prompt verbiedt raden, dus dan krijg je een titel met een
lege ingrediëntenlijst in plaats van een verzonnen recept.

## Foto's bij het recept

De foto die bij een recept hoort wordt bij het importeren **gedownload** en
naast de gefotografeerde bronnen in de uploadmap gezet. Daarvoor stond in
`imageUrl` het adres bij de bron en linkten we daar rechtstreeks naartoe; dat
werkt tot de dag dat die site hem verplaatst of hotlinken blokkeert, en dan is
je overzicht een raster met lege vakken zonder dat iets je waarschuwt. Het
scheelt bovendien een verzoek naar buiten elke keer dat je de lijst opent.

- De bestandsnaam is een hash van de bron-URL. Hetzelfde recept nog eens
  importeren, of twee recepten met dezelfde foto, leveren daardoor één bestand
  op in plaats van twee.
- Alleen JPEG, PNG, WebP en GIF, maximaal 8 MB, en na tien seconden geeft hij
  het op. SVG gaat er bewust niet in: dat is een document dat scripts kan
  bevatten.
- Lukt het niet, dan blijft de oorspronkelijke URL staan. Een recept zonder
  eigen foto is nog steeds een recept; dit mag een import niet laten
  struikelen.
- Verwijder je een recept, dan gaat de foto mee — maar alleen als geen ander
  recept naar hetzelfde bestand wijst.

Recepten die er al stonden linken nog naar buiten. Onderaan de Inbox staat
hoeveel dat er zijn, met een knop om ze op te halen (vijfentwintig per klik).
Die regel verdwijnt zodra er niets meer te halen valt.

## Zoeken

Boven het overzicht staat een zoekveld dat meezoekt terwijl je typt. Het kijkt
in de titel, de omschrijving, de tags, de keuken **en de ingrediënten** — dat
laatste is waar het om begonnen was: je hebt paprika en gehakt liggen en wilt
weten wat je daarmee kunt.

Typ je meerdere woorden, dan telt de app per woord of het voorkomt. Recepten die
álles afdekken staan bovenaan met *met paprika, gehakt*; daaronder, achter het
kopje **Bijna**, staat wat je met één boodschap ook kunt maken, met *mist
paprika* erbij. Dat is de vraag die je in de keuken stelt.

Spaties splitsen in losse termen. Wil je op een combinatie zoeken, gebruik dan
een komma: `rode paprika, gehakt` zoekt naar rode paprika én gehakt, en niet
naar drie losse woorden.

De zoekterm staat in de URL en combineert met de categoriefilters, dus je kunt
een gevonden selectie delen en hij overleeft een refresh. Zonder JavaScript werkt
het ook: dan is het een gewoon formulier waar je op Enter drukt.

Matchen gebeurt op hele woorden, met twee uitzonderingen die Nederlands nodig
heeft: een woord mag met de zoekterm beginnen (`paprika` vindt `paprika's`) en
erop eindigen als er minstens drie letters voor staan (`gehakt` vindt
`rundergehakt`, maar `loem` vindt niet `bloem`). Een kale `includes` zou "ui"
laten matchen op "br**ui**ne suiker", en dat soort treffers sloopt je vertrouwen
in de zoekfunctie sneller dan een gemiste treffer.

Er is geen index-tabel: bij een paar honderd recepten is alles doorlopen sneller
dan een index die kan verouderen (gemeten: 31 ms voor de hele pagina). Loopt de
collectie ooit in de duizenden, dan is een `RecipeIngredient`-tabel de volgende
stap; `src/lib/recipe/search.ts` is dan het enige bestand dat verandert.

## Weekmenu en boodschappen

Op een recept staat een kalenderknop: die neemt het recept "in de hand" mee naar
het weekmenu, waar je alleen nog een dag hoeft te kiezen. Het aantal personen
gaat mee zoals het op dat moment op je scherm stond, en je kunt het per dag nog
bijstellen — plan je zondag voor zes, dan telt die zondag ook voor zes mee.

Vanuit het weekmenu maak je met één knop de boodschappen voor die week:
**alle recepten bij elkaar opgeteld**. Twee gerechten die eieren willen worden
één regel van 8 stuks; 500 g plus 1 kg wordt 1½ kg. Dat kan alleen omdat
ingrediënten als losse velden zijn opgeslagen — bij vrije tekst zou hier niets
van kloppen. Wat níét optelbaar is blijft gescheiden: 200 g bloem en 2 el bloem
zijn twee regels, want in de winkel zijn dat ook twee dingen.

Herkennen dat twee dingen hetzelfde zijn gebeurt met een vaste tabel
(`uien` → `ui`, `eieren` → `ei`) en niet met een slimme meervoudsregel:
Nederlands is daar te grillig voor, en een verkeerde gok voegt twee dingen samen
die niet samenhoren. Mis je er een, dan zet je hem erbij in
`src/lib/shopping/units.ts`.

De lijst wordt nergens opgeslagen: hij is een afgeleide van je weekmenu en wordt
bij elke weergave opnieuw berekend. Eén ding minder dat kan verouderen.

### Naar de Appie

Twee knoppen boven de lijst:

- **Kopieer lijst** — kale regels, één product per regel. Dat is wat de app van
  de supermarkt aankan als je erin plakt.
- **Delen** — de iOS-share sheet met de nette versie mét kopjes, voor een appje
  naar de ander.

Bewust géén afvinklijst in deze app. Die draait op een servertje thuis, en in de
winkel wil je iets dat het altijd doet, ook zonder bereik, ook als beide telefoons
tegelijk afvinken. Wat deze app toevoegt is het **optellen**; het afvinken laat
hij aan de app die je toch al bij je hebt.

Onder welk kopje iets komt, komt uit een woordenlijst in
`src/lib/shopping/aisles.ts`: geen productdatabase, geen API, maar iets wat je
kunt lezen en corrigeren. Nederlandse samenstellingen worden op hun kern
beoordeeld, want slagroom is room en boerenkool is kool. Wat nergens op past gaat
naar *Overig*, onderaan maar wel op de lijst.

## Uiterlijk

Zacht en zakelijk: warm papier in plaats van wit, pastelvlakken in plaats van
verzadigde kleur, haarlijnen in plaats van randen. Eén salie-accent voor alles
wat een actie is; zand en oudroze voor tips en alarm.

Titels staan in **Newsreader** (schreef, met een optische as, dus grote koppen
worden fijner getekend dan kleine), de rest in **Inter**. Beide staan als
variabel woff2-bestand in `public/fonts` — latin-subset, samen ±180 kB, en er
gaat bij het laden niets naar een externe server.

Iconen komen uit **Hugeicons**. Het pakket `@hugeicons/core-free-icons` levert
ze als data (`[tag, attributen][]`); `src/components/Icon.tsx` tekent die zelf.
Dat is bewust geen `@hugeicons/react`: die component gebruikt `forwardRef` en
werkt daarmee niet in een server component, en zo staat er ook geen JavaScript
voor iconen in de bundel. Welke icoon waarvoor dient staat in `src/lib/icons.ts`
— heb je de Pro-set, dan wissel je daar de import en verandert er verder niets.

Alle kleuren en maten zijn variabelen bovenin `src/app/globals.css`, in een
lichte en een donkere set.

## Dubbel herkennen

Twee mensen die door dezelfde tijdlijn scrollen delen vroeg of laat hetzelfde
gerecht. In plaats van het er twee keer in te zetten, zet de inbox het item op
**Heb je al**, met een link naar het recept dat er al staat en een knop *Toch
toevoegen* — twee varianten kunnen best allebei de moeite waard zijn, en de
herkenning is een vermoeden, geen oordeel.

Twee signalen, op twee momenten:

- **Dezelfde bron-URL.** Dit wordt gecontroleerd *vóór* de modelaanroep, dus
  een dubbele deelactie kost niets. Bij het vergelijken gaan het schema,
  `www.`, de afsluitende slash, het fragment en alle meelifterparameters
  (`utm_*`, `fbclid`, `igshid`, …) eraf; parameters die er wél toe doen blijven
  staan, want sommige sites zetten hun recept-id in `?p=123`.
- **Dezelfde titel.** Die komt uit het model, dus dit kan pas erna. Het recept
  wordt dan niet opgeslagen, maar de modeluitvoer wordt bewaard in
  `ShareItem.pendingData` — zo kost *Toch toevoegen* geen tweede aanroep.
  Bij het vergelijken gaan accenten, leestekens én spaties eraf: Nederlands
  plakt woorden aan elkaar en niet iedereen doet dat hetzelfde, dus
  "truffel-roomsaus" en "truffelroomsaus" zijn hetzelfde gerecht.

Opnieuw verwerken van een item is geen duplicaat van zichzelf; het eigen recept
telt niet mee bij het zoeken.

## Recept bewerken

Op elk recept staat een potloodje. Daar pas je alles aan wat het model ervan
maakte: titel, omschrijving, porties, tijden, ingrediënten, stappen, tips en
tags. Dat is niet alleen om fouten te herstellen — na twee keer koken weet je
dat er een teen knoflook bij moet, en zonder bewerken verhuist die kennis naar
je hoofd in plaats van naar het recept.

- **Hoeveelheden typ je als tekst**: `300 g`, `2 teentje`, `½ tl`, `1/2 kop`,
  `0,5 l`. `parseAmount` in `recipe/amount.ts` maakt daar weer een getal en een
  eenheid van, zodat omrekenen naar meer personen blijft werken. Eén veldje per
  regel in plaats van vier — dit doe je op een telefoon.
- Een marge als `2-3 el` blijft staan zoals je hem typt en schaalt niet mee.
  Er stiekem 2 van maken zou het recept preciezer laten lijken dan het is.
- **De koppeling tussen stappen en ingrediënten** (waar de kookmodus op leunt)
  is een positienummer, en dat schuift zodra je een regel weghaalt. Elke rij
  draagt daarom onzichtbaar zijn oorspronkelijke plek mee, zodat de
  verwijzingen na het opslaan meeschuiven. Wat je weghaalt verdwijnt ook uit de
  stappen die het noemden; de staptekst zelf blijft ongemoeid.
- Zonder JavaScript kun je alles aanpassen wat er al staat. Alleen rijen
  toevoegen en verwijderen heeft JavaScript nodig.

Dit is de enige plek die `data` overschrijft — tot nu toe bleef die blob precies
zoals het model hem opleverde. Wat de bron zei blijft opvraagbaar via
`ShareItem.rawText`. Een bijgewerkt recept krijgt `editedAt`, en onder aan de
pagina staat sinds wanneer. Het kopje "Zelf aangevuld" verdwijnt dan: die lijst
gaat over wat het model verzon, en zegt niets meer over wat er nú staat.

## Categorieën

Elk recept krijgt bij het importeren een **maaltijdmoment** (ontbijt, lunch,
diner, bijgerecht, snack, borrelhapje, dessert, bakken, drank, basis) en een
**keuken** (Italiaans, Frans, …). Op de receptpagina staan ze onder de titel, en
onder *Indeling aanpassen* verander je ze zelf — wat het model koos is een
voorstel, geen eindoordeel.

Een recept mag meerdere maaltijdmomenten hebben, want soep is lunch én diner.
De keuken is er één, maar vrije tekst: "Scandinavisch" of "Fusion" kan gewoon,
ook al staat het niet in de suggestielijst.

Op het overzicht filter je erop via de chips bovenaan; die tonen alleen wat er
daadwerkelijk in je collectie zit. Filters combineren (`?maaltijd=diner&keuken=Italiaans`)
en staan in de URL, dus je kunt ze delen.

De vocabulaire staat in `src/lib/recipe/categories.ts`. Maaltijdmomenten zijn
bewust een gesloten lijst — met vrije tekst heb je binnen een maand "avondeten",
"Avond" en "diner" naast elkaar en filtert het niet meer. Voor de varianten die
het model of een oude import oplevert zit daar een synoniementabel.

Categorieën zijn kolommen op `Recipe`, niet velden in de JSON-blob: er wordt op
gefilterd, en jouw wijziging moet niet overschreven worden door modeloutput.
Verwerk je een bron opnieuw, dan wordt de indeling wél opnieuw afgeleid.

## Porties omrekenen

Op de receptpagina staat een teller bij **Personen**. Verhoog of verlaag je die,
dan rekenen alle hoeveelheden naar verhouding mee en wordt er afgerond op iets
waar je mee kunt koken: geen 266,67 g maar 265 g, geen 2,83 el maar 2¾ el.
Grammen gaan in stappen van 0,5 tot 5 gram naargelang de hoeveelheid, lepels in
kwarten, en telbare dingen als eieren en teentjes in halven.

Het gekozen aantal staat in de URL (`?porties=6`), niet in de database — jij
kookt voor zes terwijl je vriendin hetzelfde recept voor twee bekijkt. Het
reist mee naar de kookmodus en weer terug.

Wat **niet** meeschaalt: tijden (twee keer zoveel pasta kookt niet twee keer zo
lang) en de staptekst. Getallen in lopende tekst herschrijven maakt meer stuk
dan het oplost, dus die blijven staan zoals de bron ze gaf; als je omrekent
verschijnt daarom een melding dat de ingrediëntenlijst leidend is. De prompt
stuurt er wel op aan dat hoeveelheden in de lijst horen en niet in de stap.

## Kookmodus

Vanaf een recept start je `/recepten/<id>/koken`: één stap tegelijk, groot
genoeg om vanaf het aanrecht te lezen. Per stap staan de ingrediënten die je op
dát moment nodig hebt, met dezelfde hoeveelheden als de hoofdlijst — de stap
verwijst ernaar in plaats van ze te kopiëren, zodat er niets uit de pas kan
lopen.

Heeft een stap een wachttijd, dan zit er een timer bij: de tijd groot, twee
ronde knoppen ernaast en een balkje dat leegloopt zodat je van een meter afstand
ziet hoe ver hij is. Hij blijft doorlopen als je naar een volgende stap gaat —
bovenin verschijnt dan een knopje met de resterende tijd waarmee je terugspringt.
Als hij afgaat piept en trilt de telefoon en kleurt het blok oudroze. Het scherm
blijft aan zolang je in kookmodus zit.

Deze modus leunt op drie velden per stap (`ingredientRefs`, `timerMinutes`,
`tip`) die het model invult. Recepten van vóór deze functie missen die en
werken gewoon, alleen zonder ingrediëntenpaneel en timer — verwerk de bron
opnieuw vanuit de inbox om ze alsnog te krijgen.

## Aan de praat krijgen

```bash
cp .env.example .env      # vul ANTHROPIC_API_KEY, INGEST_TOKEN en APP_PASSWORD in
npm install
npm run db:push           # maakt dev.db aan
npm run dev               # http://localhost:3000
```

`INGEST_TOKEN` is het gedeelde geheim tussen de iOS-kant en de server.
Genereer er een met `openssl rand -hex 32`; zonder token van minstens 16 tekens
weigert `/api/share` álle verzoeken.

Zonder iOS kun je alles testen via **Inbox → Handmatig toevoegen**.

## Op slot

De app vraagt om één gedeeld wachtwoord (`APP_PASSWORD`, minstens 8 tekens).
Dat is geen accountsysteem en dat hoeft ook niet: er zijn twee gebruikers die
elkaar vertrouwen.

Het slot zit in `src/middleware.ts` en dus vóór alles. Dat is met opzet: de
pagina's waren nooit het echte probleem, de **server actions** waren dat.
Die zijn gewoon POST-endpoints op diezelfde pagina's, en er zit `addSource`
tussen (kost een modelaanroep per keer) en `deleteItem`. Een controle per
pagina is de variant waar je er één vergeet.

- Het koekje is zelfdragend: vervaldatum plus HMAC, ondertekend met een sleutel
  die van het wachtwoord is afgeleid. Geen sessietabel, en het wachtwoord
  wijzigen logt iedereen automatisch uit.
- Drie maanden geldig, `httpOnly` en `SameSite=Lax`. `Secure` staat aan zodra
  `APP_BASE_URL` met `https://` begint — op http zou de browser het koekje
  nooit terugsturen en kwam je nooit voorbij het inlogscherm.
- Acht mispogingen per IP per tien minuten. Een wachtwoord van acht tekens is
  te raden als je duizend keer per minuut mag proberen; met deze rem niet.
  De teller staat in het geheugen en is na een herstart leeg.
- `/api/share`, `/api/items` en `/api/extract-preview` gaan er ongemoeid
  langs: die hebben `INGEST_TOKEN` al, en de Shortcut heeft niets aan een
  inlogpagina als antwoord.
- Staat `APP_PASSWORD` niet ingevuld, dan blijft **alles** dicht en legt het
  inlogscherm uit wat eraan ontbreekt. Fout dichtvallen, niet open.

Uitloggen staat onderaan de Inbox.

## Back-up

```bash
npm run db:backup
```

Zet hem in de cron — één keer per nacht is genoeg:

```
15 3 * * * cd /pad/naar/receptentool && /usr/bin/npm run db:backup >> backups/log.txt 2>&1
```

Elke run maakt één map `backups/2026-08-11_031500/` met daarin `recepten.db`,
`fotos.tar` en `fotos.lijst`. De database **en** de foto's samen, want los van
elkaar heb je er niets aan: in de database staat alleen de verwijzing naar een
foto, dus een database zonder uploadmap is een receptenlijst met lege vakken.

- De database wordt niet gekopieerd maar gedumpt met `VACUUM INTO`. Een
  draaiende SQLite-database met `cp` kopiëren levert een half bestand op als er
  net iets geschreven wordt; dit mag gewoon terwijl de app draait.
- Daarna gaat er meteen een `integrity_check` overheen en wordt het aantal
  recepten geteld. Zonder die controle weet je alleen dát er een bestand
  ontstond — niet de zekerheid die je wilt op de dag dat je hem nodig hebt.
- Foto's krijgen bij het opslaan een nieuwe naam en veranderen daarna nooit
  meer, dus is er meestal niets nieuws. In dat geval wordt het archief van de
  vorige run **hard gelinkt** in plaats van opnieuw geschreven: elke map blijft
  compleet, maar veertien dagen foto's kosten één keer schijfruimte.
- Veertien runs blijven staan (`BACKUP_KEEP`), oudere worden opgeruimd.
- Mislukt er iets, dan sluit het script af met een foutcode, zodat cron je
  mailt in plaats van het stil te laten falen.

Onderaan de Inbox staat wanneer de laatste back-up liep. Is dat langer dan drie
dagen geleden, dan kleurt die regel rood — een back-up faalt zelden met een
foutmelding en meestal met stilte.

Terugzetten is met de hand, en dat is met opzet: automatisch terugzetten is
precies de knop die je op het verkeerde moment indrukt.

```bash
cp backups/2026-08-11_031500/recepten.db dev.db
tar -xf backups/2026-08-11_031500/fotos.tar    # zet uploads/ terug
```

De backupmap staat in `.gitignore` en hoort op een **andere machine** te
belanden — een schijf in dezelfde behuizing gaat samen met de rest stuk. Wijs
`BACKUP_DIR` naar een aangekoppelde schijf, of laat rsync of rclone de map
oppikken.

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
| `src/app/(app)/`             | De gewone app: leeskolom met de tabbalk eronder.            |
| `src/app/recepten/[id]/koken/` | Kookmodus. Valt buiten `(app)` zodat er geen chrome boven staat. |
| `src/components/CookMode.tsx` | Stapnavigatie, timers, wake lock.                         |
| `src/components/TabBar.tsx`  | De tabbalk onderaan; weet welke pagina actief is.           |
| `src/components/Icon.tsx`    | Tekent één Hugeicon; werkt in server components.            |
| `src/lib/icons.ts`           | Welk icoon waarvoor. Eén plek om ze te wisselen.            |
| `src/app/globals.css`        | **Het uiterlijk.** Kleuren en maten staan bovenin.          |
| `src/lib/recipe/scale.ts`    | Porties omrekenen en afronden op kookbare hoeveelheden.    |
| `src/lib/recipe/categories.ts` | Maaltijdmomenten en keukens: vocabulaire en normalisatie. |
| `src/app/actions.ts`         | Server actions voor de web-UI (toevoegen, opnieuw, wissen). |
| `src/lib/extract/`           | De ophaalketen. `providers/` bevat de bronspecifieke strategieën. |
| `src/lib/photos.ts`          | Gefotografeerde bronnen: opslaan, teruglezen, opruimen.     |
| `src/lib/recipe/search.ts`   | Zoeken op naam en ingrediënt; woordmatching.                |
| `src/lib/menu/week.ts`       | Weken en dagen; maandag als begin.                          |
| `src/lib/menu/list.ts`       | Een week aan recepten optellen tot één boodschappenlijst.   |
| `src/lib/shopping/units.ts`  | Hoeveelheden optellen en namen gelijktrekken.               |
| `src/lib/shopping/aisles.ts` | Onder welk kopje een ingrediënt hoort.                      |
| `src/components/PhotoForm.tsx` | Camera en bibliotheek, met miniaturen en een wachtstand.   |
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
- **Eén wachtwoord voor de hele app**, geen accounts. Wie het wachtwoord heeft,
  mag alles — er is geen onderscheid tussen jullie twee behalve het
  `sharedBy`-veld dat de Shortcut meestuurt.

## Commando's

| Commando            | Doet                                     |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Ontwikkelserver                          |
| `npm run build`     | Productiebuild (draait ook `prisma generate`) |
| `npm run typecheck` | TypeScript zonder build                  |
| `npm run db:push`   | Schema naar de database                  |
| `npm run db:studio` | Database in de browser bekijken          |
