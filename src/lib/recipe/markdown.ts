import { formatAmount } from "./format";
import type { Recipe } from "./schema";

/**
 * Een recept als markdown.
 *
 * Waarom dit bestaat: de back-up is een SQLite-bestand. Prima om terug te
 * zetten, waardeloos om te lézen. Een verzameling waar je alleen via déze app
 * bij kunt is een verzameling die je kwijt kunt raken — als de server omvalt,
 * als je iets anders gaat gebruiken, of gewoon als je op de bank iets wilt
 * opzoeken zonder in te loggen. Markdown is leesbaar in elke teksteditor, gaat
 * zo in Notities of Obsidian, en print netjes.
 *
 * Bewust géén frontmatter met velden die alleen deze app snapt. Wat erin staat
 * moet iemand kunnen lezen die nog nooit van dit programma heeft gehoord.
 *
 * Pure functie: geen database, geen bestandssysteem, geen datum van vandaag.
 * Zo is de opmaak te testen, en dat is de helft van het werk hier — een export
 * die stilletjes de helft weglaat is erger dan geen export.
 */

/** Wat er in de database omheen staat en niet in de recept-JSON zelf. */
export type Omslag = {
  sourceUrl?: string | null;
  sourceName?: string | null;
  /** Komma-gescheiden, zoals de kolom. */
  tags?: string | null;
  cuisine?: string | null;
  /** Wanneer het in de collectie kwam. */
  createdAt?: Date | null;
  /** De keren dat het gemaakt is, met wat jullie ervan vonden. */
  gemaakt?: Array<{
    cookedAt: Date;
    rating: number | null;
    note: string | null;
    again: boolean | null;
    who: string | null;
  }>;
};

export function receptNaarMarkdown(recept: Recipe, omslag: Omslag = {}): string {
  const regels: string[] = [`# ${recept.title}`, ""];

  if (recept.description) regels.push(recept.description, "");

  const feiten = [
    recept.servings !== null && `${recept.servings} ${recept.servings === 1 ? "portie" : "porties"}`,
    recept.prepMinutes !== null && `${recept.prepMinutes} min voorbereiden`,
    recept.cookMinutes !== null && `${recept.cookMinutes} min bereiden`,
    recept.totalMinutes !== null && `${recept.totalMinutes} min totaal`,
  ].filter((x): x is string => Boolean(x));
  if (feiten.length > 0) regels.push(`*${feiten.join(" · ")}*`, "");

  regels.push("## Ingrediënten", "");
  for (const groep of recept.ingredientGroups) {
    if (groep.name) regels.push(`### ${groep.name}`, "");
    for (const item of groep.items) {
      const maat = formatAmount(item);
      const notitie = item.note ? `, ${item.note}` : "";
      regels.push(`- ${maat ? `${maat} ` : ""}${item.name}${notitie}`);
    }
    regels.push("");
  }

  regels.push("## Bereiding", "");
  recept.steps.forEach((stap, index) => {
    // Genummerd met "1." op elke regel: dat is geldige markdown en het nummer
    // klopt nog steeds als je er later eentje tussenuit haalt. Behalve dat het
    // hier ook echt uitgeschreven staat, want dit wordt vooral gelézen.
    const kop = stap.title ? `**${stap.title}.** ` : "";
    const tijd = stap.timerMinutes !== null ? ` *(${stap.timerMinutes} min)*` : "";
    regels.push(`${index + 1}. ${kop}${stap.text}${tijd}`);
    if (stap.tip) regels.push(`   > ${stap.tip}`);
  });
  regels.push("");

  if (recept.tips.length > 0) {
    regels.push("## Tips", "");
    for (const tip of recept.tips) regels.push(`- ${tip}`);
    regels.push("");
  }

  const log = omslag.gemaakt ?? [];
  if (log.length > 0) {
    regels.push("## Gemaakt", "");
    for (const keer of log) {
      const delen = [
        datum(keer.cookedAt),
        keer.who,
        keer.rating !== null ? "★".repeat(keer.rating) + "☆".repeat(5 - keer.rating) : null,
        keer.again === true ? "vaker eten" : keer.again === false ? "eenmalig" : null,
      ].filter((x): x is string => Boolean(x));
      regels.push(`- ${delen.join(" · ")}${keer.note ? ` — ${keer.note}` : ""}`);
    }
    regels.push("");
  }

  // De herkomst onderaan, achter een streep: het hoort bij het recept maar het
  // is niet waarom je het openslaat.
  const voet: string[] = [];
  const etiketten = [
    omslag.cuisine,
    ...(omslag.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
  ].filter((x): x is string => Boolean(x));
  if (etiketten.length > 0) voet.push(etiketten.map((t) => `#${slug(t)}`).join(" "));
  if (omslag.sourceUrl) {
    voet.push(`Bron: [${omslag.sourceName || omslag.sourceUrl}](${omslag.sourceUrl})`);
  }
  if (omslag.createdAt) voet.push(`Opgeslagen op ${datum(omslag.createdAt)}`);
  if (voet.length > 0) regels.push("---", "", ...voet.map((r) => `${r}  `));

  // Precies één afsluitende regeleinde, hoeveel lege regels er onderweg ook
  // ontstonden. Anders verschilt elk bestand en ruist een diff vol.
  return `${regels.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

function datum(waarde: Date): string {
  return waarde.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Een bestandsnaam die op elk besturingssysteem mag, en die je in een lijst
 * nog herkent. Accenten eraf, want een map met `soufflé.md` naast `souffle.md`
 * is op macOS hetzelfde bestand en op Linux niet.
 */
export function bestandsnaam(titel: string, id: string): string {
  const kern = slug(titel);
  // Zonder bruikbare titel valt er niets te herkennen; dan maar het id.
  return kern ? `${kern}.md` : `recept-${id}.md`;
}

function slug(tekst: string): string {
  return tekst
    .normalize("NFD")
    // De losgemaakte accenttekens; als codepunt geschreven, want als los teken
    // in de broncode zijn ze onzichtbaar en sneuvelen ze bij het kopiëren.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
