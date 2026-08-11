import { deleteCookLog, logCook } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { icons } from "@/lib/icons";
import { toParam } from "@/lib/menu/week";

/**
 * Wat je van dit gerecht vond, en hoe vaak je het al maakte.
 *
 * Drie dingen invullen: sterren, één regel tekst en of het vaker mag. Alles
 * mag leeg blijven — een formulier dat je dwingt een oordeel te geven vul je
 * na één keer niet meer in, en dan is de hele log waardeloos.
 *
 * Sterren zijn radio-knoppen met labels, geen JavaScript-widget: zo werkt het
 * ook zonder scripts en snapt een schermlezer wat er te kiezen valt.
 */

export type CookEntry = {
  id: string;
  cookedAt: Date;
  rating: number | null;
  note: string | null;
  again: boolean | null;
  who: string | null;
};

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="stars" title={`${value} van de 5`} aria-label={`${value} van de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} icon={icons.favorite} size={size} className={n <= value ? "on" : ""} />
      ))}
    </span>
  );
}

export function CookLog({
  recipeId,
  entries,
  open,
  who,
}: {
  recipeId: string;
  entries: CookEntry[];
  open: boolean;
  /** Wie dit invult, als er namen zijn ingesteld. */
  who: string | null;
}) {
  const rated = entries.filter((entry) => entry.rating !== null);
  const average =
    rated.length > 0
      ? rated.reduce((sum, entry) => sum + (entry.rating ?? 0), 0) / rated.length
      : null;

  // Hebben jullie er allebei iets van gevonden, dan is één gemiddelde een
  // cijfer waar niemand zich in herkent. Dan liever per persoon.
  const perPerson = byPerson(rated);

  const today = toParam(new Date());

  return (
    <section className="cooklog" id="gekookt">
      <h2 className="section">Gemaakt</h2>

      {entries.length === 0 ? (
        <p className="muted hint">
          Nog niet bijgehouden. Eén keer invullen en je weet later hoe vaak je
          het maakte en wat je ervan vond.
        </p>
      ) : (
        <>
          <p className="cooklog-sum">
            {entries.length === 1 ? "Eén keer gemaakt" : `${entries.length} keer gemaakt`}
            {perPerson.length > 1 ? (
              perPerson.map((person) => (
                <span key={person.name} className="per-person">
                  {" · "}
                  {person.name} <Stars value={Math.round(person.average)} />
                </span>
              ))
            ) : average !== null ? (
              <>
                {" · "}
                <Stars value={Math.round(average)} />{" "}
                {average.toFixed(1).replace(".", ",")}
              </>
            ) : null}
            {" · "}
            laatst {when(entries[0].cookedAt)}
          </p>

          <ul className="cooklog-list">
            {entries.map((entry) => (
              <li key={entry.id}>
                <div className="cooklog-head">
                  <span className="cooklog-date">
                    {entry.cookedAt.toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  {entry.who && <span className="who">{entry.who}</span>}
                  {entry.rating !== null && <Stars value={entry.rating} />}
                  {entry.again === true && (
                    <span className="again yes">
                      <Icon icon={icons.again} size={12} />
                      vaker
                    </span>
                  )}
                  {entry.again === false && <span className="again no">eenmalig</span>}
                  <form action={deleteCookLog}>
                    <input type="hidden" name="id" value={entry.id} />
                    <button
                      type="submit"
                      className="icon quiet"
                      aria-label="Deze keer verwijderen"
                    >
                      <Icon icon={icons.delete} size={14} />
                    </button>
                  </form>
                </div>
                {entry.note && <p className="cooklog-note">{entry.note}</p>}
              </li>
            ))}
          </ul>
        </>
      )}

      <details className="cooklog-add" open={open}>
        <summary>
          <Icon icon={icons.note} size={16} />
          {entries.length === 0 ? "Vastleggen dat je het maakte" : "Nog een keer noteren"}
          {who && <span className="as-who">als {who}</span>}
        </summary>

        <form action={logCook}>
          <input type="hidden" name="recipeId" value={recipeId} />

          <fieldset className="rating">
            <legend className="eyebrow">Hoe was het?</legend>
            {/* Aflopend in de DOM, want CSS draait de rij visueel om. Alleen
                zo kan "de aangevinkte plus alles erna" de lágere sterren
                inkleuren — en dat is de enige manier om dit zonder JavaScript
                te doen. */}
            <div className="star-pick">
              {[5, 4, 3, 2, 1].map((n) => (
                <label key={n} title={`${n} van de 5`}>
                  <input type="radio" name="sterren" value={n} />
                  <Icon icon={icons.favorite} size={26} />
                  <span className="sr">{n} sterren</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="field">
            <span className="eyebrow">Opmerking</span>
            <input
              type="text"
              name="opmerking"
              maxLength={200}
              placeholder="Volgende keer minder zout"
            />
          </label>

          <fieldset className="rating">
            <legend className="eyebrow">Vaker eten?</legend>
            <div className="checks">
              <label className="check">
                <input type="radio" name="vaker" value="ja" />
                <span>Ja</span>
              </label>
              <label className="check">
                <input type="radio" name="vaker" value="nee" />
                <span>Nee</span>
              </label>
            </div>
          </fieldset>

          <label className="field">
            <span className="eyebrow">Wanneer</span>
            <input type="date" name="wanneer" defaultValue={today} max={today} />
          </label>

          <button type="submit">
            <Icon icon={icons.done} size={17} />
            Opslaan
          </button>
        </form>
      </details>
    </section>
  );
}

/**
 * "vandaag", "gisteren", "3 dagen geleden", of gewoon de datum.
 *
 * Tellen in kalenderdagen en niet in verstreken tijd: iets dat je vanochtend
 * maakte is vanavond nog steeds vandaag, ook al zitten er twaalf uur tussen.
 */
function when(date: Date): string {
  const vandaag = new Date();
  vandaag.setHours(0, 0, 0, 0);
  const toen = new Date(date);
  toen.setHours(0, 0, 0, 0);

  const days = Math.round((vandaag.getTime() - toen.getTime()) / 86_400_000);
  if (days <= 0) return "vandaag";
  if (days === 1) return "gisteren";
  if (days < 14) return `${days} dagen geleden`;
  if (days < 60) return `${Math.round(days / 7)} weken geleden`;
  return date.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
}

/**
 * Het gemiddelde per persoon, voor recepten waar meer dan één iemand iets van
 * vond. Regels zonder naam blijven buiten beeld: die horen bij niemand.
 */
function byPerson(rated: CookEntry[]): Array<{ name: string; average: number }> {
  const buckets = new Map<string, number[]>();
  for (const entry of rated) {
    if (!entry.who) continue;
    const list = buckets.get(entry.who) ?? [];
    list.push(entry.rating as number);
    buckets.set(entry.who, list);
  }
  return [...buckets.entries()]
    .map(([name, values]) => ({
      name,
      average: values.reduce((sum, value) => sum + value, 0) / values.length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
