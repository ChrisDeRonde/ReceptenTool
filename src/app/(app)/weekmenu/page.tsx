import Link from "next/link";
import { addToMenu, moveMenuEntry, clearWeek, removeFromMenu, setMenuServings } from "@/app/actions";
import { Knop } from "@/components/Knop";
import { Melding } from "@/components/Melding";
import { Icon } from "@/components/Icon";
import { Vastkop } from "@/components/Vastkop";
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
import { leesMelding } from "@/lib/menu/melding";
import { haalVoorstellen } from "@/lib/menu/voorstellen";
import { maandNaam } from "@/lib/menu/seizoen";
import { huishouden } from "@/lib/settings";
import { MAX_SERVINGS, MIN_SERVINGS } from "@/lib/recipe/scale";

export const dynamic = "force-dynamic";

export const metadata = { title: "Weekmenu" };

export default async function WeekMenuPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const monday = startOfWeek(fromParam(query.week));
  const days = weekDays(monday);
  const thuis = await huishouden();

  // Kwam je hier vanaf een recept, dan staat dat recept "in de hand" en kies
  // je alleen nog de dag. Dat scheelt een tussenscherm.
  // Wat er net gebeurde, uit de URL. Zie lib/menu/melding.ts.
  const melding = leesMelding(readOne(query.gedaan), readOne(query.terug));

  // Een gerecht dat verplaatst wordt. Dezelfde vorm als `kies`: de pagina gaat
  // in "kies een dag"-stand en elke dag krijgt een knop. Eén patroon voor twee
  // handelingen scheelt een tweede manier om hetzelfde te doen.
  const verplaatsId = readOne(query.verplaats);

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
  const keep = (target: string) => {
    if (holding) {
      return `/weekmenu?week=${target}&kies=${holding.id}${holdingServings ? `&porties=${holdingServings}` : ""}`;
    }
    if (verplaatsId) return `/weekmenu?week=${target}&verplaats=${verplaatsId}`;
    return `/weekmenu?week=${target}`;
  };

  const teVerplaatsen = verplaatsId
    ? (entries.find((e) => e.id === verplaatsId) ?? null)
    : null;

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
      <Vastkop titel="Weekmenu" meta={weekLabel(monday)} />

      <div className="weeknav">
        <Link href={keep(previous)} className="raakbaar" aria-label="Vorige week">
          <Icon icon={icons.back} size={18} />
        </Link>
        <strong>{weekLabel(monday)}</strong>
        <Link href={keep(next)} className="raakbaar" aria-label="Volgende week">
          <Icon icon={icons.next} size={18} />
        </Link>
      </div>

      {melding && (
        <Melding tekst={melding.tekst}>
          {melding.terug && (
            <form action={addToMenu} className="melding-doen">
              <input type="hidden" name="recipeId" value={melding.terug.recipeId} />
              <input type="hidden" name="dag" value={melding.terug.dag} />
              {melding.terug.porties && (
                <input type="hidden" name="porties" value={melding.terug.porties} />
              )}
              <Knop className="linky" bezigLabel="Bezig…">
                Ongedaan maken
              </Knop>
            </form>
          )}
        </Melding>
      )}

      {holding && (
        <p className="notice">
          Kies een dag voor <strong>{holding.title}</strong>.{" "}
          <Link href={`/weekmenu?week=${weekParam}`}>Annuleren</Link>
        </p>
      )}

      {teVerplaatsen && (
        <p className="notice">
          Naar welke dag gaat <strong>{teVerplaatsen.recipe.title}</strong>?{" "}
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
                const servings = meal.servings ?? thuis;
                return (
                  <div key={meal.id} className="meal">
                    <Link href={`/recepten/${meal.recipe.id}`} className="meal-title">
                      {meal.recipe.title}
                    </Link>

                    <div className="meal-side">
                      <span className="voor">{voorWie(servings, thuis)}</span>
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
                            <Knop className="quiet raakbaar" aria-label="Eén persoon minder">
                              <Icon icon={icons.minus} size={14} />
                            </Knop>
                          </form>
                          <strong>{servings}</strong>
                          <form action={setMenuServings}>
                            <input type="hidden" name="id" value={meal.id} />
                            <input
                              type="hidden"
                              name="porties"
                              value={Math.min(MAX_SERVINGS, servings + 1)}
                            />
                            <Knop className="quiet raakbaar" aria-label="Eén persoon meer">
                              <Icon icon={icons.plus} size={14} />
                            </Knop>
                          </form>
                        </div>
                      )}
                      {/* Weg van de plusknop. Hiervoor stonden −, + en × naast
                          elkaar op elk 30×32, en dan is de afstand tussen "nog
                          een portie" en "weg ermee" een paar millimeter duim.
                          Nu een eigen hoek met lucht eromheen, en er is een weg
                          terug via de strook onderin. */}
                      {/* Verplaatsen zit vóór het kruisje: het is de mildere
                          van de twee, en dan hoort hij ook eerst te staan. */}
                      <Link
                        href={`/weekmenu?week=${weekParam}&verplaats=${meal.id}`}
                        className="quiet raakbaar meal-schuif"
                        aria-label={`${meal.recipe.title} naar een andere dag`}
                      >
                        <Icon icon={icons.date} size={15} />
                      </Link>

                      <form action={removeFromMenu} className="meal-weg">
                        <input type="hidden" name="id" value={meal.id} />
                        <Knop
                          className="quiet raakbaar"
                          aria-label={`${meal.recipe.title} van het menu halen`}
                        >
                          <Icon icon={icons.close} size={15} />
                        </Knop>
                      </form>
                    </div>
                  </div>
                );
              })}

              {teVerplaatsen ? (
                teVerplaatsen.date.getTime() === day.getTime() ? (
                  <p className="add-day staat-hier">Staat hier nu</p>
                ) : (
                  <form action={moveMenuEntry}>
                    <input type="hidden" name="id" value={teVerplaatsen.id} />
                    <input type="hidden" name="dag" value={key} />
                    <Knop className="secondary add-day" bezigLabel="…">
                      <Icon icon={icons.next} size={15} />
                      Hierheen
                    </Knop>
                  </form>
                )
              ) : holding ? (
                <form action={addToMenu}>
                  <input type="hidden" name="recipeId" value={holding.id} />
                  <input type="hidden" name="dag" value={key} />
                  {holdingServings && (
                    <input type="hidden" name="porties" value={holdingServings} />
                  )}
                  <Knop className="secondary add-day">
                    <Icon icon={icons.plus} size={15} />
                    Hier
                  </Knop>
                </form>
              ) : (
                // Op een lege dag is dit de hoofdhandeling en staat het woord
                // erbij; staat er al iets, dan is een tweede gerecht de
                // uitzondering en is een plusje genoeg. Zeven keer hetzelfde
                // knopje onder elkaar is ruis in een scherm dat je scant.
                <Link
                  href={`/weekmenu/kies?dag=${key}`}
                  className={`add-day raakbaar ${meals.length > 0 ? "kaal" : ""}`}
                  aria-label={`Gerecht toevoegen op ${dayLabel(day)}`}
                >
                  <Icon icon={icons.plus} size={15} />
                  {meals.length === 0 && "Gerecht"}
                </Link>
              )}
            </section>
          );
        })}
      </div>

      <Voorstellen
        gepland={entries.map((e) => ({ id: e.recipe.id, cuisine: e.recipe.cuisine }))}
        week={weekParam}
        inHuis={readOne(query.ligt) ?? ""}
        holding={holdingId}
        holdingServings={holdingServings}
      />

      {entries.length > 0 && (
        <div className="row week-actions">
          <Link href={`/weekmenu/boodschappen?week=${weekParam}`} className="button">
            <Icon icon={icons.basket} size={18} />
            Boodschappenlijst
          </Link>
          {/* Achter een uitklap, net als het verwijderen van een recept: dit
              gooit een hele week planning weg en het staat pal naast de knop
              die je juist wél elke week gebruikt. Een `confirm()` zou het ook
              doen, maar niet zonder JavaScript. */}
          <details className="week-leeg">
            <summary>Week leegmaken</summary>
            <p>
              Alle {entries.length}{" "}
              {entries.length === 1 ? "geplande gerecht" : "geplande gerechten"}{" "}
              van deze week gaan eraf. Dit kan niet ongedaan gemaakt worden — de
              recepten zelf blijven natuurlijk staan.
            </p>
            <form action={clearWeek}>
              <input type="hidden" name="week" value={weekParam} />
              <Knop className="gevaar" bezigLabel="Bezig…">
                Ja, maak de week leeg
              </Knop>
            </form>
          </details>
        </div>
      )}
    </main>
  );
}

/**
 * "Iedereen" leest prettiger dan een getal dat toch altijd hetzelfde is; wijk
 * je ervan af, dan wil je juist wél zien hoeveel het er zijn.
 */
function voorWie(servings: number, thuis: number): string {
  if (servings === thuis) return "iedereen";
  if (servings === 1) return "1 persoon";
  return `${servings} personen`;
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
  inHuis,
  holding,
  holdingServings,
}: {
  gepland: Array<{ id: string; cuisine: string | null }>;
  week: string;
  /** Wat er in de koelkast ligt, zoals je het intypte. */
  inHuis: string;
  holding: string | null;
  holdingServings: string | null;
}) {
  const vandaag = new Date();

  const [aantalRecepten, { voorstellen, termen, gevraagd }] = await Promise.all([
    prisma.recipe.count(),
    haalVoorstellen({ gepland, inHuis, vandaag }),
  ]);

  // Zonder recepten valt er niets te vragen; met recepten maar zonder treffer
  // moet het veld blijven staan, anders kun je je zoekopdracht niet bijstellen.
  if (aantalRecepten === 0) return null;

  const bewaar = (velden: Record<string, string | null>) =>
    Object.entries(velden)
      .filter(([, waarde]) => waarde)
      .map(([naam, waarde]) => (
        <input key={naam} type="hidden" name={naam} value={waarde as string} />
      ));

  return (
    <section className="voorstellen">
      <h2 className="section">Misschien iets?</h2>

      {/* Een GET-formulier: wat je intypt komt in de URL, dus je kunt het
          resultaat delen en de terugknop werkt zoals hij hoort. */}
      <form className="ligt" action="/weekmenu" method="get">
        {bewaar({ week, kies: holding, porties: holdingServings })}
        <label className="field">
          <span className="eyebrow">Wat ligt er in huis?</span>
          <input
            type="search"
            name="ligt"
            defaultValue={inHuis}
            placeholder="prei, gehakt, kaas"
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>
        <Knop className="secondary">
          Zoek
        </Knop>
      </form>

      {voorstellen.length === 0 ? (
        <p className="muted hint">
          {termen.length > 0
            ? "Niets dat daarop past. Laat een ingrediënt weg, of kijk of er nog iets anders ligt."
            : gevraagd.dieet.length > 0 || gevraagd.afkeer.length > 0
              ? "Niets dat binnen jullie voorkeuren valt. Die staan in de instellingen."
              : "Nog niets voor te stellen."}
        </p>
      ) : (
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
                aria-label={`Een dag kiezen voor ${voorstel.title}`}
              >
                Kies een dag
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="muted hint seizoenregel">
        Wat er in {maandNaam(vandaag)} uit de volle grond komt, telt mee.{" "}
        <Link href="/weekmenu/ideeen">Iets nieuws proberen?</Link>
      </p>
    </section>
  );
}

function readOne(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  const clean = first?.trim();
  return clean ? clean : null;
}
