import Link from "next/link";
import { addToMenu } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { Vastkop } from "@/components/Vastkop";
import { prisma } from "@/lib/db";
import { icons } from "@/lib/icons";
import { dayLabel, fromParam, startOfWeek, toParam } from "@/lib/menu/week";
import { MEAL_TYPE_LABELS, unpackMealTypes } from "@/lib/recipe/categories";

export const dynamic = "force-dynamic";

export const metadata = { title: "Gerecht kiezen" };

/** Welk gerecht zet je op deze dag. Hetzelfde raster als het overzicht. */
export default async function PickPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const raw = Array.isArray(query.dag) ? query.dag[0] : query.dag;
  const day = fromParam(raw);
  const dayParam = toParam(day);

  const recipes = await prisma.recipe.findMany({
    orderBy: [{ favorite: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  return (
    <main>
      <Link href={`/weekmenu?week=${toParam(startOfWeek(day))}`} className="back">
        <Icon icon={icons.back} size={16} />
        Terug naar de week
      </Link>

      <div className="page-head">
        <h1>{dayLabel(day)}</h1>
        <p>Kies wat je die dag maakt.</p>
      </div>
      <Vastkop titel={dayLabel(day)} meta="Kies een gerecht" />

      {recipes.length === 0 ? (
        <div className="empty">
          <p>Nog geen recepten om uit te kiezen.</p>
        </div>
      ) : (
        <div className="grid">
          {recipes.map((recipe) => {
            const mealTypes = unpackMealTypes(recipe.mealTypes);
            const sub = [recipe.cuisine, ...mealTypes.map((t) => MEAL_TYPE_LABELS[t])]
              .filter(Boolean)
              .join(" · ");

            return (
              // Het hele kaartje is de knop: één tik en je bent terug op de week.
              <form action={addToMenu} key={recipe.id} className="tile-form">
                <input type="hidden" name="recipeId" value={recipe.id} />
                <input type="hidden" name="dag" value={dayParam} />
                <button type="submit" className="tile">
                  <span className={`thumb ${recipe.imageUrl ? "" : "blank"}`}>
                    {recipe.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={recipe.imageUrl} alt="" loading="lazy" />
                    ) : (
                      <Icon icon={icons.plate} size={34} strokeWidth={1.2} />
                    )}
                    {recipe.totalMinutes && (
                      <span className="clock">
                        <Icon icon={icons.clock} size={13} />
                        {recipe.totalMinutes} min
                      </span>
                    )}
                  </span>
                  <span className="tile-body">
                    <span className="tile-name">{recipe.title}</span>
                    {sub && <span className="sub">{sub}</span>}
                  </span>
                </button>
              </form>
            );
          })}
        </div>
      )}
    </main>
  );
}
