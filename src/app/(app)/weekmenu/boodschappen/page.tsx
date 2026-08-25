import Link from "next/link";
import { addExtra, removeExtra } from "@/app/actions";
import { Afvinklijst, type Vak } from "@/components/Afvinklijst";
import { CopyList } from "@/components/CopyList";
import { Icon } from "@/components/Icon";
import { Knop } from "@/components/Knop";
import { Vastkop } from "@/components/Vastkop";
import { prisma } from "@/lib/db";
import { icons } from "@/lib/icons";
import { asText, weekShoppingList } from "@/lib/menu/list";
import { fromParam, startOfWeek, toParam, weekLabel } from "@/lib/menu/week";
import { voorkeuren } from "@/lib/settings";
import { iemandZwanger } from "@/lib/zwanger";
import { beoordeelIngredient, NIVEAU_LABEL } from "@/lib/zwanger";

export const dynamic = "force-dynamic";

export const metadata = { title: "Boodschappen" };

/**
 * De boodschappen van één week: alle recepten bij elkaar opgeteld, gegroepeerd
 * per schap, en af te strepen terwijl je loopt.
 *
 * Hier stond eerder dat het afvinken bewust ontbrak, omdat je in de winkel iets
 * wilt dat het altijd doet — ook zonder bereik. Dat argument klopte, maar de
 * premisse niet meer: het afvinken staat in `localStorage` en haalt de server
 * dus helemaal niet. Zie `components/Afvinklijst.tsx` voor waarom het afvinken
 * lokaal blijft terwijl zelf toegevoegde regels juist wél gedeeld worden.
 */
export default async function WeekShoppingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const monday = startOfWeek(fromParam(query.week));
  const week = toParam(monday);

  const [list, extras, wensen] = await Promise.all([
    weekShoppingList(monday),
    prisma.shoppingExtra.findMany({
      where: { week: monday },
      orderBy: { createdAt: "asc" },
    }),
    voorkeuren(),
  ]);

  // Het zwangerschapsvinkje telt hier net zo goed als op de receptpagina — en
  // eigenlijk meer, want dit is het scherm dat je vasthebt terwijl je voor het
  // schap staat.
  const zwangerAan = iemandZwanger(wensen).length > 0;

  const vakken: Vak[] = list.groups.map((group) => ({
    sleutel: group.aisle,
    kop: group.label,
    regels: group.lines.map((line) => {
      const oordeel = zwangerAan ? beoordeelIngredient(line.name) : null;
      return {
        naam: line.name,
        hoeveelheid: line.amount,
        uit: line.from,
        // "veilig" laten we hier weg: op een lijst van dertig producten is een
        // groen vlaggetje bij de helft precies wat de twee rode onzichtbaar
        // maakt. Zelfde afweging als op de tegels in het overzicht.
        let_op:
          oordeel && oordeel.niveau !== "veilig"
            ? {
                niveau: oordeel.niveau,
                label: NIVEAU_LABEL[oordeel.niveau],
                waarom: oordeel.tenzij
                  ? `${oordeel.waarom} ${oordeel.tenzij}`
                  : oordeel.waarom,
              }
            : null,
      };
    }),
  }));

  const leeg = list.count === 0 && extras.length === 0;

  return (
    <main>
      <Link href={`/weekmenu?week=${week}`} className="back">
        <Icon icon={icons.back} size={16} />
        Terug naar de week
      </Link>

      <div className="page-head">
        <h1>Boodschappen</h1>
        <p>
          {weekLabel(monday)} · {list.meals}{" "}
          {list.meals === 1 ? "gerecht" : "gerechten"} · {list.count}{" "}
          {list.count === 1 ? "product" : "producten"}
        </p>
      </div>
      <Vastkop titel="Boodschappen" meta={weekLabel(monday)} />

      {leeg ? (
        <div className="empty">
          <p>Er staat nog niets op het menu deze week.</p>
          <p>
            <Link href={`/weekmenu?week=${week}`}>Plan een gerecht</Link>
          </p>
        </div>
      ) : (
        <>
          {list.count > 0 && (
            <CopyList
              plain={asText(list, monday, { headings: false })}
              pretty={asText(list, monday, { headings: true })}
            />
          )}

          <Afvinklijst
            vakken={vakken}
            week={week}
            meerdereGerechten={list.meals > 1}
          />

          {/* Zelf toegevoegd: apart onderaan, want het komt nergens uit voort.
              Wel in dezelfde lijstvorm, want in de winkel is het één lijst. */}
          <section className="aisle zelf">
            <h2 className="eyebrow">Zelf toegevoegd</h2>
            {extras.length > 0 && (
              <ul>
                {extras.map((extra) => (
                  <li key={extra.id}>
                    <span className="what">
                      <span className="name">{extra.text}</span>
                      {extra.addedBy && (
                        <span className="from">{extra.addedBy}</span>
                      )}
                    </span>
                    <form action={removeExtra}>
                      <input type="hidden" name="id" value={extra.id} />
                      <Knop
                        className="quiet raakbaar"
                        aria-label={`${extra.text} van de lijst halen`}
                      >
                        <Icon icon={icons.close} size={15} />
                      </Knop>
                    </form>
                  </li>
                ))}
              </ul>
            )}

            <form action={addExtra} className="zelf-toevoegen">
              <input type="hidden" name="week" value={week} />
              <input
                type="text"
                name="tekst"
                placeholder="Wc-papier, koffie, kattenbrokken…"
                aria-label="Zelf iets toevoegen aan de lijst"
                autoComplete="off"
                maxLength={120}
                required
              />
              <Knop className="secondary" bezigLabel="…">
                Erbij
              </Knop>
            </form>
          </section>

          <p className="muted footnote">
            Afvinken blijft op dit toestel staan en werkt ook zonder bereik.
            Kopiëren geeft kale regels, één product per regel — dat plakt het
            beste in de app van de supermarkt. Delen stuurt de versie met kopjes
            mee.
          </p>
        </>
      )}
    </main>
  );
}
