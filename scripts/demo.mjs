#!/usr/bin/env node
/**
 * De app opstarten met proefgegevens, om even rond te klikken.
 *
 * Draaien: npm run demo
 *
 * Wat dit expliciet níét doet: aan je echte database komen. Alles gaat naar
 * `demo.db` en `demo-uploads/`, allebei naast het project en allebei uit git
 * gehouden. Wil je opnieuw beginnen, dan gooi je die twee weg — of je draait
 * dit gewoon nog een keer, want elke start begint met een schone lei.
 *
 * Er is ook geen API-sleutel nodig. Importeren werkt in deze stand niet (dat
 * is het enige dat het model gebruikt), al het andere wel: zoeken, filteren,
 * porties omrekenen, de kookmodus met de wekker, het weekmenu, de
 * boodschappenlijst, de kooklog, je profiel en de instellingen.
 */

import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const WORTEL = process.cwd();
const DB = path.join(WORTEL, "demo.db");
const FOTOS = path.join(WORTEL, "demo-uploads");
const POORT = process.env.PORT ?? "3100";

/** Kort en uit te spreken; dit hoeft niets te beveiligen. */
const WACHTWOORD = "proefkonijn";

const OMGEVING = {
  ...process.env,
  DATABASE_URL: `file:${DB}`,
  UPLOAD_DIR: FOTOS,
  APP_PASSWORD: WACHTWOORD,
  APP_USERS: "Chris,Sanne",
  APP_BASE_URL: `http://localhost:${POORT}`,
  // Lang genoeg om de controle te halen; er komt hier niets binnen.
  INGEST_TOKEN: "demo-token-dat-nergens-toegang-toe-geeft",
  PORT: POORT,
};

async function draai(commando, argumenten, opties = {}) {
  await new Promise((klaar, mis) => {
    const kind = spawn(commando, argumenten, {
      stdio: "inherit",
      env: OMGEVING,
      ...opties,
    });
    kind.on("error", mis);
    kind.on("exit", (code) =>
      code === 0 ? klaar() : mis(new Error(`${commando} stopte met ${code}`)),
    );
  });
}

/**
 * Een kleurvlak in plaats van een foto.
 *
 * Echte receptfoto's kan ik hier niet meeleveren — die zijn van iemand. Twee
 * cirkels op een zachte ondergrond zijn genoeg om te zien hoe de tegels en de
 * kop van een recept eruitzien met en zonder beeld.
 */
async function maakFoto(sharp, naam, tint) {
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <rect width="1200" height="800" fill="${tint[0]}"/>
    <circle cx="420" cy="300" r="230" fill="${tint[1]}" opacity="0.55"/>
    <circle cx="820" cy="520" r="180" fill="${tint[2]}" opacity="0.5"/>
  </svg>`);
  await sharp(svg).jpeg({ quality: 82 }).toFile(path.join(FOTOS, naam));
}

const TINTEN = [
  ["#d8c19a", "#e7d7b8", "#c9ad82"],
  ["#c9a898", "#e0c8bd", "#b98f7e"],
  ["#a8bfa2", "#c9d8c4", "#8faa8a"],
  ["#a6b3c4", "#c6d0da", "#8c9db2"],
  ["#c8b394", "#dfd0b6", "#b09a79"],
];

async function main() {
  const sharp = require("sharp");
  const gegevens = require("./demo-data.json");

  console.log("\n  Proefopstelling klaarzetten…\n");

  // Schoon beginnen. Anders stapelen kooklogregels zich op bij elke start en
  // klopt "3 keer gemaakt" na een week demonstreren nergens meer op.
  await rm(DB, { force: true });
  await rm(`${DB}-journal`, { force: true });
  await rm(FOTOS, { recursive: true, force: true });
  await mkdir(FOTOS, { recursive: true });

  // Het schema erin. De URL gaat er expliciet bij en niet alleen via de
  // omgeving: dit commando kan een database leegtrekken, en dan wil je niet
  // afhangen van de vraag of prisma.config.ts jouw .env eroverheen legt.
  //
  // Bewust zónder --accept-data-loss. Het bestand is een regel hierboven
  // weggegooid, dus er valt niets te verliezen; zou Prisma hier tóch over
  // gegevens beginnen, dan wijst dit naar de verkeerde database en hoort dit
  // script te stoppen in plaats van door te drukken.
  await draai("npx", ["prisma", "db", "push", "--url", `file:${DB}`]);

  const { PrismaClient } = require("../src/generated/prisma/client.js");
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${DB}` }),
  });

  // Alle datums liggen vast ten opzichte van vandaag, zodat "2 dagen geleden"
  // ook echt twee dagen geleden is, op welke dag je dit ook draait.
  const middernacht = new Date();
  middernacht.setHours(0, 0, 0, 0);
  const dag = (verschil) =>
    new Date(middernacht.getTime() + verschil * 86_400_000);

  // Het weekmenu hangt niet aan vandaag maar aan de máándag van deze week.
  // Met een verschuiving vanaf vandaag zou een start op zondag de helft van
  // het menu in de week erna zetten, en dan opent de app op een lege week.
  const maandag = new Date(middernacht);
  maandag.setDate(maandag.getDate() - ((maandag.getDay() + 6) % 7));
  const weekdag = (nummer) =>
    new Date(maandag.getTime() + nummer * 86_400_000);

  let tint = 0;
  for (const recept of gegevens.recepten) {
    if (recept.foto) await maakFoto(sharp, recept.foto, TINTEN[tint++ % TINTEN.length]);

    await prisma.recipe.create({
      data: {
        id: recept.id,
        createdAt: dag(recept.dagen),
        title: recept.title,
        description: recept.description,
        sourceUrl: recept.sourceUrl,
        sourceName: recept.sourceName,
        imageUrl: recept.foto ? `/api/foto/${recept.foto}` : null,
        servings: recept.servings,
        prepMinutes: recept.prepMinutes,
        cookMinutes: recept.cookMinutes,
        totalMinutes: recept.totalMinutes,
        data: JSON.stringify(recept.data),
        tags: recept.tags,
        mealTypes: recept.mealTypes,
        cuisine: recept.cuisine,
        diets: recept.diets ?? "",
        favorite: recept.favorite,
      },
    });
  }

  for (const item of gegevens.items) {
    await prisma.shareItem.create({
      data: {
        id: item.id,
        createdAt: dag(item.dagen),
        status: item.status,
        sourceType: item.sourceType,
        sourceUrl: item.sourceUrl,
        sharedText: item.sharedText,
        sharedBy: item.sharedBy,
        error: item.error,
        strategy: item.strategy,
        duplicateOfId: item.duplicateOfId,
      },
    });
    // De koppeling staat aan de receptkant; die kan pas als allebei bestaan.
    if (item.recipeId) {
      await prisma.recipe.update({
        where: { id: item.recipeId },
        data: { shareItemId: item.id },
      });
    }
  }

  for (const log of gegevens.logs) {
    await prisma.cookLog.create({
      data: {
        recipeId: log.recipeId,
        cookedAt: dag(log.dagen),
        rating: log.rating,
        note: log.note,
        again: log.again,
        who: log.who,
      },
    });
  }

  for (const regel of gegevens.menu) {
    await prisma.menuEntry.create({
      data: {
        recipeId: regel.recipeId,
        date: weekdag(regel.weekdag),
        servings: regel.servings,
      },
    });
  }

  await prisma.setting.createMany({
    data: [
      { key: "huishouden", value: "2" },
      { key: "personen", value: "Chris, Sanne" },
      // Eén voorkeur per soort, zodat allebei de mechanismen te zien zijn: het
      // dieet vergelijkt met het etiket, de afkeer met de ingrediënten zelf.
      {
        key: "voorkeuren",
        value: JSON.stringify({
          Chris: { dieet: [], afkeer: ["koriander"] },
          Sanne: { dieet: [], afkeer: [] },
        }),
      },
    ],
  });

  await prisma.$disconnect();

  console.log(`
  ┌─────────────────────────────────────────────────┐
    Proefopstelling staat klaar.

    Adres       http://localhost:${POORT}
    Wachtwoord  ${WACHTWOORD}

    ${gegevens.recepten.length} recepten, een gevuld weekmenu en een inbox met
    een dubbele import. Alles staat in demo.db en demo-uploads;
    je eigen dev.db blijft ongemoeid.

    Importeren werkt hier niet — dat is het enige dat een
    API-sleutel nodig heeft. De rest wel.

    Stoppen met Ctrl-C. Opnieuw beginnen? Nog een keer
    npm run demo; elke start wist de proefgegevens.
  └─────────────────────────────────────────────────┘
`);

  await draai("npx", ["next", "dev", "--port", POORT]);
}

main().catch((fout) => {
  console.error(`\n  Ging mis: ${fout.message}\n`);
  process.exit(1);
});
