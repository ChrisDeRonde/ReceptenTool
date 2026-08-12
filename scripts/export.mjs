#!/usr/bin/env node
/**
 * Alle recepten als losse markdown-bestanden.
 *
 * Draaien:  npm run export            → ./export
 *           npm run export -- /pad    → ergens anders
 *
 * De back-up is een SQLite-bestand: prima om terug te zetten, waardeloos om te
 * lézen. Dit is de andere helft. Een map met leesbare bestanden die je in
 * Notities, Obsidian of een teksteditor opent, die je kunt printen en die nog
 * steeds iets waard is als deze app er niet meer is.
 *
 * Draait ook automatisch mee in `npm run db:backup`, want een export die je
 * moet onthouden is een export die je vergeet.
 */

import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

/**
 * De recepten wegschrijven naar `doel`.
 *
 * Geeft terug hoeveel bestanden het werden en welke er zijn overgeslagen —
 * dat laatste hoort een aanroeper te kunnen melden in plaats van dat het
 * stilletjes verdwijnt.
 */
export async function exporteer(doel, { stil = false } = {}) {
  // Pas hier laden: dit bestand wordt ook door backup.mjs geïmporteerd, en dan
  // is de omgeving daar al ingelezen.
  const { PrismaClient } = require("../src/generated/prisma/client.js");
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
  const { receptNaarMarkdown, bestandsnaam } = await laadOpmaak();

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ontbreekt.");
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

  try {
    const rijen = await prisma.recipe.findMany({
      orderBy: { title: "asc" },
      include: { cookLogs: { orderBy: { cookedAt: "desc" } } },
    });

    await mkdir(doel, { recursive: true });

    // Wat er van een vorige run staat eerst weg. Een recept dat je verwijderde
    // hoort niet als spookbestand in je export te blijven staan.
    if (existsSync(doel)) {
      for (const naam of await readdir(doel)) {
        if (naam.endsWith(".md")) await rm(path.join(doel, naam));
      }
    }

    const overgeslagen = [];
    const gebruikt = new Map();
    let geschreven = 0;

    for (const rij of rijen) {
      let recept;
      try {
        recept = JSON.parse(rij.data);
      } catch {
        overgeslagen.push(`${rij.title} — de opgeslagen vorm is geen geldige JSON`);
        continue;
      }
      if (!recept || typeof recept.title !== "string" || !Array.isArray(recept.steps)) {
        overgeslagen.push(`${rij.title} — opgeslagen in een oudere vorm`);
        continue;
      }

      // Twee recepten die "Pasta" heten leveren dezelfde bestandsnaam op; de
      // tweede krijgt er een nummer bij in plaats van de eerste te overschrijven.
      let naam = bestandsnaam(recept.title, rij.id);
      const aantal = (gebruikt.get(naam) ?? 0) + 1;
      gebruikt.set(naam, aantal);
      if (aantal > 1) naam = naam.replace(/\.md$/, `-${aantal}.md`);

      await writeFile(
        path.join(doel, naam),
        receptNaarMarkdown(recept, {
          sourceUrl: rij.sourceUrl,
          sourceName: rij.sourceName,
          tags: rij.tags,
          cuisine: rij.cuisine,
          createdAt: rij.createdAt,
          gemaakt: rij.cookLogs,
        }),
        "utf8",
      );
      geschreven++;
    }

    if (!stil) {
      console.log(`  ${geschreven} recepten naar ${doel}`);
      for (const regel of overgeslagen) console.log(`  overgeslagen: ${regel}`);
    }
    return { geschreven, overgeslagen };
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * De opmaak komt uit TypeScript. Node 22 streept de types zelf af; de
 * extensieloze import binnen dat bestand regelt `scripts/ts-loader.mjs`, en
 * daarom draaien zowel `npm run export` als `npm run db:backup` met die hook.
 */
function laadOpmaak() {
  return import(new URL("../src/lib/recipe/markdown.ts", import.meta.url).href);
}

// Alleen als je dit bestand zelf draait, niet als backup.mjs het importeert.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const root = process.cwd();
  if (existsSync(path.join(root, ".env"))) process.loadEnvFile(path.join(root, ".env"));
  const doel = process.argv[2] ?? path.join(root, "export");

  exporteer(doel).catch((fout) => {
    console.error(`\n  Ging mis: ${fout.message}\n`);
    process.exit(1);
  });
}
