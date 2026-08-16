# Klapper

Recepten van Instagram, de AH-app en willekeurige websites via de iOS-share
sheet opslaan, en ze automatisch laten uitschrijven tot één helder,
kookbaar recept.

Vernoemd naar de receptenklapper die vroeger in elke keukenla lag: geen
archief van alles wat er bestaat, maar een selectie van wat jullie echt
maken. En een klapper is ook een voltreffer — dat is precies wat de kooklog
met sterren bijhoudt.

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

## Gemaakt: sterren, opmerking, vaker eten

Onder elk recept staat **Gemaakt**: hoe vaak je het maakte, wat je ervan vond
en wanneer voor het laatst. Eén regel per keer, met drie dingen erin — een
oordeel van één tot vijf sterren, één regel tekst, en of het vaker mag.

Alles mag leeg blijven. Een formulier dat je dwingt een oordeel te geven vul je
na één keer niet meer in, en dan is de hele log waardeloos; soms wil je alleen
weten *dát* je het gemaakt hebt.

Het beste moment om dit in te vullen is meteen na het koken, dus de knop
**Klaar — eet smakelijk** in de kookmodus brengt je naar het recept met het
formulier al open. De datum staat standaard op vandaag en is aan te passen, dus
achteraf bijwerken kan ook.

- De sterren zijn radio-knoppen met labels, geen JavaScript-widget: het werkt
  ook zonder scripts en een schermlezer weet er raad mee. Ze staan aflopend in
  de HTML omdat CSS de rij omdraait — alleen zo kan "de aangevinkte plus alles
  erna" de lágere sterren inkleuren.
- Op het overzicht staat het gemiddelde oordeel als sterren bij de tegel. Wat
  je er zelf van vond weegt zwaarder dan uit welke keuken het komt.
- Het blok bestaat uit twee lagen. Bovenaan de uitkomst — daarvoor kom je
  kijken, dus die is het grootst. Daaronder de losse keren, klein en op kolom.
  Eerder had alles dezelfde maat, en dan roept een oordeel van drie weken
  geleden even hard als de conclusie. De regels staan in een raster zodat de
  datums onder elkaar staan en een opmerking onder de náám hangt waar hij bij
  hoort, en niet links onder de datum als een losse regel tussen twee keren in.
  De datum krijgt hier geen kalendertje: in een lijst doet de kolom al wat het
  symbool in een zin doet.
- Staan er namen in `APP_USERS`, dan splitst de samenvatting per persoon
  ("Chris ★★★★★ · Sanne ★★") in plaats van één gemiddelde te tonen. Zie
  [Wie ben jij](#wie-ben-jij).
- Regels zonder oordeel tellen niet mee in het gemiddelde, wel in het aantal
  keer.
- "Laatst" telt in kalenderdagen en niet in verstreken uren: iets dat je
  vanochtend maakte is vanavond nog steeds vandaag.

Elke keer is een eigen regel in `CookLog`, want het gaat niet over het recept
maar over díe avond. Hoe vaak je iets eet en hoe lang het geleden is volgen
daar vanzelf uit — de basis onder een weekmenu dat ooit zelf iets kan
voorstellen.

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

Titels staan in **Fraunces**, een zachte oudschreef met een optische as (grote
koppen worden vanzelf fijner getekend dan kleine) plus twee assen die de app
zijn gezicht geven: `SOFT` rondt de hoeken af en `WONK` geeft de a, g en y hun
schuine staart. Die twee staan één keer ingesteld op de `body`, zodat élke plek
waar de schreefletter opduikt — koppen, avatars, stapnummers — er hetzelfde
uitziet. De lopende tekst is **Source Sans 3**: humanistisch en open, waar Inter
neutraal en technisch is.

Beide staan als variabel woff2-bestand in `public/fonts` — latin-subset, samen
±150 kB, en er gaat bij het laden niets naar een externe server. Ze worden in
`layout.tsx` vooruit geladen, anders vindt de browser ze pas nadat hij de
stylesheet heeft gelezen en verspringt de eerste pagina zichtbaar.

Elke kleurcombinatie die tekst draagt haalt minimaal 4,5:1 op zijn eigen
ondergrond, in beide standen. Dat is geen keurmerk maar praktisch: dit is een
app die je met een telefoon in de keuken leest, soms met de zon erop.

### Klok of kalender

Een datum midden in een zin lijkt geen datum meer. *"Sanne heeft dit recept
intussen bijgewerkt, vandaag 13:52"* loopt in elkaar over: je leest één lange
zin en moet zelf uitzoeken waar de mededeling ophoudt en het tijdstip begint.
Daarom draagt elk moment een symbool, en is er één regel voor welk:

- **Klok = hoe lang iets duurt.** "30 min" op een tegel, "8 min" bij een stap,
  de timer in de kookmodus.
- **Kalender = wanneer iets was.** "vandaag 13:52", "9 aug", "2 dagen geleden".

Zonder dat onderscheid ziet "30 min" eruit als "3 dagen geleden", en dat zijn
twee heel verschillende dingen om te weten. De kalender is een andere tekening
dan die van de tabbalk, anders leest een datum als een link naar het weekmenu.

Eén component (`src/components/Moment.tsx`) zodat het overal hetzelfde is: in
de kooklog, in de inbox, onder aan een recept, bij de back-upregel en in de
botsingsmelding. Het is gewone inline-tekst en geen flexregel — die neemt zijn
basislijn van de onderkant van het vakje, en dan zakt alles wat erachter komt
een paar pixels mee. Zichtbaar aan een dubbele punt die te laag hangt.

Wat er bewust géén symbool krijgt: de dagkoppen in het weekmenu (dat zíjn de
koppen) en de redenen bij de voorstellen, want die gaan niet allemaal over tijd
— "wilden jullie vaker eten" met een kalendertje ervoor zou liegen.

Iconen komen uit **Hugeicons**. Het pakket `@hugeicons/core-free-icons` levert
ze als data (`[tag, attributen][]`); `src/components/Icon.tsx` tekent die zelf.
Dat is bewust geen `@hugeicons/react`: die component gebruikt `forwardRef` en
werkt daarmee niet in een server component, en zo staat er ook geen JavaScript
voor iconen in de bundel. Welke icoon waarvoor dient staat in `src/lib/icons.ts`
— heb je de Pro-set, dan wissel je daar de import en verandert er verder niets.

Alle kleuren en maten zijn variabelen bovenin `src/app/globals.css`, in een
lichte en een donkere set.

Zodra de titel van een pagina het beeld uit is schuift er bovenaan een smalle
balk in met diezelfde titel — hetzelfde vlak en dezelfde haarlijn als de
tabbalk onderaan, alleen gespiegeld. Dat is `src/components/Vastkop.tsx`: een
streepje van één pixel op de plek waar de kop ophoudt, een
IntersectionObserver erop, en een balk die zich daarnaar richt. Geen
scroll-luisteraar, want die vuurt bij elke pixel en dwingt de browser tot
rekenen op precies het moment dat hij aan het schuiven is. Zonder JavaScript
blijft de balk buiten beeld en werkt de pagina als altijd.

De echte kop zelf plakken zou simpeler zijn, maar die is twee regels hoog en
houdt dan een tiende van het scherm bezet terwijl je een ingrediëntenlijst
leest. De balk is één regel en er alleen als je hem nodig hebt.

In de kookmodus plakt de stapbalk (`.cook-top`) er altijd: bij een stap die
langer is dan het scherm zie je halverwege anders niet meer de hoeveelste van
hoeveel dit is. De staptitel schuift daar in de balk mee zodra de echte kop weg
is, in de lege ruimte die tussen *Stoppen* en de teller toch al zat — het
aantal personen maakt daarvoor plaats, want samen passen ze niet op één
telefoonregel. Zo verspringt er niets op het moment dat de titel verschijnt.

## Beweging

Drie snelheden, bovenin `globals.css`: `--tik` (90 ms) is het antwoord op je
vinger en moet onder de tiende seconde blijven, `--vlot` (180 ms) voor iets dat
verschijnt of verdwijnt, `--traag` (380 ms) voor iets dat zich verplaatst. Alles
loopt uit en niets veert terug; dit is gereedschap.

**Antwoord op een aanraking.** Knoppen krimpen 4% bij het indrukken, tegels en
regels dempen in plaats daarvan — een raster van zes dat gaat wiebelen is erger
dan geen feedback. iOS' eigen grijze flits staat uit, die komt te laat en valt
over de onze heen.

**Wachtschermen.** Elke pagina is `force-dynamic`, dus tussen je tik en de
nieuwe pagina zit een reis naar de server. De `loading.tsx`-bestanden tekenen de
vórm van wat er komt (`src/components/Skelet.tsx`), niet een tollend rondje: je
ziet welke pagina er aankomt, en de echte inhoud landt op dezelfde plek. Het
skelet komt uit de prefetch die Next doet zodra een link in beeld staat; is een
link nooit voorgeladen, dan blijf je even op de oude pagina met alleen de
indrukfeedback.

> **Dit kost het no-JavaScript-gedrag van die pagina's.** Streamt Next een
> wachtscherm, dan staat de echte inhoud onderaan het document in een verborgen
> blok en schuift een inline script hem op zijn plek. Staat JavaScript uit, dan
> gebeurt dat niet en blijf je naar grijze balken kijken. Gemeten, niet
> aangenomen: met JS uit toonde `/weekmenu` twaalf skeletblokjes en nooit iets
> anders.
>
> Daarom hebben **de twee formulierpagina's** — recept bewerken en instellingen
> — er geen. Daar is de belofte "je kunt alles aanpassen wat er al staat" iets
> waard, en de wachttijd is één query. De overige pagina's zijn lijsten om naar
> te kijken; daar wint het wachtscherm, en met JavaScript uit zie je alleen het
> skelet. Wil je dat andersom, dan is het per route één bestand weghalen.

**De foto die meereist.** De foto op de tegel en de foto bovenaan het recept
dragen via `<ViewTransition>` dezelfde naam, dus de browser laat hem van de ene
plek naar de andere groeien in plaats van de een te laten verdwijnen en de ander
op te laten komen. Onderweg even onscherp, want een vlak dat van 4:3 naar 3:2
rekt laat anders zien dat het uitrekt. Zonder ondersteuning gebeurt er niets.

> **Let op als je hieraan sleutelt.** Dit meegroeien en een `loading.tsx` sluiten
> elkaar uit. Valt de bestemming eerst in een wachtscherm, dan ziet React geen
> paar meer en vervalt de overgang — gemeten: mét een `loading.tsx` in de keten
> wordt `startViewTransition` nul keer aangeroepen, zonder één keer. Daarom
> staat het wachtscherm van het overzicht in de routegroep
> `(app)/(overzicht)/`: zo hangt het niet over `/recepten/[id]` heen. En daarom
> heeft de receptpagina er als enige géén. Die is één query, dus de wachttijd is
> kort, en zijn tegels zijn vrijwel altijd voorgeladen.

**Richting in de kookmodus.** Vooruit schuift de stap van rechts binnen, terug
van links. De `key` op `.cook-step` dwingt een nieuwe knoop af zodat de animatie
opnieuw begint; daardoor wordt ook het streepje van de plakbalk vervangen, en om
die reden is de ref in `Vastkop.tsx` een functie — een gewone ref met een effect
dat één keer draait zou daarna naar een losgekoppelde knoop blijven kijken.

**Kleine dingen.** De ster voor favoriet vult zich meteen bij het tikken in
plaats van na het antwoord van de server: `useFormStatus` weet dat het formulier
onderweg is, en het formulier blijft een gewoon formulier met een server action,
dus zonder JavaScript werkt het nog steeds. Verder komt de inhoud van een
uitklapper omhoog, en springt het vinkje bij *Gekopieerd* even op — het enige
sprongetje in de app, en ook het enige moment waarop een knop iets áf heeft in
plaats van iets in gang zet.

Wat er bewust niet in zit: tegels die één voor één inzweven, scroll-onthullingen
en parallax. Dat vertraagt gereedschap dat je met natte handen bedient.

Eén schakelaar zet alles uit, onderaan `globals.css`: `prefers-reduced-motion`
knijpt elke duur dicht, inclusief de pagina-overgangen, die buiten de gewone
boom vallen. Niet op nul maar op een honderdste milliseconde, want een animatie
die nooit afloopt vuurt ook geen `animationend` af.

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

## Misschien iets?

Onder het weekmenu staan drie voorstellen, met de reden erbij. Een suggestie
zonder uitleg is een gokautomaat, en die vertrouw je na twee keer niet meer —
dus er staat *Nog nooit gemaakt*, *Wilden jullie vaker eten*, of *7 weken
geleden*.

De afweging staat in `src/lib/menu/suggest.ts`, als pure functie zonder
database ernaast zodat hij te testen is. Drie signalen:

- **Rust** weegt het zwaarst. Een lijst die op waardering sorteert is een lijst
  van vijf keer hetzelfde; de vraag is wat ligt te verstoffen dat jullie
  eigenlijk goed vonden. Nooit gemaakt telt als lang geleden, maar begrensd:
  iets dat je gisteren opsloeg heeft nog geen achterstand.
- **Waardering**: het gemiddelde uit de kooklog, plus een bonus als iemand
  *vaker eten* aanvinkte. Zei iedereen die er iets van vond juist "nee, niet
  vaker", dan valt het recept helemaal af — dat is geen lage score maar een
  antwoord.
- **Afwisseling**: staat er al iets uit dezelfde keuken op het menu, dan zakt
  het fors. Zeven dagen pasta is geen weekmenu.
- **Seizoen**: zit er iets in dat déze maand uit de volle grond komt, dan krijgt
  het een duwtje. Alleen belonen, nooit straffen — een recept met tomaten in
  december zakt niet, want dan gaat de motor vertellen wat je niet mag eten. De
  maandlijst staat in `src/lib/menu/seizoen.ts`.

Wat al gepland staat doet niet mee, en wat niet binnen jullie voorkeuren valt
ook niet — zie *Wat eet wie niet* hieronder.

### Wat ligt er in huis?

Boven de voorstellen staat een veld waar je intikt wat er in de koelkast ligt.
Dat is geen bonuspunt maar een **sorteersleutel**: recepten die meer van je
woorden afdekken staan boven, precies zoals het zoeken op het overzicht al
werkt. Als bonus zou het niet werken — een recept dat je drie ingrediënten
gebruikt maar vorige week op tafel stond, verliest dan alsnog van iets van drie
maanden geleden waar niets van in huis is, en dat is precies het antwoord dat je
niet zocht.

Het veld is een gewoon GET-formulier, dus wat je intikt staat in de URL: de
terugknop werkt en je kunt het resultaat doorsturen.

## Dieet en voorkeuren

Elk recept heeft een kolom `diets` met waarden uit een gesloten lijst
(`vegetarisch`, `veganistisch`, `glutenvrij`, `lactosevrij`, `notenvrij`). Het
model vult die in tijdens de import, op basis van de ingrediëntenlijst, met de
opdracht om bij de minste twijfel niets te beweren.

**Dat is een inschatting en geen keurmerk**, en de app schrijft dat er ook bij.
Op een receptpagina staat *"Waarschijnlijk vegetarisch en notenvrij. Afgeleid
uit de ingrediënten, geen garantie."* — een zin en geen badge, want "Glutenvrij"
in een pilletje leest als een feit. Een ingrediëntenlijst is soms onvolledig:
"bouillon" zegt niets over de kip erin, en een merknaam verzwijgt de melkpoeder.

Wijzig je de ingrediënten in de editor, dan wordt het kenmerk **gewist** in
plaats van meeverhuisd. Wie de tofu vervangt door kip houdt anders een recept
over dat zichzelf vegetarisch noemt.

### Wat eet wie niet

In de instellingen staat per huisgenoot een dieet én een vrij veld. Het verschil
is niet cosmetisch:

- Het **dieet** wordt vergeleken met het etiket hierboven — handig, maar zo
  betrouwbaar als de inschatting die eronder ligt.
- Wat je bij **niet in mijn eten** zet, wordt vergeleken met de ingrediënten
  zelf. Geen model, geen etiket: staat er varkensvlees in de lijst, dan staat
  het er. Dít is de kant voor wat iemand écht moet vermijden.

De voorstellen op het weekmenu houden zich aan allebei: wat er niet op tafel mag
valt weg, ook onderaan — een voorstel dat je elke week moet wegkijken is erger
dan geen voorstel. Het overzicht blijft wél alles tonen; het is een voorkeur,
geen slot op je eigen collectie. En op een receptpagina waar iets in zit staat
een zandkleurige regel: *"Chris eet geen feta."*

De vergelijking gebruikt dezelfde woordfunctie als het zoeken, dus "paprika's"
en "paprika" zijn hetzelfde woord en "gemalen varkensvlees" is varkensvlees. Een
afkeer van twee woorden ("rode ui") sluit het enkele woord niet uit.

### Bestaande recepten bijwerken

Recepten van vóór dit veld hebben nog niets. `npm run dieet` vult ze aan, in
twee rondes: eerst wat er al als tag stond (gratis), daarna wat overblijft in
groepjes van twintig langs het model — alleen titel en ingrediëntnamen, niet het
hele recept. `npm run dieet -- --droog` laat eerst zien wat het zou doen.

## Iets nieuws

Onder de voorstellen staat een link naar `/weekmenu/ideeen`. Dat is de enige
plek in de app die naar buiten kijkt: hij geeft de kooklog aan het model — wie
wat waardeerde, welke keukens jullie draaien, welk dieet, welk seizoen — en
krijgt vier gerechten terug met een reden.

**Er wordt geen recept verzonnen.** Het model noemt een gerecht en zoekt met de
webzoek-tool een échte, bestaande receptpagina erbij; die link gaat daarna door
dezelfde molen als alles wat je vanuit Safari of Instagram deelt. Vindt het
niets bruikbaars, dan blijft het idee staan zonder link — dat is beter dan een
knop die kapot is. Een URL die geen gewone http-link is, wordt weggegooid
voordat je hem te zien krijgt.

Waarom niet een receptendatabase? Omdat het niet mag. Spoonacular staat
hooguit een uur cachen toe, met schriftelijke toestemming vooraf, en verbiedt
"any derived, hashed, or transformed data"; bij Edamam mag je de data
uitsluitend tónen aan degene die de zoekopdracht deed. Klapper is precies
andersom gebouwd: importeren, bewaren, exporteren naar markdown. Dat valt niet
te verenigen.

De oogst gaat in de instellingen en niet in het geheugen van de pagina. Dit is
de enige modelaanroep die niet volgt op iets dat binnenkwam, en die wil je niet
nog eens betalen omdat iemand vernieuwde. Mislukt het ophalen, dan blijft wat er
stond staan en komt er een regel boven met wat er misging.

## Een app erop: /api/v1

Naast de website is er een JSON-laag waar een native app op kan zitten. De
server blijft de ene waarheid; het toestel houdt een kopie zodat alles ook werkt
zonder bereik. Dat is *route A* uit de begroting — de goedkoopste manier aan een
echte iOS-app, omdat de scraper, de modelaanroep en de synchronisatie blijven
waar ze al werken.

### Het slot

De web-UI hangt aan een koekje en de deelextensie aan `INGEST_TOKEN`. Voor een
app past geen van beide: een koekje is niets waard buiten een browser, en
`INGEST_TOKEN` is bedoeld voor iets dat alléén mag toevoegen.

Dus een derde weg, maar zonder een derde geheim. De app meldt zich aan met
hetzelfde wachtwoord als de website en krijgt exact dezelfde zelfdragende
sessiewaarde terug, alleen als `Authorization: Bearer` in plaats van als koekje.
Daarmee erft dit slot alles wat er al goed aan was: de handtekening hangt aan
`APP_PASSWORD`, dus dat wijzigen zet elke telefoon eruit, en er is nog steeds
geen sessietabel om bij te houden. De pogingenrem is dezelfde teller als het
inlogscherm — anders zou de API een omweg zijn om dat scherm te ontlopen.

### De aanroepen

| Aanroep | Wat het doet |
|---|---|
| `POST /api/v1/aanmelden` | `{wachtwoord}` → `{token, vervalt, versie}` |
| `GET /api/v1/aanmelden` | Een bestaand token nakijken |
| `GET /api/v1/stand` | Alle recept-id's met hun `bijgewerkt`, plus de instellingen |
| `GET /api/v1/recepten?ids=` | Volledige recepten, hooguit 50 per keer |
| `GET /api/v1/recepten/:id` | Eén recept |
| `PATCH /api/v1/recepten/:id` | Favoriet, keuken, momenten, dieet |
| `GET /api/v1/weekmenu?week=` | De planning van een week |
| `POST /api/v1/weekmenu` | `{receptId, dag, porties}` |
| `PATCH /api/v1/weekmenu/:id` | `{porties}` |
| `DELETE /api/v1/weekmenu/:id` | Van het menu halen |
| `GET /api/v1/voorstellen?week=&ligt=` | Wat zullen we eten, met de reden erbij |
| `POST /api/v1/kooklog` | `{receptId, sterren, notitie, vaker, wie}` |
| `DELETE /api/v1/kooklog/:id` | Een regel weghalen |
| `GET /api/v1/boodschappen?week=` | Opgeteld en ingedeeld |
| `POST /api/v1/delen` | `{url, tekst, door}` — de deelextensie |
| `GET /api/v1/inbox` | Wat er binnenkwam en hoe het afliep |
| `POST /api/v1/inbox/:id` | `{doe: "opnieuw"\|"toch", tekst}` |
| `DELETE /api/v1/inbox/:id` | Item weg, met het recept eraan vast |

### Een eigen vorm, geen databaserijen

Wat eruit komt is een **contract** (`src/lib/api/vorm.ts`), en dat is bewust iets
anders dan de rijen uit de database of de blob die het model opleverde. Die twee
mogen schuiven — er komt een kolom bij, de extractieprompt levert een veld
anders aan — zonder dat er een telefoon stukgaat die je niet in de hand hebt.
Vertalen bij de deur kost één keer schrijven en scheelt daarna elke keer.

Nederlandse veldnamen, zoals de rest van de app. Een recept dat in een oudere
vorm is opgeslagen levert `null` op in plaats van een uitzondering: het id komt
dan in `onleesbaar` terug, zodat de app het overslaat in plaats van eeuwig
opnieuw te proberen.

Twee dingen die je aan de vorm ziet: het cijfer is afgerond op één decimaal (het
gemiddelde van 4 en 5 hoort 4,5 te zijn, niet 4,499999999999999), en een
kooklogdatum is een dág (`2026-08-16`) en geen tijdstip — als volledige ISO-tijd
zou een client in een andere tijdzone er de dag ervoor van zien.

### Synchroniseren

`/api/v1/stand` geeft **alle** recept-id's met hun `bijgewerkt`. De app
vergelijkt die met wat hij lokaal heeft en weet dan drie dingen tegelijk: wat er
nieuw is, wat er veranderd is, en wat er weg is — namelijk alles wat hij wél
heeft en wat er niet in staat.

Geen tijdstempel-vraag met een grafveld erbij dus. Dat zou minder bytes schelen
en een hele klasse bugs opleveren: een verwijderd recept moet je dan bijhouden in
een tabel die je nooit mag opschonen, en een client die één ronde mist ziet het
nooit meer. Bij een paar honderd recepten is de hele lijst een paar kilobyte, en
dan is alles vergelijken simpelweg beter — zoals het zoeken en de
duplicaatcontrole in deze app dat al doen.

### Nakijken

```
npm run demo        # in een ander venster
npm run api:check
```

Zesenveertig controles over echte HTTP: het slot, elke aanroep, de foutcodes, en
of de synchronisatie convergeert — inclusief een gewijzigd recept en een spook in
de cache dat opgeruimd hoort te worden. Wijs hem desnoods naar je echte server
(`npm run api:check -- https://... geheim`); hij schrijft dan wel echt, maar
ruimt zijn eigen kooklog- en weekmenu-regels weer op en raakt nooit een recept
aan.

Dit staat bewust buiten `npm test`: die draait pure functies zonder server en
moet in twee seconden klaar zijn.

De app-kant staat in `ios-app/`, met een waarschuwing bovenaan: die Swift is
geschreven zonder dat hij ergens gecompileerd kon worden.

## Recept weggooien

Onderaan het recept, dichtgeklapt. Openklappen laat zien wat er verdwijnt en
pas dan staat er een knop. Twee stappen omdat een `confirm()` niets doet zonder
JavaScript, en dit is het enige onomkeerbare op de pagina.

Het bijbehorende inbox-item gaat mee — dat is boekhouding van de import, en een
item dat op "klaar" staat zonder recept is een raadsel in plaats van een spoor.
Weekmenu-regels en kooklogregels verdwijnen vanzelf via een cascade, en de
gedownloade foto wordt opgeruimd tenzij een ander recept ernaar wijst.

Dit kon eerder alleen via de Inbox, en die toont vijftig items: een recept van
zestig imports geleden was daarmee onbereikbaar geworden.

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
  toevoegen en verwijderen heeft JavaScript nodig. Deze pagina heeft daarom
  bewust géén `loading.tsx`; zie *Wachtschermen* hieronder waarom die twee niet
  samengaan.

### Als jullie allebei tegelijk bewerken

Twee mensen, twee telefoons, één recept: jij haalt er een teen knoflook bij, zij
schrijft een stap om, en wie als tweede opslaat gooide het werk van de ander weg
— zonder melding, want de app had geen idee.

Het formulier stuurt daarom mee wanneer het recept voor het laatst was
bijgewerkt (`versie`, uit `editedAt`). Klopt dat bij het opslaan niet meer, dan
slaat de app níét op maar vraagt hij het: *"Sanne heeft dit recept intussen
bijgewerkt, vandaag 19:41."* Met een knop om het alsnog te doen, en een link om
in een ander tabblad te kijken wat er nu staat.

Drie keuzes die het verschil maken:

- **`editedAt` en niet `updatedAt`.** Die laatste verspringt ook als iemand het
  recept alleen favoriet maakt, en een hartje is geen bewerking.
- **Je typewerk blijft staan.** Een waarschuwing die je wijzigingen weggooit is
  erger dan de botsing zelf. Daarvoor moest het bovenblok (titel, omschrijving,
  de vier getallen, tips, tags) van `defaultValue` naar React-state: React zet
  een formulier na een `action` terug op zijn beginwaarden, en dan was alles wat
  je had getypt weg op precies het verkeerde moment. De ingrediënten en stappen
  stonden al in state en hadden er geen last van.
- **Een ontbrekend versieveld houdt niemand tegen.** Een oude pagina uit de
  cache heeft het niet; iemand blokkeren op grond van niets is erger dan de
  botsing. Zie `src/lib/recipe/versie.ts`, met tests.

Dit is de enige plek die `data` overschrijft — tot nu toe bleef die blob precies
zoals het model hem opleverde. Wat de bron zei blijft opvraagbaar via
`ShareItem.rawText`. Een bijgewerkt recept krijgt `editedAt`, en onder aan de
pagina staat sinds wanneer. Het kopje "Zelf aangevuld" verdwijnt dan: die lijst
gaat over wat het model verzon, en zegt niets meer over wat er nú staat.

## Drie soorten labels

Op de receptpagina staan drie dingen die op elkaar lijken maar iets anders
betekenen, en ze hebben elk hun eigen vorm zodat je niet hoeft te lezen om te
zien wat wat is:

| Waar | Wat | Vorm |
| --- | --- | --- |
| Onder de titel | Maaltijdmoment en keuken | Vlakke kapitaaltjes, links naar het gefilterde overzicht |
| Boven het raster | De actieve filters | Vierkante chips met een eigen vlak en schaduw |
| Onderaan het recept | Tags | Ronde, verzonken chips met een `#` |

Tags zijn aanklikbaar en gaan naar het zoeken. Dat kijkt al in de tags, dus ze
zijn meer dan een opsomming onderaan de pagina — anders dan de categorieën
hierboven, die een echte kolom in de database hebben en waarop gefilterd wordt.

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

Staat er niets in de URL, dan opent het recept op **jullie huishouden** en niet
op het aantal dat de bron toevallig noemde. Dat aantal is een eigenschap van het
recept, niet van jullie; met een huishouden van twee betekende het elke keer
twee tikken op min. De melding zegt welke van de twee het is — *"omgerekend naar
2 personen, jullie huishouden"* tegenover *"omgerekend van 4 naar 6 personen"*.

Eén kanttekening: voor een taart klopt dit minder goed dan voor een pan pasta.
Bananenbrood voor acht wordt zo bananenbrood voor twee, terwijl je die cake
gewoon helemaal bakt. De teller staat ernaast en de melding zegt wat de bron
bedoelde, dus het is één tik terug — maar het is een echte afweging en geen
oversight.

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

## Even rondklikken

```bash
npm install
npm run demo              # http://localhost:3100, wachtwoord: proefkonijn
```

Zet een proefopstelling klaar met zeven recepten, negen kooklogregels, een
gevuld weekmenu en een inbox met een dubbele import erin, en start de app.
Geen `.env` nodig en geen API-sleutel: het script zet zijn eigen omgeving.

Alles gaat naar `demo.db` en `demo-uploads/`, allebei uit git gehouden. Je
eigen `dev.db` wordt niet aangeraakt — het script geeft de database-URL
expliciet aan Prisma mee in plaats van te hopen dat de omgeving klopt. Elke
start begint met een schone lei, dus je kunt vrij rommelen; opnieuw beginnen is
nog een keer `npm run demo`.

Wat werkt: zoeken en filteren, porties omrekenen, de kookmodus met de wekker,
het weekmenu inclusief huishoudgrootte, de boodschappenlijst, de kooklog, je
profiel, de instellingen en de donkere stand (die volgt je systeeminstelling).
Wat niet werkt: importeren — dat is het enige dat het model nodig heeft.

De datums schuiven mee met de dag waarop je dit draait. De kooklogregels hangen
aan vandaag, zodat "2 dagen geleden" ook echt twee dagen geleden is; het
weekmenu hangt aan de maandag van deze week, want anders zou een start op
zondag de helft in de week erna zetten en opende de app op een lege week.

Zit poort 3100 al vol, dan kan het ergens anders: `PORT=3200 npm run demo`.

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

### Huishouden, profiel en instellingen

Onder de vierde tab staat **jouw hoek**: hoe vaak jij kookte, jouw gemiddelde,
wat je het hoogst zette en wat je vaker wilde eten. De kooklog verzamelt dat per
recept; hier staat het per persoon, en dat is de enige plek waar je "wat vind ík
hier eigenlijk van" ziet zonder recept voor recept te bladeren.

Daarachter zitten de **instellingen**. Twee dingen zijn daar te wijzigen:

- **Huishouden** — voor hoeveel mensen je meestal kookt. Dit is de standaard
  voor een gerecht op het weekmenu en daarmee voor de boodschappenlijst.
  Daarvóór gebruikten we het aantal porties dat toevallig in de bron stond, en
  dat is een eigenschap van het recept en niet van jullie. Per avond kun je er
  nog van afwijken; het weekmenu schrijft dan *iedereen*, *1 persoon* of
  *4 personen*.
- **Wie de app gebruiken** — dezelfde namen als hiervoor in `APP_USERS`, maar nu
  vanuit de app te wijzigen. Staat er niets in de database, dan wordt `APP_USERS`
  gelezen; sla je hier iets op, dan neemt de app het over. Zo blijft een
  bestaande opzet werken zoals hij werkte.

Wat je er níét kunt wijzigen: `APP_PASSWORD`, `ANTHROPIC_API_KEY`,
`INGEST_TOKEN` en `APP_BASE_URL`. Die staan onderaan als leeslijst met alleen
óf ze ingevuld zijn. Een formulier dat het wachtwoord kan aanpassen is een
formulier waarmee iemand die binnen is jou eruit kan zetten.

Instellingen staan als sleutel-waardeparen in één `Setting`-tabel; er komt af en
toe eentje bij en dan wil je geen migratie voor een getal.

### Wie ben jij

Binnen de voordeur staat een **naamkaartje**, geen tweede slot. Zet de namen in
`APP_USERS` (komma-gescheiden) en de app vraagt na het inloggen één keer wie je
bent. Die naam komt bij je oordeel in de kooklog, bij wat je importeert en bij
wat je bewerkt.

Het is nadrukkelijk geen authenticatie: iedereen kan elke naam kiezen en
wisselen kost één tik in de Inbox. Dat kan ook niet anders — jullie delen het
wachtwoord van de voordeur, dus er valt binnen niets te bewijzen. Wat het wél
oplevert is dat "Chris ★★★★★, Sanne ★★" niet langer als één gemiddelde van 3,5
op je scherm staat, een cijfer waar niemand zich in herkent.

Alleen namen die in `APP_USERS` staan worden geaccepteerd. Het koekje is aan te
passen door wie het krijgt en die waarde belandt in de database en op het
scherm; de lijst is dus de begrenzing.

Elke naam krijgt een rondje met zijn initiaal, in een kleur uit de bestaande
pastelset. Die kleur volgt de **volgorde van `APP_USERS`** en niet een hash van
de naam: met vier tinten kregen "Chris" en "Sanne" allebei dezelfde kleur, en
dan doet het rondje precies niet waar het voor is. Namen die niet in de lijst
staan — een `sharedBy` van vroeger bijvoorbeeld — vallen terug op een hash.

Laat je `APP_USERS` leeg, dan is de hele functie uit: geen vraag, geen namen,
en alles werkt zoals het zonder werkte.

## Als er iets misgaat

Naast de wachtschermen staan de tegenhangers: `error.tsx` vangt een pagina die
stukliep, `not-found.tsx` een recept dat er niet meer is, en `global-error.tsx`
het geval dat de hoofdopmaak zelf niet opkomt. Ze delen één component
(`src/components/Misgegaan.tsx`) en doen alle drie hetzelfde: zeggen dat het aan
ons ligt, en een weg terug bieden.

Binnen de app blijft de tabbalk staan — dan is er één pagina stuk en niet de app.
Daarbuiten (kookmodus, inloggen) niet, want daar hoort hij ook niet.

`global-error.tsx` heeft geen enkele import en zijn kleuren staan er los in. Als
dát scherm nodig is, is er iets mis met de laag die de stylesheet en de letters
binnenhaalt, en dan wil je niet dat je foutpagina van diezelfde laag afhangt —
dezelfde redenering als bij het offlinescherm in `public/sw.js`.

In productie krijgt de browser de foutmelding zelf niet te zien; die staat
alleen in het serverlog. Het korte kenmerk onderaan het scherm (`error.digest`)
is het enige waarmee je de twee aan elkaar knoopt.

## Recepten eruit krijgen

```bash
npm run export            # → ./export
npm run export -- /pad    # ergens anders
```

Elk recept als een leesbaar markdown-bestand: titel, hoeveelheden, genummerde
stappen, tips, wat jullie ervan vonden, en onderaan de bron. Opent in elke
teksteditor, gaat zo in Notities of Obsidian, en print netjes.

Dit staat los van de back-up en heeft een ander doel. De back-up is er om terug
te zetten en is een SQLite-bestand: prima daarvoor, waardeloos om te lézen. Een
verzameling waar je alleen via déze app bij kunt is een verzameling die van deze
app afhangt, en dat is precies waar je vanaf wilt.

Daarom draait de export ook automatisch mee in `npm run db:backup`: elke run
krijgt een map `recepten/` ernaast. Een export die je moet onthouden is een
export die je vergeet. Mislukt hij, dan gaat de back-up gewoon door — de
database en de foto's staan er dan al.

De opmaak zit in `src/lib/recipe/markdown.ts` als pure functie, met tests. Dat
is hier de helft van het werk: een export die stilletjes de tips of de
kooklog weglaat is erger dan geen export, want je merkt het pas als je hem nodig
hebt.

## Back-up

```bash
npm run db:backup
```

Zet hem in de cron — één keer per nacht is genoeg:

```
15 3 * * * cd /pad/naar/klapper && /usr/bin/npm run db:backup >> backups/log.txt 2>&1
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

## Op je beginscherm

Open de app in Safari op je iPhone en tik op **Zet op beginscherm**. Je krijgt
een eigen icoon, volledig scherm zonder adresbalk, snelkoppelingen bij lang
indrukken, en een kookmodus die blijft werken als de wifi in de keuken hapert.

Wat offline werkt is bewust beperkt: de recepten staan op een server, dus
zonder verbinding kun je niets nieuws ophalen of opslaan. De service worker
bewaart wat je het laatst bekeek — pagina's netwerk-eerst, zodat je nooit oude
hoeveelheden krijgt als de server bereikbaar is. Alles wat schrijft gaat er
ongemoeid langs.

Zie **[docs/ios-app.md](docs/ios-app.md)** voor hoe het in elkaar zit, wat er
wel en niet offline werkt, en het pad naar een Capacitor-schil met TestFlight
als je dat ooit wilt. Kort: dat kan zonder Swift en zonder iets te herbouwen,
maar de App Store gaat een WebView om een privé-server niet toelaten.

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
| `src/lib/api/vorm.ts`        | Het contract van `/api/v1`: databaserij in, JSON uit.       |
| `src/lib/api/toegang.ts`     | Het Bearer-slot op `/api/v1`.                               |
| `src/lib/menu/voorstellen.ts` | Haalt op wat de voorstelmotor nodig heeft; gedeeld met de app. |
| `src/lib/menu/suggest.ts`    | Welke recepten het weekmenu voorstelt, en waarom.           |
| `src/lib/menu/seizoen.ts`    | Wat er per maand uit de volle grond komt.                   |
| `src/lib/menu/ideeen.ts`     | Gerechten die je nog niet hebt, met een echte bron erbij.   |
| `src/lib/voorkeuren.ts`      | Wat ieder van jullie wel en niet eet.                       |
| `tests/`                     | `npm test`; de tests over de pure functies.                 |
| `scripts/demo.mjs`           | Proefopstelling: eigen database, eigen foto's, `npm run demo`. |
| `scripts/dieet.mjs`          | Vult het dieetkenmerk aan bij bestaande recepten (`npm run dieet`). |
| `scripts/api-check.mjs`      | Controleert `/api/v1` over echte HTTP (`npm run api:check`).        |
| `scripts/export.mjs`         | De recepten als markdown wegschrijven; draait mee in de back-up. |
| `scripts/ts-loader.mjs`      | App-code rechtstreeks vanuit Node draaien (tests én export). |
| `src/lib/shopping/units.ts`  | Hoeveelheden optellen en namen gelijktrekken.               |
| `src/lib/shopping/aisles.ts` | Onder welk kopje een ingrediënt hoort.                      |
| `src/components/PhotoForm.tsx` | Camera en bibliotheek, met miniaturen en een wachtstand.   |
| `src/lib/recipe/prompt.ts`   | **De huisstijl van een recept.** Hier sleutel je aan toon.  |
| `src/lib/recipe/schema.ts`   | Vorm van een recept — Zod plus JSON Schema, samen bijhouden. |
| `src/lib/pipeline.ts`        | Rijgt extractie en parsing aan elkaar, bewaakt de status.   |
| `src/middleware.ts`          | Het slot: één poort voor pagina's én server actions.        |
| `src/lib/session.ts`         | Inlogkoekje ondertekenen en nakijken; rem op mispogingen.   |
| `scripts/backup.mjs`         | Database en foto's veiligstellen; draai hem uit de cron.    |
| `src/lib/images.ts`          | Receptfoto's downloaden naar eigen schijf.                  |
| `src/components/RecipeEditor.tsx` | Het bewerkscherm; rijen erbij en eraf.                 |
| `src/lib/recipe/amount.ts`   | "300 g" terug naar getal en eenheid. Tegenhanger van format. |
| `src/lib/recipe/duplicate.ts` | Herkennen dat je een recept al hebt: bron-URL en titel.    |
| `src/components/CookLog.tsx` | Gemaakt: sterren, opmerking, vaker eten.                    |
| `src/lib/who.ts`             | Het naamkaartje: wie noteert er. Geen tweede slot.          |
| `src/lib/settings.ts`        | Voorkeuren uit de database; geheimen blijven in .env.       |
| `src/lib/people.ts`          | Wie er zijn en welke kleur bij wie hoort.                   |
| `src/lib/tijd.ts`            | "3 dagen geleden" en "vandaag 21:03", in kalenderdagen.     |
| `src/components/Avatar.tsx`  | Een naam als rondje met initiaal.                           |
| `src/components/Vastkop.tsx` | De titelbalk die inschuift zodra je gescrold hebt.          |
| `src/components/Skelet.tsx`  | De vorm van een pagina die nog moet komen; zie `loading.tsx`. |
| `src/components/FavorietKnop.tsx` | De ster die alvast vult terwijl de server nog bezig is. |
| `src/components/Misgegaan.tsx` | Het scherm als er iets stukging; gedeeld door alle foutpagina's. |
| `src/components/Moment.tsx`  | Wanneer iets was, met een kalendertje ervoor.               |
| `src/lib/recipe/markdown.ts` | Een recept als leesbaar bestand. Pure functie, met tests. |
| `src/lib/recipe/versie.ts`   | Merkt dat de ander hetzelfde recept ook heeft bijgewerkt.   |
| `src/app/manifest.ts`        | Naam, kleuren en iconen voor "zet op beginscherm".          |
| `public/sw.js`               | Service worker: cache en offlinescherm. Hoog `VERSIE` op.   |
| `scripts/iconen.mjs`         | Alle icoonmaten uit één bron (`npm run iconen`).            |

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
- **Eén gedeeld token** (`INGEST_TOKEN`) voor de ingest-endpoints, in plaats
  van een sleutel per apparaat. Genoeg voor twee telefoons; wil je er ooit een
  intrekken, dan moet je het token overal verversen.
- **Eén wachtwoord voor de hele app**, geen accounts. Wie het wachtwoord heeft,
  mag alles. De namen uit `APP_USERS` zijn een label en geen grens; zodra de
  app het huishouden verlaat — vrienden, familie, publiek — draait die
  afweging om en heb je echte accounts nodig, met gehashte wachtwoorden, een
  rem per account en een herstelroute.

## Tests

```bash
npm test
```

Node's eigen testrunner over de pure functies: zoeken, hoeveelheden lezen en
schrijven, porties omrekenen, boodschappen samenvoegen en indelen, weken en
categorieën, het inlogkoekje, duplicaatherkenning, de weekmenu-voorstellen en
het rekenen met kalenderdagen.
Geen framework, geen bouwstap — `scripts/resolve-alias.mjs` vertaalt `@/lib/x`
naar `src/lib/x` en plakt de ontbrekende `.ts` erachter, en Node 22 streept de
types zelf af. Die hook staat in `scripts/` en niet in `tests/`, want
`npm run export` gebruikt hem ook: dat commando haalt de markdown-opmaak
rechtstreeks uit de bron.

De keuze wat er wél in staat: alles wat een oordeel velt over Nederlandse taal
of over geld. Daar zaten alle bugs die ik met de hand vond, en daar vond deze
suite er bij het schrijven meteen nog twee: `rode paprika's` werd niet
samengevoegd met `rode paprika`, en `rundergehakt` belandde onder *Overig*
terwijl `gehakt` gewoon werkte. En één taalfout: een voorstel van gisteren
heette "Gisteren geleden".

Wat er niet in staat: alles wat een database of een browser nodig heeft. Dat
test ik met de hand tegen een draaiende app; het zou hier een testomgeving
optuigen die groter is dan de app zelf.

## Commando's

| Commando            | Doet                                     |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Ontwikkelserver                          |
| `npm run build`     | Productiebuild (draait ook `prisma generate`) |
| `npm run typecheck` | TypeScript zonder build                  |
| `npm run db:push`   | Schema naar de database                  |
| `npm run db:studio` | Database in de browser bekijken          |
| `npm run db:backup` | Database + foto's naar `backups/`        |
| `npm run iconen`    | App-iconen opnieuw tekenen               |
| `npm test`          | De testsuite over de pure functies       |
| `npm run demo`      | Proefopstelling met eigen data, om rond te klikken |
| `npm run export`    | Alle recepten als markdown naar `export/`          |
| `npm run dieet`     | Dieetkenmerk aanvullen bij bestaande recepten      |
| `npm run api:check` | `/api/v1` langs de meetlat, tegen een draaiende server |
