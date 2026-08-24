import Link from "next/link";
import { ViewTransition } from "react";
import { Stars } from "@/components/CookLog";
import { Icon } from "@/components/Icon";
import { SearchBox } from "@/components/SearchBox";
import { Vastkop } from "@/components/Vastkop";
import { prisma } from "@/lib/db";
import { icons } from "@/lib/icons";
import {
  DIETS,
  DIET_LABELS,
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  normalizeDiet,
  normalizeMealType,
  unpackDiets,
  unpackMealTypes,
  type Diet,
  type MealType,
} from "@/lib/recipe/categories";
import {
  buildHaystack,
  compareHits,
  parseQuery,
  score,
  type Hit,
} from "@/lib/recipe/search";
import { voorkeuren } from "@/lib/settings";
import { beoordeelRecept, iemandZwanger, type Niveau } from "@/lib/zwanger";

export const dynamic = "force-dynamic";

// Geen eigen titel: de thuispagina draagt gewoon de naam van de app, en die
// staat als standaard in de hoofdopmaak.

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const mealFilter = readMealFilter(query.maaltijd);
  const cuisineFilter = readOne(query.keuken);
  const dietFilter = readDietFilter(query.dieet);
  const rawQuery = readOne(query.q) ?? "";
  const terms = parseQuery(rawQuery);

  const rows = await prisma.recipe.findMany({
    // Keuken is één waarde, dus die filtert exact in SQL. Maaltijdmomenten
    // staan komma-gescheiden in één kolom; `contains` narrowt, waarna we
    // hieronder op hele waarden filteren zodat een deelwoord nooit meetelt.
    where: {
      ...(cuisineFilter ? { cuisine: cuisineFilter } : {}),
      ...(mealFilter ? { mealTypes: { contains: mealFilter } } : {}),
      ...(dietFilter ? { diets: { contains: dietFilter } } : {}),
    },
    orderBy: [{ favorite: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  // `contains` narrowt alleen; hier vallen de deelwoorden af. "vegetarisch"
  // zit in geen enkele andere waarde, maar "notenvrij" wel in niets en
  // "glutenvrij" ook niet — toch dezelfde controle als bij de momenten, want
  // een woordenlijst groeit en dan is dit het gat.
  const filtered = rows.filter(
    (recipe) =>
      (!mealFilter || unpackMealTypes(recipe.mealTypes).includes(mealFilter)) &&
      (!dietFilter || unpackDiets(recipe.diets).includes(dietFilter)),
  );

  // Zoeken gebeurt in het geheugen: de ingrediënten zitten in de JSON-blob, en
  // bij deze aantallen is alles doorlopen sneller dan een index die kan
  // verouderen. Zonder zoekterm wordt hier niets gedaan.
  const scored =
    terms.length === 0
      ? filtered.map((recipe) => ({ recipe, hit: null as Hit | null }))
      : filtered
          .map((recipe) => ({ recipe, hit: score(buildHaystack(recipe), terms) }))
          .filter((entry): entry is { recipe: (typeof filtered)[number]; hit: Hit } =>
            entry.hit !== null,
          )
          .sort((a, b) =>
            compareHits(
              { hit: a.hit, favorite: a.recipe.favorite, createdAt: a.recipe.createdAt },
              { hit: b.hit, favorite: b.recipe.favorite, createdAt: b.recipe.createdAt },
            ),
          );

  // Alles-of-niets: recepten die al je termen afdekken staan boven de streep,
  // de rest eronder met wat je nog mist. Dat is precies wat je wilt weten als
  // je in de koelkast hebt gekeken.
  const complete = scored.filter((entry) => (entry.hit?.matched ?? 0) === terms.length);
  const partial = scored.filter((entry) => (entry.hit?.matched ?? 0) < terms.length);

  const [usedMealTypes, usedCuisines, usedDiets, ratings, wensen] = await Promise.all([
    collectMealTypes(),
    collectCuisines(),
    collectDiets(),
    collectRatings(),
    voorkeuren(),
  ]);

  // Staat het zwangerschapsvinkje aan, dan hoort een tegel het al te verraden —
  // anders klik je een gerecht open dat toch niet kan. Alleen het zwaarste
  // niveau per recept; de uitleg staat op de receptpagina zelf.
  const zwangerAan = iemandZwanger(wensen).length > 0;
  const zwangerPer = new Map<string, Niveau>();
  if (zwangerAan) {
    for (const recipe of filtered) {
      const zwaarste = beoordeelRecept(buildHaystack(recipe).ingredientNamen).zwaarste;
      // Alleen rood en oranje op een tegel. Een groen vlaggetje op de helft van
      // de collectie zegt niets en maakt de andere helft juist minder zichtbaar.
      if (zwaarste === "onveilig" || zwaarste === "pasop") {
        zwangerPer.set(recipe.id, zwaarste);
      }
    }
  }

  const href = (next: {
    maaltijd?: MealType | null;
    keuken?: string | null;
    dieet?: Diet | null;
  }) => {
    const params = new URLSearchParams();
    const meal = next.maaltijd === undefined ? mealFilter : next.maaltijd;
    const cuisine = next.keuken === undefined ? cuisineFilter : next.keuken;
    const diet = next.dieet === undefined ? dietFilter : next.dieet;
    if (meal) params.set("maaltijd", meal);
    if (cuisine) params.set("keuken", cuisine);
    if (diet) params.set("dieet", diet);
    if (rawQuery) params.set("q", rawQuery);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };

  const filtering =
    mealFilter !== null || cuisineFilter !== null || dietFilter !== null;

  // De weg terug hoort in de éérste rail die er werkelijk staat, niet vast aan
  // de maaltijdrail. Een collectie zonder maaltijdsoorten maar mét dieetlabels
  // — precies wat `npm run dieet` van een oudere verzameling maakt — kon anders
  // wel op dieet filteren, maar had geen "Alles" om het weer los te laten.
  const alles = filtering ? (
    <Link
      href={href({ maaltijd: null, keuken: null, dieet: null })}
      className="chip ghost"
    >
      Alles
    </Link>
  ) : null;

  const eersteRail =
    usedMealTypes.length > 0
      ? "maaltijd"
      : usedDiets.length > 0
        ? "dieet"
        : usedCuisines.length > 0
          ? "keuken"
          : null;

  return (
    <main>
      <div className="page-head">
        <h1>Recepten</h1>
        {/* Zoeken gebeurt tijdens het typen: de lijst eronder verandert zonder
            dat er iets voorgelezen wordt. Deze regel telt mee hoeveel er
            overblijft, dus als leesgebied vertelt hij precies wat er gebeurde.
            Beleefd, zodat hij wacht tot je uitgetypt bent. */}
        <p role="status">{summary(scored.length, terms.length, filtering)}</p>
      </div>
      <Vastkop titel="Recepten" />

      <SearchBox initial={rawQuery} />

      {/* Filtert er iets terwijl er geen enkele rail staat — een dieet uit de
          URL dat geen enkel recept heeft — dan is dit de enige uitweg. */}
      {eersteRail === null && alles && <div className="rail">{alles}</div>}

      {usedMealTypes.length > 0 && (
        <div className="rail">
          {eersteRail === "maaltijd" && alles}
          {usedMealTypes.map((type) => (
            <Link
              key={type}
              href={href({ maaltijd: mealFilter === type ? null : type })}
              className={`chip ${mealFilter === type ? "on" : ""}`}
            >
              {MEAL_TYPE_LABELS[type]}
            </Link>
          ))}
        </div>
      )}

      {usedDiets.length > 0 && (
        <div className="rail">
          {eersteRail === "dieet" && alles}
          {usedDiets.map((diet) => (
            <Link
              key={diet}
              href={href({ dieet: dietFilter === diet ? null : diet })}
              className={`chip ${dietFilter === diet ? "on" : ""}`}
            >
              {DIET_LABELS[diet]}
            </Link>
          ))}
        </div>
      )}

      {usedCuisines.length > 0 && (
        <div className="rail">
          {eersteRail === "keuken" && alles}
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

      {scored.length === 0 ? (
        <div className="empty">
          {terms.length > 0 ? (
            <>
              <p>Niets gevonden voor &ldquo;{rawQuery}&rdquo;.</p>
              <p>
                Zoek op een ingrediënt, een gerecht of een keuken. Meerdere
                woorden mag: dan zie je bovenaan wat ze allemaal gebruikt.
              </p>
            </>
          ) : filtering ? (
            <>
              <p>Niks in deze categorie.</p>
              <p>
                <Link href="/">Toon alles</Link>
              </p>
            </>
          ) : (
            <>
              <p>Nog geen recepten.</p>
              <p>
                Deel een link vanuit Instagram, de AH-app of Safari, of{" "}
                <Link href="/inbox">voeg er handmatig een toe</Link>.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <Grid entries={complete} terms={terms.length} ratings={ratings} zwangerPer={zwangerPer} />

          {partial.length > 0 && (
            <>
              <h2 className="section near">Bijna</h2>
              <Grid entries={partial} terms={terms.length} ratings={ratings} zwangerPer={zwangerPer} />
            </>
          )}
        </>
      )}
    </main>
  );
}

type Entry = {
  recipe: {
    id: string;
    title: string;
    imageUrl: string | null;
    favorite: boolean;
    totalMinutes: number | null;
    cuisine: string | null;
    mealTypes: string;
  };
  hit: Hit | null;
};

function Grid({
  entries,
  terms,
  ratings,
  zwangerPer,
}: {
  entries: Entry[];
  terms: number;
  ratings: Map<string, number>;
  zwangerPer: Map<string, Niveau>;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="grid">
      {entries.map(({ recipe, hit }) => {
        const mealTypes = unpackMealTypes(recipe.mealTypes);
        const sub = [recipe.cuisine, ...mealTypes.map((t) => MEAL_TYPE_LABELS[t])]
          .filter(Boolean)
          .join(" · ");
        const rating = ratings.get(recipe.id);

        return (
          <Link key={recipe.id} href={`/recepten/${recipe.id}`} className="tile">
            {/* Dezelfde naam als de foto bovenaan de receptpagina. De browser
                herkent daaraan dat het één ding is en laat het vlak van hier
                naar daar groeien, in plaats van het ene te laten verdwijnen en
                het andere te laten opkomen. Zo zie je waar je vandaan kwam.
                Zonder ondersteuning gebeurt er niets bijzonders. */}
            <ViewTransition name={`foto-${recipe.id}`} share="morph" default="none">
              <div className={`thumb ${recipe.imageUrl ? "" : "blank"}`}>
                {recipe.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={recipe.imageUrl} alt="" loading="lazy" />
                ) : (
                  <Icon icon={icons.plate} size={34} strokeWidth={1.2} />
                )}
                {recipe.favorite && (
                  <span className="fav" title="Favoriet">
                    <Icon icon={icons.favorite} size={14} />
                    {/* Het icoon is voor een schermlezer lucht, en `title` op
                        een span wordt lang niet altijd voorgelezen. Zonder deze
                        regel is er geen enkele manier om te horen dat dit een
                        favoriet is. */}
                    <span className="sr">Favoriet</span>
                  </span>
                )}
                {recipe.totalMinutes && (
                  <span className="clock">
                    <Icon icon={icons.clock} size={13} />
                    {recipe.totalMinutes} min
                  </span>
                )}
                {zwangerPer.get(recipe.id) && (
                  <span className={`zw-tegel ${zwangerPer.get(recipe.id)}`}>
                    {zwangerPer.get(recipe.id) === "onveilig" ? "Niet eten" : "Pas op"}
                    <span className="sr"> tijdens de zwangerschap</span>
                  </span>
                )}
              </div>
            </ViewTransition>
            <div className="tile-body">
              <h2>{recipe.title}</h2>

              {/* Bij zoeken op meerdere dingen is "wat mis ik nog" de vraag. */}
              {hit && terms > 1 && hit.missing.length > 0 ? (
                <p className="sub missing">mist {hit.missing.join(", ")}</p>
              ) : hit && hit.inIngredients.length > 0 ? (
                <p className="sub found">met {hit.inIngredients.join(", ")}</p>
              ) : rating !== undefined ? (
                // Met sterren erbij past de hele opsomming niet meer op één
                // regel, en dan begint de tweede met een losse punt. De keuken
                // is genoeg: de maaltijdmomenten staan al als filter bovenaan.
                <p className="sub">
                  <Stars value={Math.round(rating)} size={12} />
                  {recipe.cuisine && <span className="muted"> {recipe.cuisine}</span>}
                </p>
              ) : (
                sub && <p className="sub">{sub}</p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function summary(found: number, terms: number, filtering: boolean): string {
  const noun = found === 1 ? "recept" : "recepten";
  if (terms > 0) return `${found} ${noun} gevonden`;
  return `${found} ${noun}${filtering ? " in deze selectie" : ""}`;
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

function readDietFilter(value: string | string[] | undefined): Diet | null {
  const raw = readOne(value);
  return raw ? normalizeDiet(raw) : null;
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

/**
 * Welke dieetkenmerken ergens voorkomen.
 *
 * Alleen tonen wat er is: een filterrij met vijf knoppen waarvan er vier niets
 * opleveren, is een rij die je leert negeren.
 */
async function collectDiets(): Promise<Diet[]> {
  const rows = await prisma.recipe.findMany({
    select: { diets: true },
    where: { NOT: { diets: "" } },
  });
  const found = new Set<Diet>();
  for (const row of rows) {
    for (const diet of unpackDiets(row.diets)) found.add(diet);
  }
  return DIETS.filter((diet) => found.has(diet));
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

/**
 * Het gemiddelde oordeel per recept, voor de tegels.
 *
 * Eén groepering in plaats van een teller per recept: het overzicht mag geen
 * vraag per tegel stellen.
 */
async function collectRatings(): Promise<Map<string, number>> {
  const rows = await prisma.cookLog.groupBy({
    by: ["recipeId"],
    where: { NOT: { rating: null } },
    _avg: { rating: true },
  });
  return new Map(
    rows
      .filter((row) => row._avg.rating !== null)
      .map((row) => [row.recipeId, row._avg.rating as number]),
  );
}
