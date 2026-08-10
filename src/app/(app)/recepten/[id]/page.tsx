import Link from "next/link";
import { notFound } from "next/navigation";
import { toggleFavorite } from "@/app/actions";
import { prisma } from "@/lib/db";
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
      <article className="recipe-hero">
        {row.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.imageUrl} alt="" />
        )}
        <h1>{recipe.title}</h1>
        {recipe.description && <p className="muted">{recipe.description}</p>}

        <div className="row" style={{ marginTop: "0.75rem" }}>
          {recipe.steps.length > 0 && (
            <Link href={cookHref} className="button-link sans">
              Kookmodus starten
            </Link>
          )}
          <form action={toggleFavorite}>
            <input type="hidden" name="id" value={row.id} />
            <button type="submit" className="secondary">
              {row.favorite ? "★ Favoriet" : "☆ Favoriet maken"}
            </button>
          </form>
          {row.sourceUrl && (
            <a className="sans" href={row.sourceUrl} target="_blank" rel="noreferrer">
              Bron{row.sourceName ? `: ${row.sourceName}` : ""} ↗
            </a>
          )}
        </div>
      </article>

      <div className="facts">
        {servings !== null && (
          <div className="servings">
            <span>Personen</span>
            <div className="stepper sans">
              {/* Links in plaats van knoppen: werkt zonder JavaScript en de
                  gekozen hoeveelheid staat in de URL, dus je kunt hem delen
                  en hij overleeft een refresh. */}
              <Link
                href={servingsHref(servings - 1)}
                aria-disabled={servings <= MIN_SERVINGS}
                className={servings <= MIN_SERVINGS ? "off" : ""}
                aria-label="Eén persoon minder"
              >
                −
              </Link>
              <strong>{servings}</strong>
              <Link
                href={servingsHref(servings + 1)}
                aria-disabled={servings >= MAX_SERVINGS}
                className={servings >= MAX_SERVINGS ? "off" : ""}
                aria-label="Eén persoon meer"
              >
                +
              </Link>
            </div>
          </div>
        )}
        {servings === null && recipe.servings !== null && (
          <div>
            <span>Porties</span>
            {recipe.servings}
          </div>
        )}
        {recipe.prepMinutes !== null && (
          <div>
            <span>Voorbereiden</span>
            {recipe.prepMinutes} min
          </div>
        )}
        {recipe.cookMinutes !== null && (
          <div>
            <span>Bereiden</span>
            {recipe.cookMinutes} min
          </div>
        )}
        {recipe.totalMinutes !== null && (
          <div>
            <span>Totaal</span>
            {recipe.totalMinutes} min
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
            <p className="notice sans">
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
                  <span className="step-time sans">{step.timerMinutes} min</span>
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

      {recipe.tags.length > 0 && (
        <div className="tags">
          {recipe.tags.map((tag) => (
            <span key={tag} className="badge">
              {tag}
            </span>
          ))}
        </div>
      )}
    </main>
  );
}

