import Link from "next/link";
import { addToMenu, clearWeek, removeFromMenu, setMenuServings } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { prisma } from "@/lib/db";
import { icons } from "@/lib/icons";
import {
  addDays,
  dayLabel,
  fromParam,
  isToday,
  startOfWeek,
  toParam,
  weekDays,
  weekLabel,
  weekRange,
} from "@/lib/menu/week";
import { suggest } from "@/lib/menu/suggest";
import { MAX_SERVINGS, MIN_SERVINGS } from "@/lib/recipe/scale";

export const dynamic = "force-dynamic";

export default async function WeekMenuPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const monday = startOfWeek(fromParam(query.week));
  const days = weekDays(monday);

  // Kwam je hier vanaf een recept, dan staat dat recept "in de hand" en kies
  // je alleen nog de dag. Dat scheelt een tussenscherm.
  const holdingId = readOne(query.kies);
  const holdingServings = readOne(query.porties);
  const holding = holdingId
    ? await prisma.recipe.findUnique({
        where: { id: holdingId },
        select: { id: true, title: true },
      })
    : null;

  const entries = await prisma.menuEntry.findMany({
    where: { date: weekRange(monday) },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: {
      recipe: { select: { id: true, title: true, servings: true, cuisine: true } },
    },
  });

  const byDay = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = toParam(entry.date);
    const list = byDay.get(key);
    if (list) list.push(entry);
    else byDay.set(key, [entry]);
  }

  const weekParam = toParam(monday);
  const previous = toParam(addDays(monday, -7));
  const next = toParam(addDays(monday, 7));
  const keep = (target: string) =>
    holding
      ? `/weekmenu?week=${target}&kies=${holding.id}${holdingServings ? `&porties=${holdingServings}` : ""}`
      : `/weekmenu?week=${target}`;

  return (
    <main>
      <div className="page-head">
        <h1>Weekmenu</h1>
        <p>
          {entries.length === 0
            ? "Nog niets gepland deze week."
            : `${entries.length} ${entries.length === 1 ? "gerecht" : "gerechten"} gepland`}
        </p>
      </div>

      <div className="weeknav">
        <Link href={keep(previous)} aria-label="Vorige week">
          <Icon icon={icons.back} size={18} />
        </Link>
        <strong>{weekLabel(monday)}</strong>
        <Link href={keep(next)} aria-label="Volgende week">
          <Icon icon={icons.next} size={18} />
        </Link>
      </div>

      {holding && (
        <p className="notice">
          Kies een dag voor <strong>{holding.title}</strong>.{" "}
          <Link href={`/weekmenu?week=${weekParam}`}>Annuleren</Link>
        </p>
      )}

      <div className="week">
        {days.map((day) => {
          const key = toParam(day);
          const meals = byDay.get(key) ?? [];

          return (
            <section key={key} className={`day ${isToday(day) ? "today" : ""}`}>
              <h2 className="eyebrow">{dayLabel(day)}</h2>

              {meals.map((meal) => {
                const servings = meal.servings ?? meal.recipe.servings;
                return (
                  <div key={meal.id} className="meal">
                    <Link href={`/recepten/${meal.recipe.id}`} className="meal-title">
                      {meal.recipe.title}
                    </Link>

                    <div className="meal-side">
                      {servings !== null && (
                        <div className="stepper">
                          {/* Formulieren in plaats van links: het is een
                              wijziging, geen navigatie. */}
                          <form action={setMenuServings}>
                            <input type="hidden" name="id" value={meal.id} />
                            <input
                              type="hidden"
                              name="porties"
                              value={Math.max(MIN_SERVINGS, servings - 1)}
                            />
                            <button type="submit" className="quiet" aria-label="Eén persoon minder">
                              <Icon icon={icons.minus} size={14} />
                            </button>
                          </form>
                          <strong>{servings}</strong>
                          <form action={setMenuServings}>
                            <input type="hidden" name="id" value={meal.id} />
                            <input
                              type="hidden"
                              name="porties"
                              value={Math.min(MAX_SERVINGS, servings + 1)}
                            />
                            <button type="submit" className="quiet" aria-label="Eén persoon meer">
                              <Icon icon={icons.plus} size={14} />
                            </button>
                          </form>
                        </div>
                      )}
                      <form action={removeFromMenu}>
                        <input type="hidden" name="id" value={meal.id} />
                        <button type="submit" className="quiet" aria-label="Van het menu halen">
                          <Icon icon={icons.close} size={15} />
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}

              {holding ? (
                <form action={addToMenu}>
                  <input type="hidden" name="recipeId" value={holding.id} />
                  <input type="hidden" name="dag" value={key} />
                  {holdingServings && (
                    <input type="hidden" name="porties" value={holdingServings} />
                  )}
                  <button type="submit" className="secondary add-day">
                    <Icon icon={icons.plus} size={15} />
                    Hier
                  </button>
                </form>
              ) : (
                <Link href={`/weekmenu/kies?dag=${key}`} className="add-day">
                  <Icon icon={icons.plus} size={15} />
                  Gerecht
                </Link>
              )}
            </section>
          );
        })}
      </div>

      <Voorstellen
        gepland={entries.map((e) => ({ id: e.recipe.id, cuisine: e.recipe.cuisine }))}
        week={weekParam}
      />

      {entries.length > 0 && (
        <div className="row week-actions">
          <Link href={`/weekmenu/boodschappen?week=${weekParam}`} className="button">
            <Icon icon={icons.basket} size={18} />
            Boodschappenlijst
          </Link>
          <form action={clearWeek}>
            <input type="hidden" name="week" value={weekParam} />
            <button type="submit" className="quiet">
              Week leegmaken
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

/**
 * Wat zullen we eten?
 *
 * Alleen als er iets te suggereren valt: zonder kooklog en zonder recepten is
 * dit een leeg vak met een belofte. De reden staat erbij — een voorstel zonder
 * uitleg is een gokautomaat, en die vertrouw je na twee keer niet meer.
 */
async function Voorstellen({
  gepland,
  week,
}: {
  gepland: Array<{ id: string; cuisine: string | null }>;
  week: string;
}) {
  const rows = await prisma.recipe.findMany({
    select: {
      id: true,
      title: true,
      cuisine: true,
      favorite: true,
      createdAt: true,
      cookLogs: { select: { cookedAt: true, rating: true, again: true } },
    },
    take: 500,
  });

  const voorstellen = suggest(
    rows.map((row) => ({
      id: row.id,
      title: row.title,
      cuisine: row.cuisine,
      favorite: row.favorite,
      createdAt: row.createdAt,
      cookedAt: row.cookLogs.map((log) => log.cookedAt),
      ratings: row.cookLogs
        .map((log) => log.rating)
        .filter((rating): rating is number => rating !== null),
      again: {
        yes: row.cookLogs.filter((log) => log.again === true).length,
        no: row.cookLogs.filter((log) => log.again === false).length,
      },
    })),
    { gepland, vandaag: new Date() },
  );

  if (voorstellen.length === 0) return null;

  return (
    <section className="voorstellen">
      <h2 className="section">Misschien iets?</h2>
      <ul>
        {voorstellen.map((voorstel) => (
          <li key={voorstel.id}>
            <Link href={`/recepten/${voorstel.id}`} className="voorstel-titel">
              {voorstel.title}
            </Link>
            <span className="voorstel-reden">{voorstel.reason}</span>
            <Link
              href={`/weekmenu?week=${week}&kies=${voorstel.id}`}
              className="chip"
              aria-label={`${voorstel.title} inplannen`}
            >
              Inplannen
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function readOne(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  const clean = first?.trim();
  return clean ? clean : null;
}
