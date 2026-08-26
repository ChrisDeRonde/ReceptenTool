/**
 * Welke Swift-bestanden horen in welk Xcode-target?
 *
 * Xcode bewaart target membership in het projectbestand en niet in de code,
 * dus er is niets dat je waarschuwt als je een bestand vergeet aan te vinken.
 * Je merkt het pas als de compiler klaagt over een type dat er wél is — of,
 * erger, je vinkt uit voorzichtigheid alles aan en sleept `@main` een extensie
 * in, wat een bouwfout oplevert die nergens naar wijst.
 *
 * Dit script rekent de lijst uit in plaats van hem te onthouden: het begint bij
 * de bestanden van een extensie, kijkt welke typen daarin voorkomen, zoekt op
 * waar die gedeclareerd staan, en herhaalt dat tot de verzameling niet meer
 * groeit. Wat overblijft hoort er niet in.
 *
 * Grof maar ruim: het matcht op woordgrenzen, dus het neemt eerder een bestand
 * te veel mee dan te weinig. Voor deze vraag is dat de goede kant om fout te
 * zitten — een bestand te veel kost compileertijd, een bestand te weinig kost
 * een avond. Commentaar en tekstliteralen tellen wél niet mee; zonder dat
 * sleepte `Text("Stap 3 van 8")` het hele `Contract.swift` de widget in.
 *
 *   npm run swift:targets
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORTEL = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "ios-app");

/**
 * De extensies, met hun startpunt erbij.
 *
 * Dat startpunt is geen detail. Een deelextensie begint bij
 * `NSExtensionPrincipalClass` en mag daarom géén `@main` bevatten; een
 * widget-extensie begint juist wél bij een `@main WidgetBundle`. Dezelfde regel
 * voor allebei zou de een of de ander onterecht afkeuren, dus staat hij hier
 * per extensie.
 */
const EXTENSIES = [
  { map: "KlapperDelen", start: "principal", wat: "de deelextensie" },
  { map: "KlapperWekker", start: "main", wat: "de kookwekkers" },
];

/** Het app-target zelf. Alles hieronder hoort er per definitie bij. */
const APP = "Klapper";

function swiftBestanden(map) {
  const uit = [];
  for (const naam of readdirSync(map)) {
    const vol = path.join(map, naam);
    if (statSync(vol).isDirectory()) uit.push(...swiftBestanden(vol));
    else if (naam.endsWith(".swift")) uit.push(vol);
  }
  return uit;
}

/**
 * De code zonder commentaar en zonder de inhoud van tekstliteralen.
 *
 * Anders telt elke zin mee als verwijzing. `Text("Stap 3 van 8")` haalde
 * `Contract.swift` de widget in omdat daar een `struct Stap` staat, en een
 * doc-commentaar dat een ander bestand noemt doet hetzelfde. Wat er tussen
 * `\(` en `)` staat is wél code en blijft dus staan.
 *
 * Wat eruit gaat wordt vervangen door spaties, zodat regelnummers en
 * regelbegin kloppen — `^\s*@main` hangt daarvan af. Rauwe strings met een
 * hekje (`#"..."#`) kent dit niet; die komen in deze code niet voor.
 */
function codeVan(tekst) {
  const stapel = [];
  const haakjes = [];
  let uit = "";
  let i = 0;

  const leeg = (aantal) => {
    for (let k = 0; k < aantal; k += 1) uit += tekst[i + k] === "\n" ? "\n" : " ";
    i += aantal;
  };

  while (i < tekst.length) {
    const boven = stapel[stapel.length - 1];

    if (boven === "tekst" || boven === "blok") {
      if (tekst[i] === "\\") {
        if (tekst[i + 1] === "(") {
          stapel.push("invoeging");
          haakjes.push(1);
          uit += " (";
          i += 2;
        } else {
          leeg(2);
        }
        continue;
      }
      if (boven === "blok" && tekst.startsWith('"""', i)) {
        stapel.pop();
        leeg(3);
        continue;
      }
      if (boven === "tekst" && (tekst[i] === '"' || tekst[i] === "\n")) {
        stapel.pop();
        leeg(1);
        continue;
      }
      leeg(1);
      continue;
    }

    if (tekst.startsWith("//", i)) {
      while (i < tekst.length && tekst[i] !== "\n") leeg(1);
      continue;
    }
    if (tekst.startsWith("/*", i)) {
      let diepte = 1;
      leeg(2);
      while (i < tekst.length && diepte > 0) {
        if (tekst.startsWith("/*", i)) diepte += 1;
        else if (tekst.startsWith("*/", i)) diepte -= 1;
        else {
          leeg(1);
          continue;
        }
        leeg(2);
      }
      continue;
    }
    if (tekst.startsWith('"""', i)) {
      stapel.push("blok");
      leeg(3);
      continue;
    }
    if (tekst[i] === '"') {
      stapel.push("tekst");
      leeg(1);
      continue;
    }
    if (boven === "invoeging") {
      if (tekst[i] === "(") haakjes[haakjes.length - 1] += 1;
      if (tekst[i] === ")") {
        haakjes[haakjes.length - 1] -= 1;
        if (haakjes[haakjes.length - 1] === 0) {
          haakjes.pop();
          stapel.pop();
        }
      }
    }

    uit += tekst[i];
    i += 1;
  }

  return uit;
}

const bestanden = new Map();
for (const vol of swiftBestanden(WORTEL)) {
  bestanden.set(path.relative(WORTEL, vol), codeVan(readFileSync(vol, "utf8")));
}

// Waar wordt welk type gedeclareerd? Eén declaratie per naam is genoeg: twee
// bestanden met dezelfde typenaam zou in Swift toch al niet compileren.
// `private` staat er bewust niet bij: die typen kan een ander bestand niet
// zien, dus ze zeggen niets over target membership.
const declaratie = new Map();
for (const [rel, tekst] of bestanden) {
  const patroon = /^(?:public\s+|final\s+|)?(?:struct|class|enum|actor|protocol)\s+(\w+)/gm;
  let match;
  while ((match = patroon.exec(tekst)) !== null) {
    if (!declaratie.has(match[1])) declaratie.set(match[1], rel);
  }
}

// Uitbreidingen op bestaande typen staan niet in die tabel; die noemen we hier.
// Sleutel is een stuk tekst zoals het in de code staat, want een methode op een
// bestaand type verraadt zich niet met een typenaam.
const UITBREIDINGEN = new Map([
  ["JSONDecoder.klapper", "Klapper/Netwerk/Codering.swift"],
  ["JSONEncoder.klapper", "Klapper/Netwerk/Codering.swift"],
  [".groepen(voor:", "Klapper/Model/Hoeveelheid.swift"],
  [".maal(", "Klapper/Model/Hoeveelheid.swift"],
]);

function verwijstNaar(rel) {
  const tekst = bestanden.get(rel);
  const uit = new Set();
  for (const [naam, bron] of declaratie) {
    if (bron === rel) continue;
    if (new RegExp(`\\b${naam}\\b`).test(tekst)) uit.add(bron);
  }
  for (const [naam, bron] of UITBREIDINGEN) {
    if (bron !== rel && tekst.includes(naam)) uit.add(bron);
  }
  return uit;
}

const HEEFT_MAIN = /^\s*@main\b/m;

/** De transitieve sluiting vanaf de bestanden van één map. */
function sluiting(map) {
  const nodig = new Set([...bestanden.keys()].filter((rel) => rel.startsWith(`${map}/`)));
  const wachtrij = [...nodig];
  while (wachtrij.length > 0) {
    for (const volgende of verwijstNaar(wachtrij.pop())) {
      if (!nodig.has(volgende)) {
        nodig.add(volgende);
        wachtrij.push(volgende);
      }
    }
  }
  return nodig;
}

const fouten = [];
const inEenExtensie = new Set();

for (const { map, start, wat } of EXTENSIES) {
  const nodig = sluiting(map);
  const eigen = [...nodig].filter((rel) => rel.startsWith(`${map}/`)).sort();
  const meegenomen = [...nodig].filter((rel) => !rel.startsWith(`${map}/`)).sort();
  for (const rel of nodig) inEenExtensie.add(rel);

  console.log(`\n  Aanvinken bij het ${map}-target — ${wat}\n`);
  for (const rel of [...eigen, ...meegenomen]) console.log(`    ${rel}`);

  // Wat van buiten meekomt mag nooit een startpunt zijn. Dit is de fout die
  // een avond kost: `KlapperApp.swift` "voor de zekerheid" aanvinken.
  const binnengesleept = meegenomen.filter((rel) => HEEFT_MAIN.test(bestanden.get(rel)));
  if (binnengesleept.length > 0) {
    fouten.push(
      `${map}: ${binnengesleept.join(", ")} bevat \`@main\` en komt van buiten de extensie mee. ` +
        "Een tweede startpunt is een bouwfout die nergens naar wijst.",
    );
  }

  // En het eigen startpunt moet kloppen met hoe de extensie start.
  const eigenMain = eigen.filter((rel) => HEEFT_MAIN.test(bestanden.get(rel)));
  if (start === "main" && eigenMain.length !== 1) {
    fouten.push(
      `${map}: een widget-extensie start bij precies één \`@main\`, maar ik tel er ${eigenMain.length}.`,
    );
  }
  if (start === "principal" && eigenMain.length !== 0) {
    fouten.push(
      `${map}: deze extensie start via NSExtensionPrincipalClass, dus er hoort geen \`@main\` in ` +
        `— gevonden in ${eigenMain.join(", ")}.`,
    );
  }
}

// Alles onder `Klapper/` hoort bij de app; wat daar staat en door geen enkele
// extensie geraakt wordt, hoort daar ook alléén bij.
const alleenApp = [...bestanden.keys()]
  .filter((rel) => rel.startsWith(`${APP}/`) && !inEenExtensie.has(rel))
  .sort();

console.log(`\n  Alleen bij het ${APP}-target\n`);
for (const rel of alleenApp) console.log(`    ${rel}`);

// Dat iets niet nodig is, is één ding; dat het schade doet als je het toch
// aanvinkt, is een ander. Die apart benoemen.
const gevaar = alleenApp.filter((rel) => HEEFT_MAIN.test(bestanden.get(rel)));
if (gevaar.length > 0) {
  console.log("\n  Deze mogen bij geen enkele extensie\n");
  for (const rel of gevaar) {
    console.log(`    ${rel}\n      hier staat \`@main\` in — dat is het startpunt van de app zelf`);
  }
}

const gedeeld = [...bestanden.keys()]
  .filter((rel) => rel.startsWith(`${APP}/`) && inEenExtensie.has(rel))
  .sort();

console.log(
  `\n  ${bestanden.size} bestanden, waarvan ${gedeeld.length} uit ${APP}/ in meer dan één target.\n`,
);

if (fouten.length > 0) {
  console.error("  FOUT\n");
  for (const regel of fouten) console.error(`    ${regel}\n`);
  process.exit(1);
}
