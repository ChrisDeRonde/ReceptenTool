import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import { addToFreezer, deleteRecipe, toggleFavorite } from "@/app/actions";
import { Knop } from "@/components/Knop";
import { PrintKnop } from "@/components/PrintKnop";
import { Avatar } from "@/components/Avatar";
import { CategoryEditor } from "@/components/CategoryEditor";
import { CookLog } from "@/components/CookLog";
import { FavorietKnop } from "@/components/FavorietKnop";
import { Icon } from "@/components/Icon";
import { Moment } from "@/components/Moment";
import { Vastkop } from "@/components/Vastkop";
import { prisma } from "@/lib/db";
import { currentPerson } from "@/lib/who";
import { huishouden, voorkeuren } from "@/lib/settings";
import { bezwaren } from "@/lib/voorkeuren";
import {
  BRON,
  beoordeelIngredient,
  beoordeelRecept,
  iemandZwanger,
  NIVEAU_LABEL,
} from "@/lib/zwanger";
import { duurTekst, werkelijkeDuur } from "@/lib/recipe/duur";
import { datumKort, opsomming } from "@/lib/tijd";
import { icons } from "@/lib/icons";
import {
  DIET_LABELS,
  MEAL_TYPE_LABELS,
  unpackDiets,
  unpackMealTypes,
} from "@/lib/recipe/categories";
import { formatAmount } from "@/lib/recipe/format";
import { buildHaystack } from "@/lib/recipe/search";
import {
  MAX_SERVINGS,
  MIN_SERVINGS,
  parseServings,
  scaleRecipe,
} from "@/lib/recipe/scale";
import { recipeSchema } from "@/lib/recipe/schema";

export const dynamic = "force-dynamic";

/**
 * De titel van het tabblad is de naam van het gerecht. Dat is precies wat je
 * zoekt als je drie tabbladen openhebt of terugbladert in je geschiedenis, en
 * het is het eerste wat een schermlezer voorleest bij het openen.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const row = await prisma.recipe.findUnique({
    where: { id },
    select: { title: true },
  });
  return { title: row?.title ?? "Recept" };
}

export default async function RecipePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const row = await prisma.recipe.findUnique({
    where: { id },
    include: {
      cookLogs: { orderBy: [{ cookedAt: "desc" }, { createdAt: "desc" }] },
    },
  });
  if (!row) notFound();

  const parsed = recipeSchema.safeParse(JSON.parse(row.data));
  if (!parsed.success) {
    // Kan alleen gebeuren als het schema wijzigt onder bestaande data. Beter
    // een eerlijke melding dan een lege pagina.
    return (
      <main>
        <h1>{row.title}</h1>
        <p className="muted">
          Dit recept is opgeslagen in een oudere vorm en kan niet worden
          getoond. Verwerk de bron opnieuw vanuit de <Link href="/inbox">inbox</Link>.
        </p>
      </main>
    );
  }
  const base = parsed.data;
  const mealTypes = unpackMealTypes(row.mealTypes);
  const diets = unpackDiets(row.diets);

  // Het aantal porties staat in de URL, niet in de database: jij kookt voor
  // zes terwijl iemand anders hetzelfde recept voor twee bekijkt. Staat er
  // niets in de URL, dan openen we op jullie huishouden.
  const thuis = await huishouden();

  // Wie eet dit niet? Vergeleken met de ingrediëntnamen zelf, niet met het
  // dieet-etiket: dít is de kant waar iemand op kan vertrouwen. Dezelfde
  // woordenlijst als de zoekfunctie, zodat "paprika's" en "paprika" hetzelfde
  // woord zijn.
  const wensen = await voorkeuren();
  const namenVanHetRecept = buildHaystack(row).ingredientNamen;
  const tegen = bezwaren(wensen, namenVanHetRecept);

  // Het zwangerschapsvinkje. Staat het bij niemand aan, dan kost dit niets en
  // verandert er niets aan de pagina.
  const zwangeren = iemandZwanger(wensen);
  const zwangerAan = zwangeren.length > 0;
  const oordeel = beoordeelRecept(zwangerAan ? namenVanHetRecept : []);

  // Hoe lang het bij jullie werkelijk duurt, uit de kooklog.
  const duur = werkelijkeDuur(
    row.cookLogs.map((log) => log.minutes),
    parsed.data.totalMinutes,
  );

  const servings = parseServings(query.porties, base.servings, thuis);
  const recipe = servings === null ? base : scaleRecipe(base, servings);
  const scaled = servings !== null && servings !== base.servings;
  // Uit de URL of vanzelf? Dat scheelt één zinsdeel in de melding hieronder, en
  // dat is het verschil tussen "wat is hier gebeurd" en "o ja, logisch".
  const uitUrl = Array.isArray(query.porties) ? query.porties[0] : query.porties;
  const viaHuishouden = scaled && !uitUrl;

  const cookHref = scaled
    ? `/recepten/${row.id}/koken?porties=${servings}`
    : `/recepten/${row.id}/koken`;
  const servingsHref = (count: number) =>
    `/recepten/${row.id}?porties=${count}`;

  return (
    <main>
      {/* De tabbalk brengt je ook terug, maar niet naar de filter waar je
          vandaan kwam; deze link houdt de weg terug kort. */}
      <Link href="/" className="back">
        <Icon icon={icons.back} size={16} />
        Alle recepten
      </Link>

      <article className="hero">
        {row.imageUrl && (
          // Dezelfde naam als op de tegel in het overzicht; zie daar waarom.
          <ViewTransition name={`foto-${row.id}`} share="morph" default="none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={row.imageUrl} alt="" />
          </ViewTransition>
        )}
        <h1>{recipe.title}</h1>
        {recipe.description && <p className="lede">{recipe.description}</p>}
        {/* Hier het hardst nodig: een receptpagina is lang, en halverwege de
            ingrediënten weet je niet meer welk gerecht je aan het lezen bent
            als je net uit de zoekresultaten kwam. */}
        <Vastkop titel={recipe.title} meta={row.cuisine ?? undefined} />

        {(mealTypes.length > 0 || row.cuisine) && (
          <div className="pills">
            {mealTypes.map((type) => (
              <Link key={type} href={`/?maaltijd=${type}`} className="pill">
                {MEAL_TYPE_LABELS[type]}
              </Link>
            ))}
            {row.cuisine && (
              <Link
                href={`/?keuken=${encodeURIComponent(row.cuisine)}`}
                className="pill outline"
              >
                {row.cuisine}
              </Link>
            )}
          </div>
        )}

        {/* Eén regel in plaats van badges naast de keuken: "Glutenvrij" als
            pil ziet eruit als een feit, en dat is het niet. Het woord
            "waarschijnlijk" hoort ernaast te staan, en dan is het geen pil
            meer maar een zin. */}
        {diets.length > 0 && (
          <p className="dieetregel">
            Waarschijnlijk{" "}
            {diets.map((diet, index) => (
              <span key={diet}>
                {index > 0 && (index === diets.length - 1 ? " en " : ", ")}
                <Link href={`/?dieet=${diet}`}>
                  {DIET_LABELS[diet].toLowerCase()}
                </Link>
              </span>
            ))}
            . <span className="muted">Afgeleid uit de ingrediënten, geen garantie.</span>
          </p>
        )}

        {/* Bovenaan en niet onderaan: dit moet je gelezen hebben vóór je
            boodschappen doet, niet nadat je het gekookt hebt. */}
        {zwangerAan && oordeel.zwaarste !== null && (
          <div className={`zw-kaart ${oordeel.zwaarste}`} role="note">
            <p className="zw-kop">
              <Icon
                icon={oordeel.onveilig.length > 0 ? icons.warning : icons.done}
                size={16}
              />
              <strong>
                {oordeel.onveilig.length > 0
                  ? "Hier zit iets in dat nu beter kan wachten"
                  : oordeel.pasop.length > 0
                    ? "Let op de bereiding"
                    : "Niets op aan te merken"}
              </strong>
              <span className="muted">
                {zwangeren.length === 1 ? ` voor ${zwangeren[0]}` : ""}
              </span>
            </p>

            {(["onveilig", "pasop", "veilig"] as const)
              .filter((niveau) => oordeel[niveau].length > 0)
              .map((niveau) => (
                <ul key={niveau} className={`zw-lijst ${niveau}`}>
                  {oordeel[niveau].map((bevinding) => (
                    <li key={bevinding.ingredient}>
                      <span className={`zw-vlag ${niveau}`}>
                        {NIVEAU_LABEL[niveau]}
                      </span>
                      <span>
                        <strong>{bevinding.ingredient}</strong> — {bevinding.waarom}
                        {bevinding.tenzij && (
                          <span className="zw-tenzij"> {bevinding.tenzij}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ))}

            <p className="zw-voet muted">
              Dit is de lijst van het {BRON.split(",")[0]} naast de ingrediënten
              gelegd — geen medisch advies, en geen goedkeuring van het gerecht
              als geheel. Wat er niet bij staat, is niet gecontroleerd maar
              alleen niet herkend.
            </p>
          </div>
        )}

        {tegen.length > 0 && (
          <p className="bezwaar" role="note">
            <Icon icon={icons.warning} size={15} />
            <span>
              {tegen.map((wie, index) => (
                <span key={wie.naam}>
                  {index > 0 && " "}
                  <strong>{wie.naam}</strong> eet geen {opsomming(wie.woorden)}.
                </span>
              ))}
            </span>
          </p>
        )}

        <div className="actions">
          {recipe.steps.length > 0 && (
            <Link href={cookHref} className="button grow">
              Kookmodus
            </Link>
          )}
          {/* Het aantal personen van dít moment gaat mee naar het menu:
              plan je voor zes, dan telt de boodschappenlijst voor zes. */}
          <PrintKnop />
          <Link
            href={`/weekmenu?kies=${row.id}${servings !== null ? `&porties=${servings}` : ""}`}
            className="button secondary icon"
            aria-label="Op het weekmenu zetten"
            title="Op het weekmenu"
          >
            <Icon icon={icons.menu} size={19} />
          </Link>
          <Link
            href={`/recepten/${row.id}/bewerken`}
            className="button secondary icon"
            aria-label="Recept bewerken"
            title="Bewerken"
          >
            <Icon icon={icons.edit} size={19} />
          </Link>
          <form action={toggleFavorite}>
            <input type="hidden" name="id" value={row.id} />
            <FavorietKnop favoriet={row.favorite} />
          </form>
          {row.sourceUrl && (
            <a
              className="button secondary icon"
              href={row.sourceUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Bron${row.sourceName ? `: ${row.sourceName}` : ""}`}
              title={row.sourceName ?? row.sourceUrl}
            >
              <Icon icon={icons.source} size={19} />
            </a>
          )}
        </div>
      </article>

      <div className="facts">
        {servings !== null && (
          <div className="fact people">
            <span>Personen</span>
            <div className="stepper">
              {/* Links in plaats van knoppen: werkt zonder JavaScript en de
                  gekozen hoeveelheid staat in de URL, dus je kunt hem delen
                  en hij overleeft een refresh. */}
              <Link
                href={servingsHref(servings - 1)}
                aria-disabled={servings <= MIN_SERVINGS}
                className={`raakbaar ${servings <= MIN_SERVINGS ? "off" : ""}`}
                aria-label="Eén persoon minder"
              >
                <Icon icon={icons.minus} size={16} />
              </Link>
              <strong>{servings}</strong>
              <Link
                href={servingsHref(servings + 1)}
                aria-disabled={servings >= MAX_SERVINGS}
                className={`raakbaar ${servings >= MAX_SERVINGS ? "off" : ""}`}
                aria-label="Eén persoon meer"
              >
                <Icon icon={icons.plus} size={16} />
              </Link>
            </div>
          </div>
        )}
        {servings === null && recipe.servings !== null && (
          <div className="fact">
            <span>Porties</span>
            <strong>{recipe.servings}</strong>
          </div>
        )}
        {recipe.prepMinutes !== null && (
          <div className="fact">
            <span>Voorbereiden</span>
            <strong>{recipe.prepMinutes} min</strong>
          </div>
        )}
        {recipe.cookMinutes !== null && (
          <div className="fact">
            <span>Bereiden</span>
            <strong>{recipe.cookMinutes} min</strong>
          </div>
        )}
        {recipe.totalMinutes !== null && (
          <div className="fact">
            <span>Totaal</span>
            <strong>{recipe.totalMinutes} min</strong>
          </div>
        )}
        {/* Wat de bron schat staat hierboven; dit is wat het bij jullie
            werkelijk werd. Alleen als er genoeg gemeten is én het genoeg
            afwijkt — zie lib/recipe/duur.ts. */}
        {duur?.opvallend && (
          <div className="fact echt">
            <span>Bij jullie</span>
            <strong>{duurTekst(duur.minuten)}</strong>
          </div>
        )}
      </div>

      {recipe.ingredientGroups.length > 0 && (
        <section>
          <div className="sectie-kop">
            <h2 className="section">Ingrediënten</h2>
            {/* Bij de lijst en niet per regel: een knopje achter elk
                ingrediënt maakt van een leeslijst een bedieningspaneel, en je
                vervangt er hooguit één. */}
            <Link href={`/recepten/${row.id}/vervangen`} className="chip ghost">
              Iets vervangen
            </Link>
          </div>
          {scaled && (
            // Eerlijk zijn over wat er níét meeschaalt. Getallen in de
            // staptekst herschrijven is tekstmanipulatie waarbij je meer
            // stukmaakt dan je oplost, dus die blijven staan zoals de bron ze
            // gaf. Hier staat waar je op moet letten.
            <p className="notice">
              {viaHuishouden
                ? `Omgerekend naar ${servings} personen, jullie huishouden. De bron ging uit van ${base.servings}.`
                : `Omgerekend van ${base.servings} naar ${servings} personen.`}{" "}
              Tijden en getallen in de staptekst zijn niet meegeschaald — houd
              deze lijst aan.
            </p>
          )}
          {recipe.ingredientGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              {group.name && <h3 className="group">{group.name}</h3>}
              <ul className="ingredients">
                {group.items.map((item, itemIndex) => {
                  const let_op = zwangerAan ? beoordeelIngredient(item.name) : null;
                  return (
                    <li key={itemIndex} className={let_op ? `zw-${let_op.niveau}` : undefined}>
                      <span className="amount">{formatAmount(item)}</span>
                      <span>
                        {item.name}
                        {item.note && (
                          <span className="muted">, {item.note}</span>
                        )}
                        {let_op && (
                          <>
                            {" "}
                            <span className={`zw-vlag ${let_op.niveau}`}>
                              {NIVEAU_LABEL[let_op.niveau]}
                            </span>
                            {/* De reden alleen bij rood en oranje. Bij groen is
                                het vlaggetje de hele boodschap, en een zin
                                erachter maakt de twee die er wél toe doen
                                moeilijker te vinden. */}
                            {let_op.niveau !== "veilig" && (
                              <span className="zw-waarom">
                                {let_op.waarom}
                                {let_op.tenzij && ` ${let_op.tenzij}`}
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}

      {recipe.steps.length > 0 && (
        <section>
          <h2 className="section">Bereiding</h2>
          <ol className="steps">
            {recipe.steps.map((step, index) => (
              <li key={index}>
                {step.title && <strong>{step.title}</strong>}
                {step.text}
                {step.timerMinutes !== null && (
                  <span className="step-time">{step.timerMinutes} min</span>
                )}
                {step.tip && <span className="step-tip">{step.tip}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Bewaaradvies apart en vóór de tips: dit bepaalt of je maandag dubbel
          kookt voor woensdag, en dat is een planningsvraag. Tussen zeven tips
          over pannen en zout lees je hem niet. */}
      {recipe.bewaren && (
        <div className="bewaarregel">
          <Icon icon={icons.date} size={16} />
          <div>
            <p>{recipe.bewaren}</p>
            <form action={addToFreezer} className="bewaar-vriezer">
              <input type="hidden" name="receptId" value={row.id} />
              <label>
                <span className="sr">Hoeveel porties de vriezer in</span>
                <input
                  type="number"
                  name="porties"
                  min={1}
                  max={40}
                  defaultValue={2}
                  inputMode="numeric"
                />
              </label>
              <Knop className="chip" bezigLabel="…">
                Porties in de vriezer
              </Knop>
            </form>
          </div>
        </div>
      )}

      {recipe.tips.length > 0 && (
        <div className="callout">
          <h3>Tips</h3>
          <ul>
            {recipe.tips.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Alleen zolang het recept nog is zoals het binnenkwam: heb je het zelf
          bijgewerkt, dan zegt deze lijst niets meer over wat er nú staat. */}
      {recipe.assumptions.length > 0 && row.editedAt === null && (
        <div className="callout">
          <h3>Zelf aangevuld</h3>
          <ul>
            {recipe.assumptions.map((assumption, index) => (
              <li key={index}>{assumption}</li>
            ))}
          </ul>
        </div>
      )}

      <CookLog
        recipeId={row.id}
        entries={row.cookLogs}
        // Kom je net uit de kookmodus, dan staat het formulier al open.
        open={readOne(query.gekookt) !== null}
        who={await currentPerson()}
      />

      <CategoryEditor
        recipeId={row.id}
        mealTypes={mealTypes}
        cuisine={row.cuisine}
        diets={diets}
      />

      {row.editedAt && (
        <p className="edited">
          <Icon icon={icons.edit} size={13} />
          {row.editedBy ? (
            <>
              Bijgewerkt door <Avatar name={row.editedBy} size={18} withName />
            </>
          ) : (
            "Zelf bijgewerkt"
          )}
          <Moment>{datumKort(row.editedAt, new Date())}</Moment>
        </p>
      )}

      {recipe.tags.length > 0 && (
        // Aanklikbaar naar het zoeken: dat kijkt al in de tags, dus dan zijn
        // ze meer dan een opsomming onderaan de pagina.
        <div className="tags">
          {recipe.tags.map((tag) => (
            <Link key={tag} href={`/?q=${encodeURIComponent(tag)}`} className="tag">
              {tag}
            </Link>
          ))}
        </div>
      )}

      {/* Twee stappen, zonder JavaScript: een `confirm()` doet het niet als er
          geen scripts draaien, en dit is het enige onomkeerbare op de pagina. */}
      <details className="weggooien">
        <summary>
          <Icon icon={icons.delete} size={15} />
          Recept verwijderen
        </summary>
        <p>
          Weg is weg. Het gaat ook uit je weekmenu en je kooklog, en het
          bijbehorende item verdwijnt uit de inbox.
          {row.sourceUrl && " De bron blijft natuurlijk gewoon bestaan."}
        </p>
        <form action={deleteRecipe}>
          <input type="hidden" name="id" value={row.id} />
          <Knop className="gevaar">
            <Icon icon={icons.delete} size={16} />
            Ja, verwijder {recipe.title}
          </Knop>
        </form>
      </details>
    </main>
  );
}

function readOne(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || null;
}
