# De iOS-schil met deelmenu

Wat hier staat is het stuk dat je niet met JavaScript kunt oplossen: een native
omhulsel om de app, plus een **Share Extension** zodat Klapper met een eigen
icoon in het deelmenu van iOS staat.

Deze map is geen Xcode-project. Het zijn de bestanden die je erin plakt nadat
Xcode het project voor je heeft gemaakt — zo hoeft er geen gegenereerde
`ios/`-map van tientallen bestanden in deze repo.

| Bestand | Waar het heen gaat |
| --- | --- |
| `ShareViewController.swift` | Vervangt het bestand met dezelfde naam in het extensie-target |
| `Geheimen.voorbeeld.swift` | Kopieer naar `Geheimen.swift`, vul in, voeg toe aan het extensie-target |
| `Info-fragment.plist` | De inhoud plak je in de `Info.plist` van het extensie-target |
| `capacitor.config.ts` | In de hoofdmap van de repo, na `npx cap init` |

Voor de bredere context — server, database, TestFlight — zie
[docs/ios-app.md](../docs/ios-app.md) en [docs/ios-delen.md](../docs/ios-delen.md).

> **Niet gecompileerd.** Deze Swift is met de hand geschreven en nagelopen,
> maar er stond geen Mac naast om hem te bouwen. Reken op een paar rode
> streepjes bij de eerste build; de logica erachter klopt.

---

## 1. De schil maken

In de hoofdmap van de repo:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init Klapper nl.jouwnaam.klapper --web-dir=public
npx cap add ios
```

Zet `capacitor.config.ts` daarna zoals het voorbeeld in deze map: de schil
laadt jouw server en heeft verder niets van de app aan boord.

```bash
npx cap open ios
```

## 2. Het extensie-target toevoegen

In Xcode: **File → New → Target → Share Extension**. Noem hem
`Klapper Delen`. Xcode maakt dan een tweede target met een eigen map.

Drie dingen aanpassen in dat target:

1. **`ShareViewController.swift`** vervangen door die uit deze map.
2. **`Geheimen.swift`** toevoegen (kopie van het voorbeeld, ingevuld). Let op
   dat bij *Target Membership* rechts het extensie-target aangevinkt staat.
3. **De storyboard eruit.** Xcode maakt een `MainInterface.storyboard` en zet
   die in `Info.plist` onder `NSExtensionMainStoryboard`. Onze controller
   bouwt zijn eigen scherm, dus verwijder die sleutel en zet in plaats daarvan
   `NSExtensionPrincipalClass` — precies zoals in `Info-fragment.plist`. De
   storyboard mag je weggooien.

## 3. Waar hij mag verschijnen

De rest van `Info-fragment.plist` beperkt waarop de extensie in het deelmenu
komt: links en tekst, en niets anders. Zonder die beperking staat Klapper ook
tussen je opties als je een foto of een pdf deelt, en daar kan hij niets mee.

## 4. Bouwen en testen

Sluit je telefoon aan, kies het **app**-target (niet de extensie) en druk op
▶︎. Open daarna Safari, deel een receptpagina, en scrol in de deelrij naar
rechts — daar staat Klapper. Zie je hem niet, tik dan op **Meer** en zet hem
aan.

Wat je zou moeten zien: een klein venster met de link erin, jouw naam
voorgeselecteerd, en een knop **Bewaren**. Eén tik, "Bewaard in Klapper", weg.
In de Inbox van de app staat het item dan al op *In wachtrij*.

---

## Als het niet werkt

| Wat je ziet | Wat het is |
| --- | --- |
| Klapper staat niet in het deelmenu | Het extensie-target is niet meegebouwd, of de activatieregel klopt niet. Deel eerst eens vanuit Safari — die biedt gegarandeerd een link aan. |
| "Het token klopt niet" | `ingestToken` in `Geheimen.swift` is niet gelijk aan `INGEST_TOKEN` in de `.env` op de server, of hij is korter dan 16 tekens. |
| "Niet gelukt" met een netwerkfout | De server is niet bereikbaar vanaf de telefoon. Test het adres eerst in Safari op datzelfde toestel. |
| Het venster is leeg | Er zat geen link of tekst in wat je deelde. Instagram geeft soms alleen een afbeelding mee; deel dan de link naar de post. |

## Wat er nog beter kan

Het token staat nu in de app-binary. Voor twee mensen met TestFlight is dat
prima — de app komt nergens anders. Wil je het strakker, dan is de route: een
**App Group** aanmaken in het developer-portaal, hem aan allebei de targets
hangen, het token in de Keychain zetten vanuit een instellingenscherm in de
hoofdapp, en `Geheimen` daaruit laten lezen. Dat is echt werk voor een gevaar
dat er in jullie geval niet is, dus het staat hier als notitie en niet als
stap.
