#!/usr/bin/env node
/**
 * Klopt `Contract.swift` nog met wat de server werkelijk stuurt?
 *
 * Draaien:  npm run demo          (in een ander venster)
 *           npm run swift:vorm
 *
 * Dit is een noodgreep, en dat mag je weten. Normaal vangt de compiler dit:
 * je decodeert JSON in een struct, er ontbreekt een veld, en Xcode zegt het.
 * Maar er staat hier geen Swift-toolchain, dus zonder deze controle zou een
 * verzonnen veldnaam pas opvallen op de eerste avond dat jij achter Xcode zit.
 *
 * Wat het wél doet: de veldnamen uit de Swift-bron trekken en naast de echte
 * JSON leggen. Wat het níét doet: typen controleren. Staat er `Int` waar een
 * `Double` hoort, dan ziet dit script dat niet en de compiler ook niet — dat
 * merk je pas bij het draaien.
 */

import { readFileSync } from "node:fs";

const BASIS = (process.argv[2] ?? "http://localhost:3100").replace(/\/$/, "");
const WACHTWOORD = process.argv[3] ?? "proefkonijn";
const V1 = `${BASIS}/api/v1`;
const BRON = "ios-app/Klapper/Model/Contract.swift";

let goed = 0;
const stuk = [];

/**
 * De velden van één struct, zónder die van de structs die erin genest zitten.
 *
 * Dat weglaten is de hele truc: `Stand` bevat `Stempel` en `Inbox`, en zonder
 * die eruit te knippen lijkt het alsof `Stand` velden verwacht die de server
 * niet stuurt. Een geneste naam spreek je aan als "Stand.Stempel".
 */
function leesStructs(bron) {
  const structs = new Map();

  function loop(tekst, voorvoegsel) {
    const patroon = /struct\s+(\w+)[^{]*\{/g;
    let match;
    while ((match = patroon.exec(tekst)) !== null) {
      const naam = match[1];
      const open = patroon.lastIndex - 1;
      let diepte = 0;
      let eind = open;
      for (let i = open; i < tekst.length; i += 1) {
        if (tekst[i] === "{") diepte += 1;
        if (tekst[i] === "}") {
          diepte -= 1;
          if (diepte === 0) {
            eind = i;
            break;
          }
        }
      }
      const body = tekst.slice(open + 1, eind);
      const volledig = voorvoegsel ? `${voorvoegsel}.${naam}` : naam;

      // Eerst de geneste structs eruit, dán de velden tellen.
      const zonderGenest = body.replace(/struct\s+\w+[^{]*\{[\s\S]*?\n    \}/g, "");
      structs.set(volledig, {
        velden: new Set(
          [...zonderGenest.matchAll(/^\s*(?:let|var)\s+(\w+)\s*:/gm)].map((m) => m[1]),
        ),
        // Berekende eigenschappen zijn geen JSON en horen niet mee te tellen:
        // Swift zet alleen opgeslagen eigenschappen in de CodingKeys. Zowel de
        // eenregelige (`var id: String { tekst }`) als de meerregelige vorm.
        berekend: new Set(
          [...body.matchAll(/(?:let|var)\s+(\w+)\s*:[^\n=]*\{/gm)].map((m) => m[1]),
        ),
      });

      loop(body, volledig);
      patroon.lastIndex = eind;
    }
  }

  loop(bron, "");
  return structs;
}

function zoek(structs, naam) {
  if (structs.has(naam)) return structs.get(naam);
  // Alleen de laatste naam gegeven? Dan mag het als hij uniek is.
  const treffers = [...structs.entries()].filter(([sleutel]) => sleutel.endsWith(`.${naam}`));
  return treffers.length === 1 ? treffers[0][1] : null;
}

function vergelijk(structs, pad, echt, structnaam) {
  const struct = zoek(structs, structnaam);
  if (!struct) {
    console.log(`  ✗   ${pad} → struct ${structnaam} niet gevonden (of niet uniek)`);
    stuk.push(pad);
    return;
  }
  if (echt === null || echt === undefined) {
    console.log(`  --  ${pad} → niets om mee te vergelijken`);
    return;
  }

  const json = new Set(Object.keys(echt));
  const mist = [...json].filter((k) => !struct.velden.has(k));
  const verzonnen = [...struct.velden].filter(
    (k) => !json.has(k) && !struct.berekend.has(k),
  );

  if (mist.length === 0 && verzonnen.length === 0) {
    console.log(`  ok  ${pad} → ${structnaam}`);
    goed += 1;
    return;
  }
  console.log(`  ✗   ${pad} → ${structnaam}`);
  if (mist.length) console.log(`        server stuurt, Swift mist:  ${mist.join(", ")}`);
  if (verzonnen.length) console.log(`        Swift wil, server stuurt niet:  ${verzonnen.join(", ")}`);
  stuk.push(pad);
}

async function main() {
  const structs = leesStructs(readFileSync(BRON, "utf8"));
  console.log(`\n  ${BRON} — ${structs.size} structs\n`);

  const response = await fetch(`${V1}/aanmelden`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wachtwoord: WACHTWOORD }),
  });
  const aanmelding = await response.json();
  if (!aanmelding?.token) {
    console.error("  Aanmelden mislukte. Draait de server, en klopt het wachtwoord?\n");
    process.exit(1);
  }
  const kop = { authorization: `Bearer ${aanmelding.token}` };
  const haal = async (pad) => (await fetch(V1 + pad, { headers: kop })).json();

  vergelijk(structs, "/aanmelden", aanmelding, "Aanmelding");

  const stand = await haal("/stand");
  vergelijk(structs, "/stand", stand, "Stand");
  vergelijk(structs, "/stand .recepten[]", stand.recepten[0], "Stand.Stempel");
  vergelijk(structs, "/stand .instellingen", stand.instellingen, "Instellingen");
  vergelijk(structs, "/stand .instellingen.voorkeuren[]", Object.values(stand.instellingen.voorkeuren)[0], "Instellingen.Voorkeur");
  vergelijk(structs, "/stand .inbox", stand.inbox, "Stand.Inbox");

  const id = stand.recepten[0]?.id;
  if (id) {
    const recept = await haal(`/recepten/${id}`);
    vergelijk(structs, "/recepten/:id", recept, "Recept");
    vergelijk(structs, "  .bron", recept.bron, "Recept.Bron");
    vergelijk(structs, "  .bewerkt", recept.bewerkt, "Recept.Bewerking");
    vergelijk(structs, "  .ingredientgroepen[]", recept.ingredientgroepen[0], "Ingredientgroep");
    vergelijk(structs, "  .ingredientgroepen[].items[]", recept.ingredientgroepen[0]?.items[0], "Ingredient");
    vergelijk(structs, "  .stappen[]", recept.stappen[0], "Stap");
    vergelijk(structs, "  .kooklog[]", recept.kooklog[0], "Kooklogregel");
    vergelijk(structs, "/recepten", await haal(`/recepten?ids=${id}`), "Receptenbundel");
  }

  const week = await haal("/weekmenu");
  vergelijk(structs, "/weekmenu", week, "Weekmenu");
  vergelijk(structs, "/weekmenu .regels[]", week.regels[0], "Weekmenu.Regel");

  const boodschappen = await haal("/boodschappen");
  vergelijk(structs, "/boodschappen", boodschappen, "Boodschappen");
  vergelijk(structs, "/boodschappen .groepen[]", boodschappen.groepen[0], "Boodschappen.Groep");
  vergelijk(structs, "/boodschappen .groepen[].regels[]", boodschappen.groepen[0]?.regels[0], "Boodschappen.Regel");

  // De datums. `JSONDecoder.dateDecodingStrategy = .iso8601` slikt géén
  // fractionele seconden, en `toISOString()` in JavaScript zet ze er altijd in.
  // Dat is precies het soort verschil waar een app op stukloopt zonder dat
  // iemand snapt waarom, dus het staat hier expliciet in.
  console.log("");
  const metFractie = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+/;
  const monsters = [
    ["/stand .nu", stand.nu],
    ["/aanmelden .vervalt", aanmelding.vervalt],
  ];
  const heeftFracties = monsters.some(([, waarde]) => metFractie.test(waarde));
  for (const [naam, waarde] of monsters) {
    console.log(`  --  ${naam} = ${waarde}`);
  }
  if (heeftFracties) {
    console.log(
      "      → met fractionele seconden. De decoder in Klant.swift moet die aankunnen;\n" +
        "        de kale `.iso8601` doet dat niet.",
    );
  }

  console.log(`\n  ${goed} goed, ${stuk.length} fout`);
  for (const pad of stuk) console.log(`    ✗ ${pad}`);
  console.log("");
  process.exit(stuk.length > 0 ? 1 : 0);
}

main().catch((fout) => {
  console.error(`\n  Ging mis: ${fout.message}`);
  console.error("  Draait de server? Standaard wordt http://localhost:3100 geprobeerd.\n");
  process.exit(1);
});
