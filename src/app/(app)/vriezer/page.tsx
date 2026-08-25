import Link from "next/link";
import { addToFreezer, removeFromFreezer, takeFromFreezer } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { Knop } from "@/components/Knop";
import { Vastkop } from "@/components/Vastkop";
import { prisma } from "@/lib/db";
import { icons } from "@/lib/icons";
import { dagenTussen, geleden } from "@/lib/tijd";

export const dynamic = "force-dynamic";

export const metadata = { title: "Vriezer" };

/**
 * Wat er in de vriezer ligt.
 *
 * De goedkoopste maaltijd die je kunt plannen is er een die je al gekookt
 * hebt. Dubbel koken en de helft invriezen werkt alleen als je het niet
 * vergeet, en een la vol naamloze bakjes is precies hoe je het vergeet.
 *
 * Gesorteerd op wat er het langst ligt. Dat is de volgorde waarin je het eruit
 * hoort te halen, en het is ook de enige volgorde waarin deze pagina iets
 * toevoegt: alfabetisch had je zelf ook kunnen bedenken.
 */
export default async function VriezerPagina() {
  const items = await prisma.freezerItem.findMany({
    orderBy: { frozenAt: "asc" },
    include: { recipe: { select: { id: true, title: true } } },
  });

  const nu = new Date();
  const porties = items.reduce((som, item) => som + item.portions, 0);

  return (
    <main>
      <div className="page-head">
        <h1>Vriezer</h1>
        <p>
          {items.length === 0
            ? "Nog niets ingevroren."
            : `${porties} ${porties === 1 ? "portie" : "porties"} in ${items.length} ${items.length === 1 ? "bakje" : "bakjes"}`}
        </p>
      </div>
      <Vastkop titel="Vriezer" />

      {items.length === 0 ? (
        <div className="empty">
          <p>Nog niets ingevroren.</p>
          <p>
            Kook je een keer dubbel, dan kun je het onderaan een receptpagina
            hier neerzetten. Dan staat het er nog als je het nodig hebt.
          </p>
        </div>
      ) : (
        <ul className="vriezer">
          {items.map((item) => {
            const dagen = dagenTussen(item.frozenAt, nu);
            return (
              <li key={item.id}>
                <div className="vriezer-wat">
                  <span className="vriezer-naam">
                    {item.recipe ? (
                      <Link href={`/recepten/${item.recipe.id}`}>{item.name}</Link>
                    ) : (
                      item.name
                    )}
                  </span>
                  <span className="vriezer-meta">
                    {item.portions} {item.portions === 1 ? "portie" : "porties"} ·{" "}
                    {dagen === 0 ? "vandaag" : geleden(dagen)}
                    {item.addedBy && ` · ${item.addedBy}`}
                    {/* Na drie maanden is het niet bedorven, maar wel tijd. */}
                    {dagen > 90 && <span className="vriezer-oud"> · ligt er lang</span>}
                  </span>
                </div>

                <form action={takeFromFreezer}>
                  <input type="hidden" name="id" value={item.id} />
                  <Knop
                    className="chip"
                    aria-label={`Eén portie ${item.name} eruit halen`}
                    bezigLabel="…"
                  >
                    Eruit
                  </Knop>
                </form>

                <form action={removeFromFreezer} className="meal-weg">
                  <input type="hidden" name="id" value={item.id} />
                  <Knop
                    className="quiet raakbaar"
                    aria-label={`${item.name} helemaal van de lijst halen`}
                  >
                    <Icon icon={icons.close} size={15} />
                  </Knop>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      {/* Zelf iets neerzetten dat nergens uit voortkomt: een restje soep, een
          zak zelfgemaakte bouillon. */}
      <section className="zelf">
        <h2 className="eyebrow">Zelf iets neerzetten</h2>
        <form action={addToFreezer} className="vriezer-erbij">
          <label className="field">
            <span className="eyebrow">Wat</span>
            <input
              type="text"
              name="naam"
              placeholder="Bouillon, restje soep…"
              autoComplete="off"
              maxLength={120}
              required
            />
          </label>
          <label className="field">
            <span className="eyebrow">Porties</span>
            <input
              type="number"
              name="porties"
              min={1}
              max={40}
              defaultValue={1}
              inputMode="numeric"
            />
          </label>
          <label className="field">
            <span className="eyebrow">Wanneer</span>
            <input
              type="date"
              name="wanneer"
              defaultValue={datumInvoer(nu)}
              max={datumInvoer(nu)}
            />
          </label>
          <Knop className="secondary" bezigLabel="…">
            In de vriezer
          </Knop>
        </form>
      </section>

      <p className="muted footnote">
        Alles wat je hier neerzet telt mee bij de voorstellen op het weekmenu:
        wat er al ligt, hoef je niet nog eens te koken.{" "}
        <Link href="/weekmenu">Naar de week</Link>.
      </p>
    </main>
  );
}

/** `yyyy-mm-dd` in de lokale tijd, zoals een date-invoer het wil. */
function datumInvoer(datum: Date): string {
  const maand = String(datum.getMonth() + 1).padStart(2, "0");
  const dag = String(datum.getDate()).padStart(2, "0");
  return `${datum.getFullYear()}-${maand}-${dag}`;
}
