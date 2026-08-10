import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  normalizeMealType,
  unpackMealTypes,
  type MealType,
} from "@/lib/recipe/categories";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const mealFilter = readMealFilter(query.maaltijd);
  const cuisineFilter = readOne(query.keuken);

  const [allRecipes, openItems] = await Promise.all([
    prisma.recipe.findMany({
      // Keuken is één waarde, dus die filtert exact in SQL. Maaltijdmomenten
      // staan komma-gescheiden in één kolom; `contains` narrowt, waarna we
      // hieronder op hele waarden filteren zodat een deelwoord nooit meetelt.
      where: {
        ...(cuisineFilter ? { cuisine: cuisineFilter } : {}),
        ...(mealFilter ? { mealTypes: { contains: mealFilter } } : {}),
      },
      orderBy: [{ favorite: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.shareItem.count({
      where: { status: { in: ["pending", "processing", "needs_input", "failed"] } },
    }),
  ]);

  const recipes = mealFilter
    ? allRecipes.filter((recipe) =>
        unpackMealTypes(recipe.mealTypes).includes(mealFilter),
      )
    : allRecipes;

  // De filterbalk toont alleen wat er daadwerkelijk in de collectie zit; een
  // knop voor een keuken die je niet hebt is alleen maar ruis.
  const [usedMealTypes, usedCuisines] = await Promise.all([
    collectMealTypes(),
    collectCuisines(),
  ]);

  const href = (next: { maaltijd?: MealType | null; keuken?: string | null }) => {
    const params = new URLSearchParams();
    const meal = next.maaltijd === undefined ? mealFilter : next.maaltijd;
    const cuisine = next.keuken === undefined ? cuisineFilter : next.keuken;
    if (meal) params.set("maaltijd", meal);
    if (cuisine) params.set("keuken", cuisine);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };

  const filtering = mealFilter !== null || cuisineFilter !== null;

  return (
    <main>
      {openItems > 0 && (
        <p className="sans" style={{ marginTop: 0 }}>
          <Link href="/inbox">
            {openItems} {openItems === 1 ? "item wacht" : "items wachten"} in de
            inbox →
          </Link>
        </p>
      )}

      {(usedMealTypes.length > 0 || usedCuisines.length > 0) && (
        <div className="filters sans">
          {usedMealTypes.length > 0 && (
            <div className="filter-row">
              {usedMealTypes.map((type) => (
                <Link
                  key={type}
                  href={href({ maaltijd: mealFilter === type ? null : type })}
                  className={`chip-link ${mealFilter === type ? "on" : ""}`}
                >
                  {MEAL_TYPE_LABELS[type]}
                </Link>
              ))}
            </div>
          )}
          {usedCuisines.length > 0 && (
            <div className="filter-row">
              {usedCuisines.map((cuisine) => (
                <Link
                  key={cuisine}
                  href={href({ keuken: cuisineFilter === cuisine ? null : cuisine })}
                  className={`chip-link ${cuisineFilter === cuisine ? "on" : ""}`}
                >
                  {cuisine}
                </Link>
              ))}
            </div>
          )}
          {filtering && (
            <Link href="/" className="clear-filter">
              Filter wissen
            </Link>
          )}
        </div>
      )}

      {recipes.length === 0 ? (
        <div className="empty">
          {filtering ? (
            <>
              <p>Geen recepten in deze categorie.</p>
              <p className="sans">
                <Link href="/">Toon alles</Link>
              </p>
            </>
          ) : (
            <>
              <p>Nog geen recepten.</p>
              <p className="sans">
                Deel een link vanuit Instagram, de AH-app of Safari, of{" "}
                <Link href="/inbox">voeg er handmatig een toe</Link>.
              </p>
            </>
          )}
        </div>
      ) : (
        recipes.map((recipe) => (
          <Link
            key={recipe.id}
            href={`/recepten/${recipe.id}`}
            className="card"
          >
            <h2>
              {recipe.favorite && "★ "}
              {recipe.title}
            </h2>
            {recipe.description && <p>{recipe.description}</p>}
            <div className="meta">
              {recipe.cuisine && <span>{recipe.cuisine}</span>}
              {unpackMealTypes(recipe.mealTypes).length > 0 && (
                <span>
                  {unpackMealTypes(recipe.mealTypes)
                    .map((type) => MEAL_TYPE_LABELS[type])
                    .join(" · ")}
                </span>
              )}
              {recipe.servings && <span>{recipe.servings} personen</span>}
              {recipe.totalMinutes && <span>{recipe.totalMinutes} min</span>}
            </div>
          </Link>
        ))
      )}
    </main>
  );
}

function readOne(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  const clean = first?.trim();
  return clean ? clean : null;
}

function readMealFilter(value: string | string[] | undefined): MealType | null {
  const raw = readOne(value);
  return raw ? normalizeMealType(raw) : null;
}

/** Welke maaltijdmomenten komen ergens in de collectie voor. */
async function collectMealTypes(): Promise<MealType[]> {
  const rows = await prisma.recipe.findMany({
    select: { mealTypes: true },
    where: { NOT: { mealTypes: "" } },
  });
  const found = new Set<MealType>();
  for (const row of rows) {
    for (const type of unpackMealTypes(row.mealTypes)) found.add(type);
  }
  return MEAL_TYPES.filter((type) => found.has(type));
}

async function collectCuisines(): Promise<string[]> {
  const rows = await prisma.recipe.findMany({
    select: { cuisine: true },
    where: { NOT: { cuisine: null } },
    distinct: ["cuisine"],
    orderBy: { cuisine: "asc" },
  });
  return rows
    .map((row) => row.cuisine)
    .filter((cuisine): cuisine is string => cuisine !== null);
}
