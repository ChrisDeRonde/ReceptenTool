import Link from "next/link";
import { notFound } from "next/navigation";
import { toggleFavorite } from "@/app/actions";
import { CategoryEditor } from "@/components/CategoryEditor";
import { Icon } from "@/components/Icon";
import { prisma } from "@/lib/db";
import { icons } from "@/lib/icons";
import { MEAL_TYPE_LABELS, unpackMealTypes } from "@/lib/recipe/categories";
import { formatAmount } from "@/lib/recipe/format";
import {
  MAX_SERVINGS,
  MIN_SERVINGS,
  parseServings,
  scaleRecipe,
} from "@/lib/recipe/scale";
import { recipeSchema } from "@/lib/recipe/schema";

export const dynamic = "force-dynamic";

export default async function RecipePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const row = await prisma.recipe.findUnique({ where: { id } });
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

  // Het aantal porties staat in de URL, niet in de database: jij kookt voor
  // zes terwijl iemand anders hetzelfde recept voor twee bekijkt.
  const servings = parseServings(query.porties, base.servings);
  const recipe = servings === null ? base : scaleRecipe(base, servings);
  const scaled = servings !== null && servings !== base.servings;

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
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.imageUrl} alt="" />
        )}
        <h1>{recipe.title}</h1>
        {recipe.description && <p className="lede">{recipe.description}</p>}

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

        <div className="actions">
          {recipe.steps.length > 0 && (
            <Link href={cookHref} className="button grow">
              Kookmodus starten
            </Link>
          )}
          {/* Het aantal personen van dít moment gaat mee naar het menu:
              plan je voor zes, dan telt de boodschappenlijst voor zes. */}
          <Link
            href={`/weekmenu?kies=${row.id}${servings !== null ? `&porties=${servings}` : ""}`}
            className="button secondary icon"
            aria-label="Op het weekmenu zetten"
            title="Op het weekmenu"
          >
            <Icon icon={icons.menu} size={19} />
          </Link>
          <form action={toggleFavorite}>
            <input type="hidden" name="id" value={row.id} />
            <button
              type="submit"
              className={`icon secondary ${row.favorite ? "on" : ""}`}
              aria-label={row.favorite ? "Uit favorieten halen" : "Favoriet maken"}
              title={row.favorite ? "Uit favorieten halen" : "Favoriet maken"}
            >
              <Icon icon={icons.favorite} size={19} />
            </button>
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
                className={servings <= MIN_SERVINGS ? "off" : ""}
                aria-label="Eén persoon minder"
              >
                <Icon icon={icons.minus} size={16} />
              </Link>
              <strong>{servings}</strong>
              <Link
                href={servingsHref(servings + 1)}
                aria-disabled={servings >= MAX_SERVINGS}
                className={servings >= MAX_SERVINGS ? "off" : ""}
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
      </div>

      {recipe.ingredientGroups.length > 0 && (
        <section>
          <h2 className="section">Ingrediënten</h2>
          {scaled && (
            // Eerlijk zijn over wat er níét meeschaalt. Getallen in de
            // staptekst herschrijven is tekstmanipulatie waarbij je meer
            // stukmaakt dan je oplost, dus die blijven staan zoals de bron ze
            // gaf. Hier staat waar je op moet letten.
            <p className="notice">
              Omgerekend van {base.servings} naar {servings} personen. Tijden en
              getallen in de staptekst zijn niet meegeschaald — houd deze lijst
              aan.
            </p>
          )}
          {recipe.ingredientGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              {group.name && <h3 className="group">{group.name}</h3>}
              <ul className="ingredients">
                {group.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <span className="amount">{formatAmount(item)}</span>
                    <span>
                      {item.name}
                      {item.note && (
                        <span className="muted">, {item.note}</span>
                      )}
                    </span>
                  </li>
                ))}
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

      {recipe.assumptions.length > 0 && (
        <div className="callout">
          <h3>Zelf aangevuld</h3>
          <ul>
            {recipe.assumptions.map((assumption, index) => (
              <li key={index}>{assumption}</li>
            ))}
          </ul>
        </div>
      )}

      <CategoryEditor
        recipeId={row.id}
        mealTypes={mealTypes}
        cuisine={row.cuisine}
      />

      {recipe.tags.length > 0 && (
        <div className="tags">
          {recipe.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      )}
    </main>
  );
}
