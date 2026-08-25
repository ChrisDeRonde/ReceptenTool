import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Knop } from "@/components/Knop";
import { icons } from "@/lib/icons";
import { tintForIn } from "@/lib/people";

/**
 * Wie kookt en wie er komt eten, per avond.
 *
 * Achter een uitklap en niet als vaste rij knoppen. Op het weekmenu staan al
 * porties, verplaatsen en weghalen naast elke titel; daar nog een naamkiezer en
 * een gastenteller bij zetten maakt van een overzicht een bedieningspaneel.
 * Dichtgeklapt zie je alleen wat er te zien valt — een naam, "+2" — en dat is
 * meestal precies genoeg.
 *
 * **Open of dicht staat in de URL en niet in `useState`.** Dat was de eerste
 * versie, en die klapte na elke keuze weer dicht: een server action eindigt met
 * `revalidatePath`, de boom rendert opnieuw, en de toestand in het geheugen is
 * weg. Je koos een kok en moest het paneel opnieuw opendoen voor de gasten.
 * Via de URL overleeft het de ronde langs de server — en het werkt meteen ook
 * zonder JavaScript, net als de rest van dit scherm.
 */
export function Avond({
  entryId,
  kok,
  gasten,
  gastnotitie,
  namen,
  open,
  openHref,
  dichtHref,
  zetKok,
  zetGasten,
}: {
  entryId: string;
  kok: string | null;
  gasten: number;
  gastnotitie: string | null;
  namen: string[];
  open: boolean;
  openHref: string;
  dichtHref: string;
  zetKok: (formData: FormData) => Promise<void>;
  zetGasten: (formData: FormData) => Promise<void>;
}) {
  const samenvatting = [
    kok ? `${kok} kookt` : null,
    gasten > 0 ? `+${gasten} ${gasten === 1 ? "gast" : "gasten"}` : null,
  ].filter(Boolean);

  return (
    <div className="avond">
      <Link
        href={open ? dichtHref : openHref}
        className="avond-knop"
        aria-expanded={open}
        scroll={false}
      >
        {/* Het rondje zelf tekenen in plaats van `Avatar` gebruiken: die haalt
            de namenlijst zelf op en die hebben we hier al als prop. */}
        {kok && (
          <span className={`avatar t${tintForIn(kok, namen)}`} aria-hidden>
            {[...kok.trim()][0]?.toLocaleUpperCase("nl-NL") ?? "?"}
          </span>
        )}
        <span className={samenvatting.length > 0 ? "" : "muted"}>
          {samenvatting.length > 0 ? samenvatting.join(" · ") : "Wie kookt?"}
        </span>
        {gastnotitie && !open && <Icon icon={icons.warning} size={13} />}
      </Link>

      {open && (
        <div className="avond-uit">
          {namen.length > 0 && (
            <form action={zetKok} className="avond-koks">
              <input type="hidden" name="id" value={entryId} />
              <span className="eyebrow">Wie kookt</span>
              <div className="avond-namen">
                {namen.map((naam) => (
                  <Knop
                    key={naam}
                    name="kok"
                    value={kok === naam ? "" : naam}
                    className={`chip ${kok === naam ? "on" : ""}`}
                    aria-pressed={kok === naam}
                  >
                    {naam}
                  </Knop>
                ))}
                {kok && (
                  <Knop name="kok" value="" className="chip ghost">
                    Maakt niet uit
                  </Knop>
                )}
              </div>
            </form>
          )}

          <form action={zetGasten} className="avond-gasten">
            <input type="hidden" name="id" value={entryId} />
            <label className="field">
              <span className="eyebrow">Gasten erbij</span>
              <input
                type="number"
                name="gasten"
                min={0}
                max={20}
                defaultValue={gasten}
                inputMode="numeric"
              />
            </label>
            <label className="field">
              <span className="eyebrow">Goed om te weten</span>
              <input
                type="text"
                name="gastnotitie"
                defaultValue={gastnotitie ?? ""}
                placeholder="Ilse eet geen vis"
                autoComplete="off"
                maxLength={120}
              />
            </label>
            <Knop className="secondary" bezigLabel="…">
              Bewaren
            </Knop>
          </form>

          {gastnotitie && (
            <p className="avond-notitie">
              <Icon icon={icons.warning} size={14} />
              {gastnotitie}
            </p>
          )}

          {/* De porties schuiven mee zolang je ze niet zelf hebt gezet; dat
              staat er expliciet bij, want anders lijkt het toverij. */}
          <p className="muted hint">
            De porties gaan mee omhoog, tenzij je ze zelf hebt bijgesteld.
          </p>
        </div>
      )}
    </div>
  );
}
