import { prisma } from "@/lib/db";
import type { Ingredient } from "@/lib/recipe/schema";
import {
  DEFAULT_STORE,
  aisleFor,
  aisleOrder,
  isStore,
  type Aisle,
  type Store,
} from "./aisles";
import { addAmounts, amountKey, canonicalName } from "./units";

/**
 * De boodschappenlijst: wat erop staat, en hoe het erop komt.
 */

const STORE_KEY = "store";

export async function getStore(): Promise<Store> {
  const row = await prisma.setting.findUnique({ where: { key: STORE_KEY } });
  return isStore(row?.value) ? row.value : DEFAULT_STORE;
}

export async function setStore(store: Store): Promise<void> {
  await prisma.setting.upsert({
    where: { key: STORE_KEY },
    create: { key: STORE_KEY, value: store },
    update: { value: store },
  });
}

/**
 * Zet de ingrediënten van een recept op de lijst.
 *
 * Staat er al iets van dezelfde soort in een optelbare eenheid, dan wordt het
 * daarbij opgeteld in plaats van eronder gezet — anders koop je twee keer een
 * halve liter melk. Afgevinkte regels tellen niet mee: die heb je al in huis,
 * en wat je nu toevoegt is voor een ander recept.
 */
export async function addIngredients(
  ingredients: Ingredient[],
  fromRecipe: string,
): Promise<number> {
  const existing = await prisma.shoppingItem.findMany({ where: { checked: false } });

  let added = 0;
  for (const ingredient of ingredients) {
    const name = ingredient.name.trim();
    if (!name) continue;

    const key = canonicalName(name);
    const amount = { quantity: ingredient.quantity, unit: ingredient.unit };

    const match = existing.find(
      (row) =>
        row.key === key &&
        amountKey({ quantity: row.quantity, unit: row.unit }) === amountKey(amount),
    );

    if (match) {
      const total = addAmounts(
        { quantity: match.quantity, unit: match.unit },
        amount,
      );
      await prisma.shoppingItem.update({
        where: { id: match.id },
        data: {
          quantity: total.quantity,
          unit: total.unit,
          // Twee recepten die hetzelfde willen: allebei noemen.
          fromRecipe: mergeSources(match.fromRecipe, fromRecipe),
        },
      });
      match.quantity = total.quantity;
      match.unit = total.unit;
      continue;
    }

    const created = await prisma.shoppingItem.create({
      data: {
        name,
        key,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        // Op de enkelvoudsvorm: "uien" en "ui" horen in hetzelfde schap.
        aisle: aisleFor(key),
        fromRecipe,
      },
    });
    existing.push(created);
    added += 1;
  }

  return added;
}

function mergeSources(current: string | null, addition: string): string {
  const parts = (current ?? "")
    .split(" · ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.includes(addition)) parts.push(addition);
  // Drie bronnen is genoeg informatie; daarna wordt het een lange regel.
  return parts.slice(0, 3).join(" · ");
}

export type ListGroup = {
  aisle: Aisle;
  items: Awaited<ReturnType<typeof prisma.shoppingItem.findMany>>;
};

/** De lijst zoals hij op het scherm komt: per schap, in looproute-volgorde. */
export async function groupedList(store: Store): Promise<ListGroup[]> {
  const items = await prisma.shoppingItem.findMany({
    orderBy: [{ checked: "asc" }, { createdAt: "asc" }],
  });

  const order = aisleOrder(store);
  const byAisle = new Map<Aisle, typeof items>();
  for (const item of items) {
    const aisle = (order.includes(item.aisle as Aisle) ? item.aisle : "overig") as Aisle;
    const bucket = byAisle.get(aisle);
    if (bucket) bucket.push(item);
    else byAisle.set(aisle, [item]);
  }

  return order
    .filter((aisle) => byAisle.has(aisle))
    .map((aisle) => ({ aisle, items: byAisle.get(aisle) ?? [] }));
}
