# De native app — route A

Een SwiftUI-app die praat met de Klapper-server die je al draait. De server
blijft de ene waarheid; dit toestel houdt een kopie zodat alles ook werkt als er
even geen bereik is.

## Doe je dit met Claude Code op je Mac?

Begin dan hier. Open een terminal in de projectmap en start `claude`. Plak dit
als eerste bericht — dan begint hij niet koud:

> Ik wil de iOS-app in `ios-app/` aan de praat krijgen. Lees eerst
> `ios-app/README.md` helemaal; daar staat wat er is, wat er nagekeken is en
> waar de valkuilen zitten.
>
> Het Xcode-project heb ik al aangemaakt (`../Klapper/Klapper.xcodeproj`) met de
> bestanden uit `ios-app/Klapper` erin. Die Swift is nog nooit gecompileerd.
>
> Doe dit: bouw met `xcodebuild`, lees de fouten, repareer ze in de bronbestanden
> onder `ios-app/Klapper`, en herhaal tot het bouwt. Start daarna de simulator en
> laat me een schermafdruk zien van het overzicht.
>
> Draai `npm run demo` in een tweede venster zodat de app een server heeft
> (`http://localhost:3100`, wachtwoord `proefkonijn`).

Twee dingen die hij moet weten en die verderop in dit bestand staan uitgelegd:
**verander de datum-decodering niet terug naar `.iso8601`**, en **maak van de
`Kast` geen SwiftData** — allebei zijn het bewuste keuzes met een reden die in
de code staat. Wat er verder omgegooid moet worden mag hij zelf beslissen.

Nakijken kan met `npm run api:check` (de serverkant), `npm run swift:vorm` (of
de Swift-structs nog kloppen met wat de server stuurt) en `npm run
swift:targets` (welk bestand in welk Xcode-target hoort).

## Lees dit eerst

**Deze Swift-code is nooit gecompileerd.** Er staat geen Xcode op de machine
waar ze geschreven is, en SwiftUI bestaat niet op Linux — dus de eerste keer dat
je `⌘B` drukt, komt er waarschijnlijk een lijst met fouten. Dat is verwacht, geen
teken dat er iets grondig mis is: typefouten, een verkeerd overload, een
`Sendable`-klacht. Plak ze terug, dan zijn ze zo weg.

Wat er wél is nagekeken:

- **De serverkant.** `npm run api:check` — 46 controles over echte HTTP, en de
  vorm van wat er teruggegeven wordt staat in de testsuite.
- **Of `Contract.swift` klopt met wat de server werkelijk stuurt.**
  `npm run swift:vorm` trekt de veldnamen uit de Swift-bron en legt ze naast de
  echte JSON: 18 structs, allemaal goed. Dat vangt niet alles — typen ziet het
  niet, dus `Int` waar `Double` hoort komt er nog steeds doorheen — maar wel de
  klasse fouten die je anders pas in Xcode vindt.

### Wat die controle al opleverde

Drie dingen zaten er fout, en die zijn hier al gerepareerd:

1. **De datums.** `JSONDecoder.dateDecodingStrategy = .iso8601` weigert
   fractionele seconden, en Node zet ze in élk tijdstempel
   (`2026-08-16T21:23:20.756Z`). Elke decodering zou zijn mislukt — de app had
   geen enkel recept binnengekregen, met als enige spoor een foutmelding die
   nergens naar wijst. Staat nu in `Netwerk/Codering.swift`.
2. **De foto's.** Die komen als pad binnen (`/api/foto/abc.jpg`), niet als
   volledig adres. `AsyncImage` had er stil een leeg vlak van gemaakt.
3. **Een ontbrekende `import UIKit`** in `Stijl.swift`.

### Waar ik nog steeds in het duister tast

Concurrency. Swift 6 is streng over wat er tussen actors door mag, en dat is
precies wat een compiler je vertelt en een leesronde niet. Als er iets gaat
klagen, is het waarschijnlijk `@State private var voorraad = Voorraad()` in
`KlapperApp.swift` (een `@MainActor`-type in een `App`-struct) of het doorgeven
van `Sleutelbos` aan de `Klant`-actor. Allebei gangbare patronen, maar ik heb ze
niet kunnen laten controleren.

## Wat er staat

| Bestand | Wat het doet |
|---|---|
| `Model/Contract.swift` | De Swift-helft van het API-contract. De andere helft is `src/lib/api/vorm.ts`. |
| `Netwerk/Klant.swift` | Alle aanroepen naar de server, als één actor. |
| `Netwerk/Sleutelbos.swift` | Token in de Keychain, adres en naam in de gedeelde defaults. |
| `Opslag/Kast.swift` | De lokale kopie: één JSON-bestand, atomair weggeschreven. |
| `Opslag/Synchronisatie.swift` | Wat er opgehaald en weggegooid moet worden. Pure functie. |
| `Zoeker.swift` | Zoeken op ingrediënt, op het toestel. Vertaling van `search.ts`. |
| `Model/Hoeveelheid.swift` | Porties omrekenen en hoeveelheden opschrijven. Vertaling van `scale.ts` en `format.ts`. |
| `Voorraad.swift` | Wat de schermen zien. Knoopt klant en kast aan elkaar. |
| `Kooksessie.swift` | Eén keer koken: waar je bent, welke pannen lopen, wat je gepakt hebt. |
| `Stijl.swift` | De huisstijl, één op één uit `globals.css`. |
| `Schermen/` | Aanmelden, het overzicht, het recept, de kookmodus en het gemaakt-formulier. |
| `Wekker/` | De kookwekkers op het vergrendelscherm. Zie "De kookwekkers" onderaan. |

## Opzetten in Xcode

1. **Nieuw project** → iOS → App. Naam `Klapper`, interface SwiftUI, taal Swift.
   Zet de minimum deployment op iOS 18 of hoger (`@Observable`, `.rect(cornerRadius:)`
   en `URL.appending(path:)` willen dat).
2. **Sleep de map `Klapper/`** uit deze repo in het project. Kies *Create groups*,
   en vink het app-target aan.
3. **Verwijder het `ContentView.swift`** dat Xcode zelf maakte, en het eigen
   `KlapperApp.swift` — die staan hier al.
4. **App Group aanzetten**: target → Signing & Capabilities → `+ Capability` →
   App Groups → `group.nl.klapper.gedeeld`. Diezelfde naam staat in
   `Sleutelbos.groep`; wijk je ervan af, wijzig hem daar ook.
5. **Fonts** (mag later): sleep `public/fonts/fraunces-latin.woff2` en
   `sourcesans-latin.woff2` erin — maar woff2 werkt niet op iOS, dus haal de
   `.ttf`-varianten van Google Fonts. Zet de bestandsnamen in Info.plist onder
   `UIAppFonts`. Zonder deze stap valt alles terug op het systeemfont, en dat
   zegt de app tegen je in de console.
6. **Bouwen.** Draait Claude Code op je Mac, laat hem dan `xcodebuild` doen en
   de fouten zelf oplossen — zie bovenaan. Anders: <kbd>⌘B</kbd> en de lijst
   terugkoppelen.

## De server

Er hoeft niets aan te veranderen; `/api/v1` staat er al in. De app meldt zich
aan met hetzelfde wachtwoord als de website en krijgt hetzelfde soort token
terug, alleen als Bearer in plaats van als koekje. Verander je `APP_PASSWORD`,
dan is elke telefoon eruit — dat is de bedoeling.

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

Synchroniseren gaat in twee stappen: `/stand` opvragen, dat vergelijken met wat
er lokaal staat, en dan alleen ophalen wat nieuwer is. Wat lokaal staat en niet
in de stand voorkomt, is verwijderd. Dat is de reden dat de stand álle id's
stuurt en niet alleen de wijzigingen: een verwijderd recept laat geen spoor na.

De hele lijst is na te kijken met `npm run api:check` vanuit de projectmap —
zesenveertig controles over echte HTTP, inclusief de convergentie van de
synchronisatie.

## De receptpagina en de kookmodus

`ReceptScherm` en `KookScherm` staan er, met dezelfde beslissingen als op het
web. Wat er op de receptpagina staat en in welke volgorde: waar je naar keek
toen je erop tikte (foto, titel), waar je meteen aan wilt draaien (het aantal
personen), dan de boodschappen, dan het koken. Wat je pas achteraf leest — tips,
aannames, wie het wanneer maakte — staat onderaan.

De kookmodus doet één stap tegelijk, met de ingrediënten van díé stap erbij en
af te vinken, een aftellende wekker per stap, en wat er straks komt. Plus het
ding dat de browser niet kan: elke lopende wekker staat óók op het
vergrendelscherm. Zie "De kookwekkers" hieronder.

### De getallen zijn nagerekend

`Model/Hoeveelheid.swift` is een handvertaling van `src/lib/recipe/scale.ts` en
`format.ts`, en dat is precies het soort code waar een verschil pas opvalt met
een weegschaal in je hand: 265 g op je telefoon en 266,67 g op de website.

Daarom is die vertaling nagerekend en niet alleen nagelezen. De Swift is
mechanisch teruggezet naar JS en over 73.233 vergelijkingen naast de geteste
TypeScript-kant gelegd — willekeurige hoeveelheden bij vijftien eenheden, alle
randgevallen rond de drempels (4, 10, 50, 500), alle breuktekens en elke
kloktijd tot en met 8000 seconden. Nul verschillen.

Wat dat níét afdekt: `String(format: "%.2f")` in Swift en `toFixed(2)` in JS
kunnen op de laatste decimaal anders afronden. Dat pad wordt alleen gelopen door
getallen die géén breuk zijn en geen heel getal, en het verschil is dan één
honderdste in de weergave. Blijft het opvallen, dan is dat de plek.

## Wat er nog niet is

- Het weekmenu, de boodschappenlijst en de inbox.
- De ster om iets favoriet te maken. `Klant` heeft daar nog geen aanroep voor
  (`PATCH /api/v1/recepten/:id` bestaat op de server, maar niet in de client);
  op het receptscherm is favoriet daarom alleen te lezen.

De volgorde die ik zou aanhouden staat in de begroting.

## De deelextensie (`KlapperDelen`)

De Swift ervoor staat al in `ios-app/KlapperDelen/`:

| Bestand | Wat het doet |
|---|---|
| `DeelExtensieController.swift` | De `NSExtensionPrincipalClass` — vervangt het storyboard dat Xcode neerzet. |
| `DeelModel.swift` | Leest de gedeelde link/tekst uit `NSExtensionContext`, de huisgenoten uit `Kast`, en stuurt naar de server. |
| `DeelScherm.swift` | Het kaartje zelf, in dezelfde SwiftUI-huisstijl als de rest van de app (`Stijl.swift` — geen eigen kleuren). |

Eenvoudiger dan de variant in `ios-schil/`: `POST /api/v1/delen` met het token
dat via de Keychain al gedeeld wordt tussen app en extensie. Geen tweede
geheim op het toestel dus, en niets in te vullen — wel nog een naamkaartje als
er meer dan één huisgenoot is, want dat weet de server niet uit zichzelf.

**Dit is nog nooit gecompileerd**, net als de rest — dezelfde reden als
hierboven.

### Welke bestanden in welk target

Dit is nagerekend en niet gegokt. `npm run swift:targets` volgt vanuit de drie
`KlapperDelen`-bestanden alle typen die ze aanraken, en dat wat díé weer
aanraken, tot de lijst niet meer groeit — en het stopt met een foutmelding als
er ooit een bestand met `@main` in belandt. Draai hem opnieuw als er Swift
bijkomt; dan blijft deze lijst kloppen in plaats van te verouderen. Nu geeft
hij:

**Aanvinken bij `KlapperDelen`** (target membership, in het rechterpaneel):

- `KlapperDelen/DeelExtensieController.swift`
- `KlapperDelen/DeelModel.swift`
- `KlapperDelen/DeelScherm.swift`
- `Klapper/Model/Contract.swift`
- `Klapper/Netwerk/Codering.swift`
- `Klapper/Netwerk/Klant.swift`
- `Klapper/Netwerk/Sleutelbos.swift`
- `Klapper/Opslag/Kast.swift`
- `Klapper/Stijl.swift`

Die zes uit `Klapper/` zitten dus in **allebei** de targets. Dat mag: Swift
compileert ze een tweede keer mee in de extensie. Een gedeeld framework maken
kan ook, maar dat is voor zes bestanden meer bouwwerk dan het oplevert.

**Níét aanvinken bij `KlapperDelen`:**

- `Klapper/KlapperApp.swift` — hier staat `@main` in. Een extensie start via
  `NSExtensionPrincipalClass`, niet via een `App`; dit erbij zetten levert een
  tweede startpunt op en dat is een bouwfout die nergens naar wijst.
- `Klapper/Voorraad.swift`, `Klapper/Zoeker.swift`,
  `Klapper/Opslag/Synchronisatie.swift`, `Klapper/Schermen/*` — de extensie
  raakt ze niet aan, en meenemen betekent alleen meer om stuk te laten gaan.

### Het bericht voor Claude Code op je Mac

> Het `KlapperDelen`-target bestaat al in het Xcode-project, met App Groups
> (`group.nl.klapper.gedeeld`) en Keychain Sharing (`nl.klapper.gedeeld`) op
> zowel `Klapper` als `KlapperDelen`. De Swift ervoor staat klaar maar hangt
> nog nergens aan.
>
> Lees eerst `ios-app/README.md` vanaf "De deelextensie" — daar staat precies
> welke bestanden in welk target horen en welke er juist níét in mogen. Die
> lijst is nagerekend; volg hem letterlijk.
>
> Doe dan dit:
>
> 1. Vink de negen bestanden uit die lijst aan bij het `KlapperDelen`-target.
>    Let op `KlapperApp.swift`: die mag er beslist niet bij.
> 2. Gooi het sjabloon weg dat Xcode bij het aanmaken van het target neerzette
>    (`ShareViewController.swift` en `MainInterface.storyboard`, of wat er
>    staat) — dat wordt niet gebruikt.
> 3. Pas de Info.plist van `KlapperDelen` aan: `NSExtensionMainStoryboard` eruit,
>    `NSExtensionPrincipalClass` erin met waarde
>    `$(PRODUCT_MODULE_NAME).DeelExtensieController`, en een
>    `NSExtensionActivationRule` die één weblink of geselecteerde tekst
>    toestaat (`NSExtensionActivationSupportsWebURLWithMaxCount = 1`,
>    `NSExtensionActivationSupportsText = true`). Zelfde sleutels als in
>    `ios-schil/Info-fragment.plist`, andere klassenaam.
> 4. Zet de Minimum Deployment van `KlapperDelen` op 18.0, gelijk aan `Klapper`.
> 5. Bouw **beide** schema's met `xcodebuild` — eerst `Klapper`, dan
>    `KlapperDelen`. Los fouten op in de bronbestanden onder `ios-app/` en
>    herhaal tot allebei bouwen. De extensie is nog nooit door een compiler
>    geweest, dus reken op wat concurrency-geklaag; de app zelf bouwde eerder
>    al schoon.
> 6. Draai `npm run demo` in een tweede venster (`http://localhost:3100`,
>    wachtwoord `proefkonijn`), start de app in de Simulator en meld je aan —
>    de extensie heeft het token van de app nodig.
> 7. Test via Safari in de Simulator: open een pagina, deelmenu, zoek
>    "Klapper". Controleer dat het kaartje verschijnt, dat er een naam bij
>    staat, en dat er "Bewaard" komt. Kijk daarna in de inbox van de webapp of
>    het item er werkelijk is.
>
> Vraagt de extensie om aanmelden terwijl de app wél is aangemeld, dan is dat
> de Keychain en niet de code. `Sleutelbos.meldGroep("...")` print in DEBUG
> welke toegangsgroep hij ziet; roep hem ook even aan bij het opstarten van de
> app en leg de twee regels naast elkaar. Staat er een andere groep, dan is
> Keychain Sharing niet gelijk ingesteld op de twee targets.
>
> Laat me daarna een schermafdruk zien van het deelkaartje in de Simulator.

Wat ik niet heb kunnen nakijken, want daar heb je Xcode voor nodig: of
`Kast()` in de extensie hetzelfde bestand vindt als de app (moet, via de App
Group), en of het `kSecAttrAccessGroup` in `Sleutelbos.swift` er expliciet bij
moet — met precies één Keychain-groep in de entitlements van beide targets
hoort de impliciete standaardgroep al te werken, maar dat is iets om in de
gegenereerde `.entitlements`-bestanden na te kijken, niet om te gokken.

## De kookwekkers (`KlapperWekker`)

Koken is niet naar je telefoon kijken. Je zet de pan op en je loopt weg, en een
timer die alleen bestaat zolang het scherm aanstaat is dan geen timer. Vandaar
een Live Activity: het aftellen staat op het vergrendelscherm en in het Dynamic
Island, en blijft daar staan terwijl de app in de achtergrond hangt.

`Kooksessie` roept dit aan; de kookmodus hoeft er zelf niets van te weten. Eén
regel per knop:

```swift
Kookwekker.gedeeld.start(
    gerecht: recept.titel, receptId: recept.id,
    stap: index + 1, vanTotaal: recept.stappen.count,
    stapTitel: kort(stap), minuten: minuten
)
Kookwekker.gedeeld.pauzeer(receptId: recept.id, stap: index + 1)
Kookwekker.gedeeld.hervat(receptId: recept.id, stap: index + 1)
Kookwekker.gedeeld.stop(receptId: recept.id, stap: index + 1)
Kookwekker.gedeeld.stopAlles(van: recept.id)   // kookmodus verlaten
```

De wekker in de app en de wekker op het slot lopen dus niet los van elkaar: er
is één bron (`Kooksessie.wekkers`) en het vergrendelscherm is daar een
weergave van.

| Bestand | Wat het doet |
|---|---|
| `Klapper/Wekker/KookwekkerAttributes.swift` | De vorm die app en widget delen. Hoort in **allebei** de targets. |
| `Klapper/Wekker/Kookwekker.swift` | Zetten, pauzeren, hervatten, weghalen. Alleen het app-target. |
| `Klapper/Kooksessie.swift` | De kant die hem aanroept: één keer koken, met alle wekkers erin. |
| `KlapperWekker/KlapperWekkerBundle.swift` | Het startpunt van de extensie. |
| `KlapperWekker/KookwekkerLiveActivity.swift` | Hoe hij eruitziet, op het slot én in het eiland. |

### Het ene ding dat je hier moet snappen

**De widget telt zelf af, en de app doet dat niet.** Er zit een budget op het
aantal keer dat je een Live Activity mag bijwerken, en één keer per seconde haal
je dat er binnen een paar minuten doorheen — waarna je wekker bevriest op een
getal dat niet meer klopt. Dat is erger dan geen wekker.

Twee dingen vangen dat op, en allebei zijn ze de reden dat de code eruitziet
zoals hij eruitziet:

- **`Text(timerInterval:countsDown:)`** tekent de klok. Die houdt zijn eigen tijd
  bij zonder dat er iets draait. Daarom staat het aftellen *niet* in
  `ContentState` — daar staat alleen wanneer hij begon en wanneer hij afgaat.
- **`staleDate`** vertelt iOS wanneer de inhoud verloopt. De app zet die op het
  moment dat de wekker afgaat; het scherm leest `context.isStale` en tekent dan
  de afgegane stand. Zo hoeft er niemand wakker te zijn op het moment dat het
  gebeurt.

Er wordt dus precies vier keer een bericht gestuurd per wekker: zetten,
pauzeren, hervatten, weghalen. Meer niet.

Twee dingen die daaruit volgen en die makkelijk over het hoofd te zien zijn:

- **Een wekker overleeft de app.** Sluit iOS de app onder je vandaan, dan staat
  de wekker er bij de volgende start nog steeds — maar je hebt er geen greep
  meer op, want je dictionary is leeg. Daarvoor is `hervatBestaande()`, die
  `Activity<KookwekkerAttributes>.activities` weer oppakt. Hij wordt aangeroepen
  bij het opstarten én bij terugkeer naar de voorgrond (`KlapperApp.swift`), en
  ruimt meteen op wat meer dan een halfuur geleden afging.
- **Een leeg tijdvenster laat SwiftUI vallen over een assertie.** Vandaar
  `ContentState.venster`, dat nooit een omgekeerd bereik teruggeeft.

### Het target opzetten in Xcode

1. **File → New → Target → Widget Extension.** Naam `KlapperWekker`. Vink
   *Include Live Activity* **aan** en *Include Configuration App Intent*
   **uit** — er valt niets in te stellen aan een kookwekker.
2. **Gooi het sjabloon weg** dat Xcode neerzet (`KlapperWekker.swift`,
   `KlapperWekkerLiveActivity.swift`, `KlapperWekkerBundle.swift`,
   `AppIntent.swift`). Let op: onze bundel heet net zo — vervang dat bestand,
   niet alleen aanvullen.
3. **Minimum deployment op 18.0**, gelijk aan `Klapper`.
4. **`NSSupportsLiveActivities` = `YES`** in de Info.plist van het **app**-target
   (niet die van de extensie). Zonder deze sleutel geeft `Activity.request`
   stilletjes een fout en zie je niets.
   `NSSupportsLiveActivitiesFrequentUpdates` heb je hier **niet** nodig: die is
   voor apps die wél elke paar seconden bijwerken, en dat is precies wat deze
   niet doet.
5. **Fonts ook in dit target.** De wekker gebruikt `Letter.kop` en
   `Letter.tekst` uit `Stijl.swift`, en een extensie kan niet bij de fonts van
   de app. Sleep dezelfde `.ttf`-bestanden in het `KlapperWekker`-target en zet
   `UIAppFonts` in de Info.plist van de extensie. Sla je dit over, dan staat de
   wekker in het systeemfont naast een app die dat niet doet.
6. **Geen App Group en geen Keychain Sharing nodig.** Dat is de natuurlijke
   aanname na de deelextensie, maar hij klopt hier niet: de widget krijgt zijn
   gegevens van ActivityKit en praat zelf nergens mee.
7. **Target membership**: vier bestanden, zie hieronder.

### Welke bestanden in welk target

Nagerekend, niet gegokt — `npm run swift:targets` doet nu allebei de extensies.
Het weet ook per extensie hoe die start: `KlapperDelen` begint bij
`NSExtensionPrincipalClass` en mag daarom géén `@main` bevatten, een
widget-extensie begint juist wél bij precies één `@main WidgetBundle`. Klopt dat
niet, of komt er van buiten de extensie een bestand met `@main` mee, dan stopt
het script met een foutmelding.

**Aanvinken bij `KlapperWekker`:**

- `KlapperWekker/KlapperWekkerBundle.swift`
- `KlapperWekker/KookwekkerLiveActivity.swift`
- `Klapper/Stijl.swift`
- `Klapper/Wekker/KookwekkerAttributes.swift`

**Níét**: `Klapper/Wekker/Kookwekker.swift` (dat is de kant die de wekker zet,
niet die hem tekent), en verder niets uit `Klapper/` — geen `Contract.swift`,
geen netwerklaag. De widget haalt niets op.

### Uitproberen

De Simulator kan dit. Live Activities werken vanaf iOS 16.2, het Dynamic Island
alleen op een iPhone 14 Pro of nieuwer — kies dus zo'n toestel, anders zie je
alleen het vergrendelscherm (⌘L).

Gewoon via de app: recept openen, **Koken**, doorbladeren naar een stap met een
wekker, starten. Neem een stap met een korte tijd, of pas er eentje aan in de
proefdata (`npm run demo`).

Waar op te letten: dat de klok loopt zonder dat de app in beeld is, dat hij na
de afgesproken tijd naar de afgegane stand springt (dat is `staleDate` die
werkt), en dat hij ná het herstarten van de app nog steeds weg te drukken is
(dat is `hervatBestaande()` die werkt). En dat *Stoppen* in de kookmodus ze
allemaal wegveegt — `Kooksessie.stop()` doet dat via `stopAlles(van:)`. Zie je niets gebeuren, kijk dan eerst bij
Instellingen → Klapper → Live Activiteiten; `Kookwekker.beschikbaar` geeft
`false` als die uitstaat en dan doet `start` bewust niets.

### Het bericht voor Claude Code op je Mac

> Er moet een widget-extensie bij: `KlapperWekker`, voor de kookwekkers op het
> vergrendelscherm. De Swift staat klaar in `ios-app/Klapper/Wekker/` en
> `ios-app/KlapperWekker/`, maar hangt nog nergens aan en is nooit
> gecompileerd.
>
> Lees eerst `ios-app/README.md` vanaf "De kookwekkers" — daar staat welke
> bestanden in welk target horen, waarom de app níét elke seconde bijwerkt, en
> welke drie Info.plist-dingen er nodig zijn. Die lijst is nagerekend met
> `npm run swift:targets`; volg hem letterlijk.
>
> Doe dan dit:
>
> 1. Maak het target aan (Widget Extension, `KlapperWekker`, mét Live Activity,
>    zónder App Intent) en gooi het sjabloon weg dat Xcode neerzet.
> 2. Vink de vier bestanden uit die lijst aan. `Kookwekker.swift` hoort er
>    beslist niet bij, `KlapperApp.swift` al helemaal niet.
> 3. Zet `NSSupportsLiveActivities` op `YES` in de Info.plist van het
>    **app**-target, en Minimum Deployment van de extensie op 18.0.
> 4. Zet dezelfde font-bestanden in het `KlapperWekker`-target en `UIAppFonts`
>    in de Info.plist van de extensie — een extensie kan niet bij de fonts van
>    de app.
> 5. Voeg de nieuwe bestanden toe aan het app-target als ze er nog niet in
>    zitten: `Klapper/Model/Hoeveelheid.swift`, `Klapper/Kooksessie.swift`,
>    `Klapper/Schermen/ReceptScherm.swift`, `KookScherm.swift` en
>    `GemaaktBlad.swift`. Alleen het app-target — `npm run swift:targets` laat
>    zien dat geen enkele extensie ze aanraakt.
> 6. Bouw alle drie de schema's met `xcodebuild`: `Klapper`, `KlapperDelen`,
>    `KlapperWekker`. Los fouten op in de bronbestanden onder `ios-app/`.
>    Reken op concurrency-geklaag rond `Kookwekker` en `Kooksessie` — allebei
>    `@MainActor` klassen die een `Task` opstarten.
> 7. Test in de app: recept openen, **Koken**, een stap met een wekker starten,
>    en dan het scherm vergrendelen. Laat me een schermafdruk zien van de
>    kookmodus, van het vergrendelscherm én van het uitgeklapte eiland, op een
>    iPhone 16 Pro-simulator.
>
> Wat ik níét wil dat je doet: de app elke seconde `Activity.update()` laten
> aanroepen om de klok bij te werken. Dat lijkt de simpele oplossing en het is
> precies de fout die deze code vermijdt — lees de opmerking bovenaan
> `KookwekkerLiveActivity.swift`.
