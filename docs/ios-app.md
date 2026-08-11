# Op je beginscherm, en straks misschien in TestFlight

Twee stappen, waarvan de eerste er is en de tweede voorbereid.

## Wat er nu is: zet op beginscherm

Open de app in Safari op je iPhone, tik op deelmenu → **Zet op beginscherm**.
Je krijgt:

- het eigen icoon (het bordje uit de app, salie op papier);
- **volledig scherm** — geen adresbalk, geen tabbladen;
- een eigen venster in de app-switcher;
- **lang indrukken** op het icoon geeft snelkoppelingen naar Weekmenu en Inbox;
- werkende kookmodus als de wifi in de keuken hapert.

Wat het níét geeft: de share sheet. Safari ondersteunt Web Share Target niet,
dus deel je vanuit Instagram, dan gaat dat nog steeds via de Shortcut uit
[ios-delen.md](ios-delen.md). Dat is precies waar een echte schil later verschil
zou maken — zie onderaan.

### Waar het uit bestaat

| Bestand | Wat het doet |
| --- | --- |
| `src/app/manifest.ts` | Naam, kleuren, `display: standalone`, iconen, snelkoppelingen. |
| `src/app/layout.tsx` | De koppen die Safari nodig heeft, plus `apple-touch-icon`. |
| `public/sw.js` | De service worker: cache en offlinescherm. |
| `src/components/ServiceWorker.tsx` | Meldt de worker aan, ná het laden. |
| `scripts/iconen.mjs` | Tekent alle icoonmaten uit één bron (`npm run iconen`). |

Een paar keuzes die de moeite waard zijn om te weten:

- **`apple-mobile-web-app-capable` staat er handmatig bij.** Next zendt
  tegenwoordig alleen de moderne `mobile-web-app-capable`, maar Safari kijkt van
  oudsher naar de apple-variant; zonder die tag opent "Zet op beginscherm"
  alsnog een venster mét adresbalk.
- **`manifest.webmanifest`, `/sw.js` en `/icoon/` gaan langs de middleware.**
  Er staat niets persoonlijks in, en een inlogpagina in plaats van een script
  zou het toestel de worker laten afwijzen.
- **De bovenmarge van `.shell` telt `env(safe-area-inset-top)` mee.** In een
  tabblad is die nul en verandert er niets; op het beginscherm is er geen
  adresbalk meer en zou de titel tegen de klok aan lopen.

### Wat offline werkt, en wat niet

Dit is geen offline-versie van de app. De recepten staan in een database op een
server: zonder verbinding kun je niets nieuws ophalen en niets opslaan. Wat de
worker doet is het láátste dat je bekeek bewaren, zodat je midden in het koken
niet naar een foutmelding staart omdat de router even niksdoet.

- **Statische dingen** (bundel, lettertypen, iconen) en **receptfoto's** komen
  uit de cache. Die veranderen nooit van inhoud onder dezelfde naam.
- **Pagina's**: eerst de server, en alleen als die er niet is wat er nog stond.
  Andersom zou sneller voelen maar levert oude hoeveelheden op nadat je een
  recept net hebt bijgewerkt — en dan sta je met de verkeerde getallen in de
  keuken. De laatste 60 pagina's blijven bewaard.
- **Alles wat schrijft** — server actions, formulieren, `/api/share` — gaat
  rechtstreeks naar de server en wordt nooit bewaard.
- **Nooit bezocht en geen verbinding** geeft een eigen scherm in de huisstijl,
  geen browserfout.

Twee dingen om eerlijk over te zijn. Een pagina die je gisteren bekeek en die
sindsdien is gewijzigd toont offline de oude versie; dat is de prijs van
offline werken. En na uitloggen blijven die pagina's in de cache staan — online
kom je er niet meer bij (de server stuurt je naar het inlogscherm), maar met
het toestel in vliegtuigstand wel. Voor een app op je eigen telefoon is dat
prima; het is geen kluis.

Wijzig je iets in `public/sw.js`, hoog dan `VERSIE` op. De oude caches worden
dan bij de volgende start opgeruimd.

---

## Wat er straks kan: een Capacitor-schil

Een WebView in een native app-omhulsel. Dat levert een echte `.ipa`, dus
**TestFlight werkt**. Nodig: een Mac met Xcode en een Apple Developer-account
(€99/jaar).

Belangrijk om te snappen: de app draait dan nog steeds op je server. De schil
laadt jouw domein; er wordt niets van de app op de telefoon geïnstalleerd
behalve het omhulsel. Zonder bereikbare server is het een leeg scherm.

### Wat al klaar is

Er hoeft niets herbouwd te worden. De keuzes die je anders zou moeten
terugdraaien zijn hier al gemaakt:

- Alles is **origin-relatief**; de schil laadt dezelfde origin, dus links,
  koekjes en de service worker werken ongewijzigd.
- Het inlogkoekje is `SameSite=Lax` en wordt in een WKWebView gewoon
  meegestuurd, mits de schil het domein rechtstreeks laadt.
- De **veilige zones** zijn overal in CSS opgevangen — in een schil is er
  helemaal geen browser-chrome meer, dus dat is dan het enige dat je scheidt
  van de statusbalk.
- `npm run iconen` maakt ook een **1024×1024**, precies wat Xcode vraagt.
- Naam, kleuren en oriëntatie staan in `manifest.ts` en zijn één op één over te
  nemen.

### De stappen

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init Recepten nl.jouwdomein.recepten --web-dir=public
npx cap add ios
```

Zet in `capacitor.config.ts`:

```ts
server: { url: "https://jouw-domein.nl", cleartext: false }
```

Dan `npx cap open ios`, in Xcode je team en bundle-id kiezen, het icoon uit
`public/icoon/icoon-1024.png` in de asset catalog zetten, en **Product →
Archive → Distribute → TestFlight**.

Voor TestFlight geldt: **interne** testers (mensen op je Apple-team, tot 100)
krijgen de build zonder beoordeling, meestal binnen een kwartier. **Externe**
testers wél met beoordeling.

### De App Store gaat niet lukken

Reken daar niet op. Richtlijn **4.2 (Minimum Functionality)** is precies
geschreven tegen herverpakte websites en dit is er een. Praktisch komt daar bij
dat een reviewer niet voorbij het inlogscherm komt, dat jouw server de enige
backend is, en dat er geen publiek is — het is een tool voor twee mensen. Alle
drie afzonderlijk genoeg voor een afwijzing.

### De enige echte reden om het te doen

Niet de store — de **share sheet**. Een native schil kan wél een Share
Extension registreren, en dan deel je vanuit Instagram naar jouw icoon in
plaats van naar een Shortcut. Functioneel is dat hetzelfde (allebei POSTen naar
`/api/share`); het verschil is welk icoon er in het deelmenu staat.

Die extension is het enige stukje waar je niet omheen kunt met JavaScript: het
is een eigen target in Xcode met een handvol Swift. Zie
[ios-delen.md](ios-delen.md#optie-2--native-share-extension-later).
