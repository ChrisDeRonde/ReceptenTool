import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  MEAL_TYPES,
  MEAL_TYPE_EMOJI,
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

  const allRecipes = await prisma.recipe.findMany({
    // Keuken is één waarde, dus die filtert exact in SQL. Maaltijdmomenten
    // staan komma-gescheiden in één kolom; `contains` narrowt, waarna we
    // hieronder op hele waarden filteren zodat een deelwoord nooit meetelt.
    where: {
      ...(cuisineFilter ? { cuisine: cuisineFilter } : {}),
      ...(mealFilter ? { mealTypes: { contains: mealFilter } } : {}),
    },
    orderBy: [{ favorite: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

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
      <div className="page-head">
        <h1>Wat eten we?</h1>
        <p>
          {recipes.length} {recipes.length === 1 ? "recept" : "recepten"}
          {filtering && " in deze selectie"}
        </p>
      </div>

      {usedMealTypes.length > 0 && (
        <div className="rail">
          {filtering && (
            <Link href="/" className="chip ghost">
              Alles
            </Link>
          )}
          {usedMealTypes.map((type) => (
            <Link
              key={type}
              href={href({ maaltijd: mealFilter === type ? null : type })}
              className={`chip ${mealFilter === type ? "on" : ""}`}
            >
              <span aria-hidden>{MEAL_TYPE_EMOJI[type]}</span>
              {MEAL_TYPE_LABELS[type]}
            </Link>
          ))}
        </div>
      )}

      {usedCuisines.length > 0 && (
        <div className="rail">
          {usedCuisines.map((cuisine) => (
            <Link
              key={cuisine}
              href={href({ keuken: cuisineFilter === cuisine ? null : cuisine })}
              className={`chip ${cuisineFilter === cuisine ? "on" : ""}`}
            >
              {cuisine}
            </Link>
          ))}
        </div>
      )}

      {recipes.length === 0 ? (
        <div className="empty">
          {filtering ? (
            <>
              <span className="big" aria-hidden>
                🤷
              </span>
              <p>Niks in deze categorie.</p>
              <p>
                <Link href="/">Toon alles</Link>
              </p>
            </>
          ) : (
            <>
              <span className="big" aria-hidden>
                🍳
              </span>
              <p>Nog geen recepten.</p>
              <p>
                Deel een link vanuit Instagram, de AH-app of Safari, of{" "}
                <Link href="/inbox">voeg er handmatig een toe</Link>.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid">
          {recipes.map((recipe) => {
            const mealTypes = unpackMealTypes(recipe.mealTypes);
            const sub = [recipe.cuisine, ...mealTypes.map((t) => MEAL_TYPE_LABELS[t])]
              .filter(Boolean)
              .join(" · ");

            return (
              <Link
                key={recipe.id}
                href={`/recepten/${recipe.id}`}
                className="tile"
              >
                <div className={`thumb ${recipe.imageUrl ? "" : "blank"}`}>
                  {recipe.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={recipe.imageUrl} alt="" loading="lazy" />
                  ) : (
                    // Zonder foto geeft de emoji van het maaltijdmoment het
                    // kaartje toch iets herkenbaars.
                    <span aria-hidden>
                      {mealTypes[0] ? MEAL_TYPE_EMOJI[mealTypes[0]] : "🍽️"}
                    </span>
                  )}
                  {recipe.favorite && (
                    <span className="fav" aria-label="Favoriet">
                      ★
                    </span>
                  )}
                  {recipe.totalMinutes && (
                    <span className="clock">{recipe.totalMinutes} min</span>
                  )}
                </div>
                <div className="tile-body">
                  <h2>{recipe.title}</h2>
                  {sub && <p className="sub">{sub}</p>}
                </div>
              </Link>
            );
          })}
        </div>
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
