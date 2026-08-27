import Link from "next/link";
import { ViewTransition } from "react";
import { Cijfer } from "@/components/CookLog";
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
import { addDays, dayLabel, startOfWeek } from "@/lib/menu/week";
import { PAASEI, isPaasei } from "@/lib/paasei";
import {
  leesSortering,
  sorteer,
  SORTERINGEN,
  SORTEER_LABELS,
  type Sortering,
} from "@/lib/recipe/sorteer";
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
  const sortering = leesSortering(query.op);

  const [usedMealTypes, usedCuisines, usedDiets, ratings, wensen, laatst, gepland] =
    await Promise.all([
    collectMealTypes(),
    collectCuisines(),
    collectDiets(),
    collectRatings(),
    voorkeuren(),
    collectLaatstGemaakt(),
    collectGepland(),
  ]);

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
  // Bij zoeken wint de relevantie; zonder zoekterm mag jij bepalen waarop.
  const gesorteerd =
    terms.length === 0
      ? sorteer(filtered, sortering, { cijfers: ratings, laatst })
      : filtered;

  const scored =
    terms.length === 0
      ? gesorteerd.map((recipe) => ({ recipe, hit: null as Hit | null }))
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
    if (sortering !== "vers") params.set("op", sortering);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };

  // De sorteerknoppen houden de filters vast, en andersom.
  const sorteerHref = (op: Sortering) => {
    const params = new URLSearchParams();
    if (mealFilter) params.set("maaltijd", mealFilter);
    if (cuisineFilter) params.set("keuken", cuisineFilter);
    if (dietFilter) params.set("dieet", dietFilter);
    if (rawQuery) params.set("q", rawQuery);
    if (op !== "vers") params.set("op", op);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };

  const actieveFilters = [mealFilter, cuisineFilter, dietFilter].filter(
    (f) => f !== null,
  ).length;
  const filtering = actieveFilters > 0;

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

      {/* De drie rails zaten hiervoor altijd open en duwden op een telefoon het
          eerste recept tot voorbij de helft van het scherm. Nu dicht, tenzij er
          al gefilterd wordt — dan wil je juist zien waarop, en wil je erbij
          kunnen. `details` en geen knop met JavaScript: het moet ook werken als
          er niets draait, en de browser onthoudt de stand niet, wat hier goed
          uitkomt. */}
      <details className="filters" open={filtering}>
        <summary>
          <Icon icon={icons.filter} size={16} />
          <span>Filteren</span>
          {actieveFilters > 0 && <span className="filter-telling">{actieveFilters}</span>}
        </summary>

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

        {/* Sorteren hoort bij filteren: het zijn allebei manieren om de lijst
            naar je hand te zetten, en samen in één uitklap kosten ze niets
            zolang je ze niet nodig hebt. Weg bij zoeken — dan bepaalt de
            relevantie de volgorde en zou een sorteerknop liegen. */}
        {terms.length === 0 && (
          <div className="rail sorteerrail">
            <span className="rail-kop">Sorteren</span>
            {SORTERINGEN.map((op) => (
              <Link
                key={op}
                href={sorteerHref(op)}
                className={`chip ${sortering === op ? "on" : ""}`}
                aria-current={sortering === op ? "true" : undefined}
              >
                {SORTEER_LABELS[op]}
              </Link>
            ))}
          </div>
        )}
      </details>

      {isPaasei(terms) && (
        // Het verstopte recept. Boven de resultaten, niet ervoor in de plaats:
        // wie echt naar iets met "klapper" zocht, vindt dat er gewoon onder.
        <article className="paasei">
          <p className="eyebrow">Uit de la achterin</p>
          <h2>{PAASEI.titel}</h2>
          <p className="paasei-onder">{PAASEI.ondertitel}</p>
          <ul className="paasei-ing">
            {PAASEI.ingredienten.map((regel) => (
              <li key={regel}>{regel}</li>
            ))}
          </ul>
          <ol className="paasei-stappen">
            {PAASEI.stappen.map((stap) => (
              <li key={stap}>{stap}</li>
            ))}
          </ol>
          <p className="paasei-slot">{PAASEI.slot}</p>
        </article>
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
          <Grid entries={complete} terms={terms.length} ratings={ratings} zwangerPer={zwangerPer} gepland={gepland} />

          {partial.length > 0 && (
            <>
              <h2 className="section near">Bijna</h2>
              <Grid entries={partial} terms={terms.length} ratings={ratings} zwangerPer={zwangerPer} gepland={gepland} />
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
  gepland,
}: {
  entries: Entry[];
  terms: number;
  ratings: Map<string, number>;
  zwangerPer: Map<string, Niveau>;
  gepland: Map<string, string>;
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

              {/* Staat het deze week al gepland? De app wist het, maar zei het
                  niet — en dan zet je iets op het menu dat er woensdag al op
                  staat. */}
              {gepland.has(recipe.id) && (
                <p className="tile-gepland">
                  <Icon icon={icons.date} size={12} />
                  {gepland.get(recipe.id)}
                </p>
              )}

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
                  <Cijfer waarde={Math.round(rating * 10) / 10} size={12} />
                  {recipe.cuisine && <span className="muted"> · {recipe.cuisine}</span>}
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

/**
 * Wanneer elk recept voor het laatst gemaakt is.
 *
 * Eén `groupBy` in plaats van de kooklogs bij elk recept ophalen: het overzicht
 * heeft ze verder nergens voor nodig, en bij vijfhonderd recepten scheelt dat
 * een paar duizend rijen per weergave.
 */
async function collectLaatstGemaakt(): Promise<Map<string, Date>> {
  const rows = await prisma.cookLog.groupBy({
    by: ["recipeId"],
    _max: { cookedAt: true },
  });
  return new Map(
    rows
      .filter((row) => row._max.cookedAt !== null)
      .map((row) => [row.recipeId, row._max.cookedAt as Date]),
  );
}

/**
 * Wat er deze week al op het menu staat, met de dag erbij.
 *
 * Alleen déze week: dat een gerecht in maart een keer gepland stond is geen
 * reden om er nu een merkje bij te zetten. Meerdere keren op één week levert de
 * eerste dag op — de vraag is "staat het er al", niet "hoe vaak".
 */
async function collectGepland(): Promise<Map<string, string>> {
  const maandag = startOfWeek(new Date());
  const zondag = addDays(maandag, 7);

  const rijen = await prisma.menuEntry.findMany({
    where: { date: { gte: maandag, lt: zondag } },
    select: { recipeId: true, date: true },
    orderBy: { date: "asc" },
  });

  const uit = new Map<string, string>();
  for (const rij of rijen) {
    if (!uit.has(rij.recipeId)) uit.set(rij.recipeId, dayLabel(rij.date));
  }
  return uit;
}
