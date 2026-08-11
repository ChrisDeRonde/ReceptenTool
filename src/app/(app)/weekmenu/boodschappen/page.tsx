import Link from "next/link";
import { CopyList } from "@/components/CopyList";
import { Icon } from "@/components/Icon";
import { icons } from "@/lib/icons";
import { asText, weekShoppingList } from "@/lib/menu/list";
import { fromParam, startOfWeek, toParam, weekLabel } from "@/lib/menu/week";

export const dynamic = "force-dynamic";

/**
 * De boodschappen van één week: alle recepten bij elkaar opgeteld, gegroepeerd
 * per schap, klaar om te kopiëren naar de app van de supermarkt.
 *
 * Bewust geen afvinklijst. Deze app draait op een servertje thuis; in de winkel
 * wil je iets dat het altijd doet, ook zonder bereik. Wat wij toevoegen is het
 * optellen — het afvinken laten we aan de app die je toch al bij je hebt.
 */
export default async function WeekShoppingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const monday = startOfWeek(fromParam(query.week));
  const list = await weekShoppingList(monday);

  return (
    <main>
      <Link href={`/weekmenu?week=${toParam(monday)}`} className="back">
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

      {list.count === 0 ? (
        <div className="empty">
          <p>Er staat nog niets op het menu deze week.</p>
          <p>
            <Link href={`/weekmenu?week=${toParam(monday)}`}>Plan een gerecht</Link>
          </p>
        </div>
      ) : (
        <>
          <CopyList
            plain={asText(list, monday, { headings: false })}
            pretty={asText(list, monday, { headings: true })}
          />

          <div className="list">
            {list.groups.map((group) => (
              <section key={group.aisle} className="aisle">
                <h2 className="eyebrow">{group.label}</h2>
                <ul>
                  {group.lines.map((line) => (
                    <li key={`${group.aisle}-${line.name}-${line.amount}`}>
                      <span className="what">
                        <span className="name">{line.name}</span>
                        {list.meals > 1 && (
                          <span className="from">{line.from.join(" · ")}</span>
                        )}
                      </span>
                      <span className="amount">{line.amount}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <p className="muted footnote">
            Kopiëren geeft kale regels, één product per regel — dat plakt het
            beste in de app van de supermarkt. Delen stuurt de versie met kopjes
            mee.
          </p>
        </>
      )}
    </main>
  );
}
