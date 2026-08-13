# Delen vanaf iOS

Er zijn twee manieren om de share sheet aan deze app te knopen. De Shortcut
werkt vandaag en kost tien minuten; de Share Extension is de Lijstje-ervaring
en vraagt een Mac en een Apple Developer-account.

## Waarom geen PWA

De voor de hand liggende gedachte is een web-app die zich via de Web Share
Target API in het deelmenu zet. Dat werkt op Android, maar **Safari op iOS
ondersteunt Web Share Target niet** — een geïnstalleerde PWA verschijnt daar
niet in de share sheet. Alleen een Shortcut of een native app-extensie kan dat.

---

## Optie 1 — iOS Shortcut (nu te doen)

Werkt vanuit Instagram, de AH-app, Safari, Notities, WhatsApp: overal waar het
deelmenu een link of tekst aanbiedt. Geen App Store, geen certificaten.

1. Open **Opdrachten** (Shortcuts) → **+** → hernoem naar bijvoorbeeld
   *Bewaar recept*.
2. Tik op het instellingen-icoon (ⓘ) en zet **Toon in deelmenu** aan. Zet bij
   *Deelmenutypen* alleen **URL's** en **Tekst** aan.
3. Voeg de actie **Verkrijg inhoud van URL** toe en configureer:
   - **URL**: `https://jouw-domein.nl/api/share`
   - **Methode**: `POST`
   - **Koptekst**:
     - `Authorization` → `Bearer <je INGEST_TOKEN>`
   - **Aanvraagtekst**: `JSON`, met drie velden:
     | Sleutel    | Type   | Waarde              |
     | ---------- | ------ | ------------------- |
     | `url`      | Tekst  | *Opdrachtinvoer*    |
     | `text`     | Tekst  | *Opdrachtinvoer*    |
     | `sharedBy` | Tekst  | `Chris`             |
4. Voeg eronder **Toon melding** toe met tekst *Recept wordt opgeslagen*.
5. Klaar. Test hem door in Safari een receptpagina te delen.

`url` en `text` krijgen bewust allebei de opdrachtinvoer. Deel je een link, dan
herkent de server dat als URL en negeert het tekstveld; deel je een stuk
geselecteerde tekst, dan is het geen geldige URL en wordt de tekst gebruikt.
Zo heb je één shortcut voor beide gevallen.

Maak voor je vriendin dezelfde shortcut met een andere `sharedBy`, of laat het
veld weg.

### Instagram

Instagram geeft bij delen alleen een link mee. De app haalt het bijschrift op
via de publieke embed-pagina, die geen login vraagt — voor openbare posts is de
link dus genoeg. Zie [docs/scraper.md](scraper.md) voor hoe dat werkt en
wanneer het niet lukt (privé-accounts, of een geblokkeerd server-IP).

Lukt het niet, dan komt het item als **Tekst nodig** in de inbox. Kopieer dan
het bijschrift uit de app, plak het in het tekstvak bij dat item en druk op
*Opnieuw proberen*.

---

## Optie 2 — Native Share Extension (later)

Dit geeft de ervaring van Lijstje: je eigen icoon in de deelrij, een klein
formulier met een opslaan-knop. Nodig: een Mac met Xcode en een Apple
Developer-account (€99/jaar) om het op je eigen toestellen te zetten.

De opzet:

1. Nieuw Xcode-project, **App** (SwiftUI). Deze app kan in eerste instantie
   niet meer doen dan de website in een `WKWebView` tonen.
2. **File → New → Target → Share Extension.** Dit target levert het icoon in de
   share sheet.
3. In `Info.plist` van de extensie beperk je waarop hij verschijnt:
   ```xml
   <key>NSExtensionActivationRule</key>
   <dict>
     <key>NSExtensionActivationSupportsWebURLWithMaxCount</key><integer>1</integer>
     <key>NSExtensionActivationSupportsText</key><true/>
   </dict>
   ```
4. In `ShareViewController` haal je de gedeelde waarde uit
   `extensionContext.inputItems` (`NSItemProvider` met type-identifier
   `public.url` of `public.plain-text`) en POST je exact dezelfde JSON naar
   `/api/share` als de Shortcut hierboven.
5. Bewaar het `INGEST_TOKEN` in de Keychain met een **App Group**, zodat app en
   extensie hem delen.
6. Roep tot slot `extensionContext.completeRequest(returningItems: nil)` aan
   zodat het venster sluit.

De server hoeft hiervoor niet te veranderen — de extensie praat met dezelfde
endpoint als de Shortcut.

---

## De code voor optie 2 staat klaar

Sinds deze ronde staat in [`ios-schil/`](../ios-schil/) wat je in Xcode inplakt:
een complete `ShareViewController.swift`, een sjabloon voor het token en de
namen, en het fragment voor `Info.plist` dat bepaalt waar Klapper in het
deelmenu verschijnt. De README daar loopt de Xcode-kant stap voor stap na.

Die Swift is niet gecompileerd — er stond geen Mac naast. De logica klopt; reken
op een paar rode streepjes bij de eerste build.
