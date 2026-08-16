# De native app — route A

Een SwiftUI-app die praat met de Klapper-server die je al draait. De server
blijft de ene waarheid; dit toestel houdt een kopie zodat alles ook werkt als er
even geen bereik is.

## Lees dit eerst

**Deze Swift-code is nooit gecompileerd.** Er staat geen Xcode op de machine
waar ze geschreven is, en SwiftUI bestaat niet op Linux — dus de eerste keer dat
je `⌘B` drukt, komt er waarschijnlijk een lijst met fouten. Dat is verwacht, geen
teken dat er iets grondig mis is: typefouten, een verkeerd overload, een
`Sendable`-klacht. Plak ze terug, dan zijn ze zo weg.

Wat er wél is nagekeken: de serverkant. Alle endpoints hieronder zijn met echte
HTTP-aanroepen tegen een draaiende server getest — `npm run api:check`, 46
controles — en de vorm van wat ze teruggeven staat in de testsuite.

## Wat er staat

| Bestand | Wat het doet |
|---|---|
| `Model/Contract.swift` | De Swift-helft van het API-contract. De andere helft is `src/lib/api/vorm.ts`. |
| `Netwerk/Klant.swift` | Alle aanroepen naar de server, als één actor. |
| `Netwerk/Sleutelbos.swift` | Token in de Keychain, adres en naam in de gedeelde defaults. |
| `Opslag/Kast.swift` | De lokale kopie: één JSON-bestand, atomair weggeschreven. |
| `Opslag/Synchronisatie.swift` | Wat er opgehaald en weggegooid moet worden. Pure functie. |
| `Zoeker.swift` | Zoeken op ingrediënt, op het toestel. Vertaling van `search.ts`. |
| `Voorraad.swift` | Wat de schermen zien. Knoopt klant en kast aan elkaar. |
| `Stijl.swift` | De huisstijl, één op één uit `globals.css`. |
| `Schermen/` | Aanmelden en het overzicht. De rest volgt. |

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
6. **Bouwen.** Fouten terugkoppelen.

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

## Wat er nog niet is

- De receptpagina, de kookmodus, het weekmenu, de boodschappenlijst en de inbox.
- De deelextensie. Die wordt bij deze route eenvoudiger dan de variant in
  `ios-schil/`: `POST /api/v1/delen` met het token dat via de App Group al in de
  Keychain staat. Geen tweede geheim op het toestel dus, en niets in te vullen.
- Live Activities voor de kookwekkers.

De volgorde die ik zou aanhouden staat in de begroting: eerst dit ene scherm
helemaal af, want daarna weet je of de rest van de schatting klopt.
