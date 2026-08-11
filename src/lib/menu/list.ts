import { prisma } from "@/lib/db";
import { huishouden } from "@/lib/settings";
import { scaleRecipe } from "@/lib/recipe/scale";
import { flattenIngredients, recipeSchema } from "@/lib/recipe/schema";
import { AISLE_LABELS, aisleFor, aisleOrder, type Aisle } from "@/lib/shopping/aisles";
import { addAmounts, amountKey, canonicalName, formatAmount } from "@/lib/shopping/units";
import { weekLabel, weekRange } from "./week";

/**
 * Alle ingrediënten van een week bij elkaar optellen.
 *
 * Dit is waar de app iets kan wat een losse boodschappen-app niet kan: de
 * ingrediënten staan als losse velden opgeslagen, dus drie recepten die uien
 * willen worden één regel met het juiste aantal. En als je op woensdag voor
 * zes kookt, telt die woensdag ook voor zes mee.
 *
 * Er wordt niets opgeslagen: de lijst is een afgeleide van je weekmenu en
 * wordt bij elke weergave opnieuw berekend. Eén ding minder dat kan verouderen.
 */

export type Line = {
  name: string;
  amount: string;
  /** Uit welke gerechten dit komt, voor als je je afvraagt waarvoor iets is. */
  from: string[];
};

export type Group = { aisle: Aisle; label: string; lines: Line[] };

export type WeekList = {
  groups: Group[];
  count: number;
  meals: number;
};

export async function weekShoppingList(monday: Date): Promise<WeekList> {
  // Oudere regels hebben geen aantal; die tellen mee voor het huishouden.
  const standaard = await huishouden();

  const entries = await prisma.menuEntry.findMany({
    where: { date: weekRange(monday) },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: { recipe: true },
  });

  // Sleutel is naam + optelbare eenheid: 200 g bloem en 2 el bloem blijven
  // twee regels, want in de winkel zijn dat ook twee dingen.
  type Bucket = {
    name: string;
    aisle: Aisle;
    quantity: number | null;
    unit: string | null;
    from: Set<string>;
  };
  const buckets = new Map<string, Bucket>();

  for (const entry of entries) {
    const parsed = recipeSchema.safeParse(JSON.parse(entry.recipe.data));
    if (!parsed.success) continue;

    const servings = entry.servings ?? standaard;
    const recipe =
      servings === null || servings === parsed.data.servings
        ? parsed.data
        : scaleRecipe(parsed.data, servings);

    for (const item of flattenIngredients(recipe)) {
      const name = item.name.trim();
      if (!name) continue;

      const key = canonicalName(name);
      const amount = { quantity: item.quantity, unit: item.unit };
      const bucketKey = `${key}|${amountKey(amount)}`;

      const existing = buckets.get(bucketKey);
      if (existing) {
        const total = addAmounts(
          { quantity: existing.quantity, unit: existing.unit },
          amount,
        );
        existing.quantity = total.quantity;
        existing.unit = total.unit;
        existing.from.add(entry.recipe.title);
      } else {
        buckets.set(bucketKey, {
          name,
          aisle: aisleFor(key),
          quantity: item.quantity,
          unit: item.unit,
          from: new Set([entry.recipe.title]),
        });
      }
    }
  }

  const byAisle = new Map<Aisle, Line[]>();
  for (const bucket of buckets.values()) {
    const line: Line = {
      name: bucket.name,
      amount: formatAmount({ quantity: bucket.quantity, unit: bucket.unit }),
      from: [...bucket.from],
    };
    const list = byAisle.get(bucket.aisle);
    if (list) list.push(line);
    else byAisle.set(bucket.aisle, [line]);
  }

  const groups = aisleOrder()
    .filter((aisle) => byAisle.has(aisle))
    .map((aisle) => ({
      aisle,
      label: AISLE_LABELS[aisle],
      lines: (byAisle.get(aisle) ?? []).sort((a, b) => a.name.localeCompare(b.name, "nl")),
    }));

  return { groups, count: buckets.size, meals: entries.length };
}

/**
 * De lijst als tekst, om te plakken in de app van de supermarkt.
 *
 * Twee smaken, want ze gaan naar verschillende plekken. Zonder kopjes is één
 * regel per product — dat is wat een boodschappen-app aankan als je plakt.
 * Mét kopjes leest prettiger in een appje naar je vriendin.
 */
export function asText(
  list: WeekList,
  monday: Date,
  options: { headings: boolean },
): string {
  if (!options.headings) {
    return list.groups
      .flatMap((group) => group.lines.map(line))
      .join("\n");
  }

  const header = `Boodschappen ${weekLabel(monday)}`;
  const body = list.groups
    .map((group) => `${group.label}\n${group.lines.map((l) => `- ${line(l)}`).join("\n")}`)
    .join("\n\n");
  return `${header}\n\n${body}`;
}

function line(entry: Line): string {
  return entry.amount ? `${entry.amount} ${entry.name}` : entry.name;
}
