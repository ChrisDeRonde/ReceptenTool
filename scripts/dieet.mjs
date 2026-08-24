#!/usr/bin/env node
/**
 * De dieetkenmerken invullen bij recepten die er nog geen hebben.
 *
 * Draaien:  npm run dieet -- --droog    → laat zien wat het zou doen
 *           npm run dieet               → schrijft het weg
 *           npm run dieet -- --alles    → ook recepten die al iets hebben
 *
 * Twee rondes, in deze volgorde:
 *
 *  1. **Uit de tags.** Vóór dit veld bestond, vroeg de importprompt het model
 *     om dieet als tag ("vegetarisch"). Dat staat er dus al bij een deel van de
 *     collectie. Dat overnemen kost niets en is precies zo betrouwbaar als het
 *     toen was.
 *  2. **Uit de ingrediënten.** Wat er dan nog leeg is, gaat in groepjes naar
 *     het model — alleen de titel en de ingrediëntenlijst, niet het hele
 *     recept. Eén aanroep per twintig recepten.
 *
 * Wat het model niet zeker weet, blijft leeg. Dat is geen tekortkoming maar de
 * afspraak: een leeg kenmerk kost een filtertreffer, een verkeerd kenmerk zet
 * iemand iets voor waar hij niet tegen kan. Zie ook de waarschuwing bovenaan
 * `src/lib/recipe/categories.ts`.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** Hoeveel recepten er in één modelaanroep gaan. */
const GROEP = 20;

async function main() {
  const root = process.cwd();
  if (existsSync(path.join(root, ".env"))) process.loadEnvFile(path.join(root, ".env"));

  const droog = process.argv.includes("--droog");
  const alles = process.argv.includes("--alles");

  const { PrismaClient } = require("../src/generated/prisma/client.js");
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
  const { DIETS, DIET_HINTS, normalizeDiets, packDiets } = await import(
    new URL("../src/lib/recipe/categories.ts", import.meta.url).href
  );

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ontbreekt.");
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

  try {
    const rijen = await prisma.recipe.findMany({
      where: alles ? {} : { diets: "" },
      select: { id: true, title: true, tags: true, data: true },
      orderBy: { title: "asc" },
    });

    if (rijen.length === 0) {
      console.log("\n  Niets te doen: overal staat al een dieet ingevuld.\n");
      return;
    }

    console.log(`\n  ${rijen.length} recepten zonder dieet.\n`);

    /** id → lijst kenmerken. Alleen wat we echt gaan wegschrijven. */
    const uitkomst = new Map();

    // Ronde 1: wat als tag is blijven staan.
    const rest = [];
    for (const rij of rijen) {
      const losseTags = (rij.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
      const uitTags = normalizeDiets(losseTags);
      if (uitTags.length > 0) {
        // De tag verhuist en blijft niet óók staan. Anders staat het kenmerk
        // twee keer in de collectie — één keer als kolom, één keer als vrije
        // tag — en dan exporteert `npm run export` er ook twee hekjes van.
        const blijft = losseTags.filter((tag) => normalizeDiets([tag]).length === 0);
        uitkomst.set(rij.id, {
          diets: uitTags,
          bron: "tags",
          tags: blijft.length === losseTags.length ? null : blijft.join(","),
        });
      } else {
        rest.push(rij);
      }
    }
    console.log(`  ${uitkomst.size} uit de bestaande tags.`);

    // Ronde 2: de rest langs het model.
    if (rest.length > 0) {
      const groepen = Math.ceil(rest.length / GROEP);
      console.log(`  ${rest.length} langs het model, in ${groepen} ${groepen === 1 ? "aanroep" : "aanroepen"}.\n`);

      const client = maakClient();
      for (let i = 0; i < rest.length; i += GROEP) {
        const groep = rest.slice(i, i + GROEP);
        process.stdout.write(`  groep ${Math.floor(i / GROEP) + 1}/${groepen} … `);
        try {
          const antwoord = await beoordeel(client, groep, { DIETS, DIET_HINTS });
          for (const rij of groep) {
            const gevonden = normalizeDiets(antwoord.get(rij.id) ?? []);
            if (gevonden.length > 0) uitkomst.set(rij.id, { diets: gevonden, bron: "model" });
          }
          console.log("klaar");
        } catch (fout) {
          // Eén mislukte groep mag de rest niet meeslepen: wat wel lukte staat
          // straks in de database, en je kunt het script gewoon nog eens
          // draaien voor wat overblijft.
          console.log(`mislukt — ${fout.message}`);
        }
      }
      console.log("");
    }

    const titels = new Map(rijen.map((rij) => [rij.id, rij.title]));
    for (const [id, { diets, bron }] of uitkomst) {
      console.log(`  ${titels.get(id)} → ${diets.join(", ")} (${bron})`);
    }

    if (droog) {
      console.log(`\n  Droge run: er is niets weggeschreven. ${uitkomst.size} zouden er een dieet krijgen.\n`);
      return;
    }

    for (const [id, { diets, tags }] of uitkomst) {
      await prisma.recipe.update({
        where: { id },
        // `tags` alleen meesturen als er werkelijk iets af ging; anders raakt
        // een recept dat via het model een dieet kreeg zijn tags kwijt.
        data: { diets: packDiets(diets), ...(tags === null || tags === undefined ? {} : { tags }) },
      });
    }
    console.log(`\n  ${uitkomst.size} recepten bijgewerkt. ${rijen.length - uitkomst.size} bleven leeg.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

function maakClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY ontbreekt — zonder sleutel kan alleen de tag-ronde.");
  }
  const Anthropic = require("@anthropic-ai/sdk").default ?? require("@anthropic-ai/sdk");
  return new Anthropic();
}

/**
 * Eén groep recepten langs het model.
 *
 * Alleen de titel en de ingrediëntnamen gaan mee — hoeveelheden en stappen
 * zeggen niets over het dieet en maken de aanroep alleen duurder. Het antwoord
 * komt via structured outputs terug, zodat de vorm al tijdens het genereren
 * vastligt.
 */
async function beoordeel(client, groep, { DIETS, DIET_HINTS }) {
  const regels = groep.map((rij) => {
    let namen = [];
    try {
      const recept = JSON.parse(rij.data);
      namen = (recept.ingredientGroups ?? []).flatMap((g) =>
        (g.items ?? []).map((item) => item.name).filter(Boolean),
      );
    } catch {
      // Onleesbare blob: dan moet de titel het doen. Het model laat het dan
      // vrijwel zeker leeg, en dat is de goede uitkomst.
    }
    return `${rij.id}\t${rij.title}\t${namen.join(", ") || "(geen ingrediëntenlijst)"}`;
  });

  const uitleg = DIETS.map((diet) => `- ${diet}: ${DIET_HINTS[diet]}`).join("\n");

  const response = await client.messages.create({
    model: process.env.RECIPE_MODEL ?? "claude-opus-5",
    max_tokens: 4000,
    system: `Je bepaalt per recept welke dieetkenmerken kloppen, uitsluitend op basis van de ingrediëntenlijst.

De kenmerken:
${uitleg}

Regels:
- Meerdere kenmerken per recept mag. Veganistisch impliceert vegetarisch en lactosevrij; noem die er dan bij.
- **Bij de minste twijfel laat je het kenmerk weg.** Een bouillon waarvan niet blijkt of hij van kip is, een kant-en-klare saus, een merknaam, een onvolledige lijst — allemaal reden om niets te beweren.
- Bedenk geen vervangingen. Het gaat om het recept zoals het er staat.
- Geef voor elk aangeleverd id een regel terug, ook als de lijst leeg blijft.`,
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["recepten"],
          properties: {
            recepten: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "diets"],
                properties: {
                  id: { type: "string" },
                  diets: { type: "array", items: { type: "string", enum: [...DIETS] } },
                },
              },
            },
          },
        },
      },
    },
    messages: [
      {
        role: "user",
        content: `Per regel: id, titel en ingrediënten, gescheiden door tabs.\n\n${regels.join("\n")}`,
      },
    ],
  });

  const blok = response.content.find((b) => b.type === "text");
  if (!blok) throw new Error("het model gaf geen tekstantwoord");
  const json = JSON.parse(blok.text);
  return new Map((json.recepten ?? []).map((r) => [r.id, r.diets ?? []]));
}

main().catch((fout) => {
  console.error(`\n  Ging mis: ${fout.message}\n`);
  process.exit(1);
});
