/**
 * Welke Swift-bestanden horen in welk Xcode-target?
 *
 * Xcode bewaart target membership in het projectbestand en niet in de code,
 * dus er is niets dat je waarschuwt als je een bestand vergeet aan te vinken.
 * Je merkt het pas als de compiler klaagt over een type dat er wél is — of,
 * erger, je vinkt uit voorzichtigheid alles aan en sleept `@main` de extensie
 * in, wat een bouwfout oplevert die nergens naar wijst.
 *
 * Dit script rekent de lijst uit in plaats van hem te onthouden: het begint bij
 * de bestanden van de extensie, kijkt welke typen daarin voorkomen, zoekt op
 * waar die gedeclareerd staan, en herhaalt dat tot de verzameling niet meer
 * groeit. Wat overblijft hoort er niet in.
 *
 * Grof maar ruim: het matcht op woordgrenzen, dus het neemt eerder een bestand
 * te veel mee dan te weinig. Voor deze vraag is dat de goede kant om fout te
 * zitten — een bestand te veel kost compileertijd, een bestand te weinig kost
 * een avond.
 *
 *   npm run swift:targets
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORTEL = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "ios-app");

/** Waar de extensie begint. Alles hieronder hoort per definitie bij het target. */
const EXTENSIE = "KlapperDelen";

/** Wat er nooit in een extensie mag, met de reden erbij. */
const VERBODEN = [
  {
    patroon: /^\s*@main\b/m,
    waarom:
      "hier staat `@main` in — een extensie start via NSExtensionPrincipalClass, " +
      "en een tweede startpunt is een bouwfout die nergens naar wijst",
  },
];

function swiftBestanden(map) {
  const uit = [];
  for (const naam of readdirSync(map)) {
    const vol = path.join(map, naam);
    if (statSync(vol).isDirectory()) uit.push(...swiftBestanden(vol));
    else if (naam.endsWith(".swift")) uit.push(vol);
  }
  return uit;
}

const bestanden = new Map();
for (const vol of swiftBestanden(WORTEL)) {
  bestanden.set(path.relative(WORTEL, vol), readFileSync(vol, "utf8"));
}

// Waar wordt welk type gedeclareerd? Eén declaratie per naam is genoeg: twee
// bestanden met hetzelfde typenaam zou in Swift toch al niet compileren.
const declaratie = new Map();
for (const [rel, tekst] of bestanden) {
  const patroon = /^(?:public\s+|final\s+|)?(?:struct|class|enum|actor|protocol)\s+(\w+)/gm;
  let match;
  while ((match = patroon.exec(tekst)) !== null) {
    if (!declaratie.has(match[1])) declaratie.set(match[1], rel);
  }
}

// Uitbreidingen op bestaande typen staan niet in die tabel; die noemen we hier.
const UITBREIDINGEN = new Map([
  ["JSONDecoder.klapper", "Klapper/Netwerk/Codering.swift"],
  ["JSONEncoder.klapper", "Klapper/Netwerk/Codering.swift"],
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

const nodig = new Set([...bestanden.keys()].filter((rel) => rel.startsWith(EXTENSIE)));
const wachtrij = [...nodig];
while (wachtrij.length > 0) {
  for (const volgende of verwijstNaar(wachtrij.pop())) {
    if (!nodig.has(volgende)) {
      nodig.add(volgende);
      wachtrij.push(volgende);
    }
  }
}

const erbuiten = [...bestanden.keys()].filter((rel) => !nodig.has(rel)).sort();

console.log("\n  Aanvinken bij het KlapperDelen-target\n");
for (const rel of [...nodig].sort()) console.log(`    ${rel}`);

console.log("\n  Alleen bij het Klapper-target\n");
for (const rel of erbuiten) console.log(`    ${rel}`);

// De verboden bestanden apart benoemen: dat er iets niet nodig is, is één ding;
// dat het schade doet als je het toch aanvinkt, is een ander.
const gevaar = [];
for (const rel of erbuiten) {
  for (const { patroon, waarom } of VERBODEN) {
    if (patroon.test(bestanden.get(rel))) gevaar.push({ rel, waarom });
  }
}

if (gevaar.length > 0) {
  console.log("\n  Deze mogen er beslist niet bij\n");
  for (const { rel, waarom } of gevaar) console.log(`    ${rel}\n      ${waarom}`);
}

// Belandt een verboden bestand ooit tóch in de nodig-lijst, dan is er iets
// grondig mis en hoort dit script te stoppen in plaats van het op te sommen.
const fout = [...nodig].filter((rel) =>
  VERBODEN.some(({ patroon }) => patroon.test(bestanden.get(rel))),
);
if (fout.length > 0) {
  console.error(`\n  FOUT: ${fout.join(", ")} hoort niet in de extensie te belanden.\n`);
  process.exit(1);
}

console.log(`\n  ${nodig.size} in de extensie, ${erbuiten.length} erbuiten.\n`);
