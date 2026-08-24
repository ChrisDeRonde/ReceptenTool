import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { Vastkop } from "@/components/Vastkop";
import { icons } from "@/lib/icons";
import { DIETS, DIET_HINTS, DIET_LABELS } from "@/lib/recipe/categories";
import {
  HUISHOUDEN_MAX,
  huishouden,
  people,
  peopleSource,
  voorkeuren,
} from "@/lib/settings";
import { LEEG } from "@/lib/voorkeuren";
import { BRON } from "@/lib/zwanger";
import { saveSettings } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Instellingen" };

/**
 * Wat je zonder bestand te bewerken kunt bijstellen.
 *
 * En, even belangrijk: wat níét. De geheimen staan onderaan in een leeslijst,
 * met per stuk of hij is ingevuld — zodat je kunt zien hoe de app erbij staat
 * zonder dat dit scherm ze kan wijzigen.
 */
export default async function InstellingenPagina() {
  const [thuis, namen, herkomst, wensen] = await Promise.all([
    huishouden(),
    people(),
    peopleSource(),
    voorkeuren(),
  ]);

  const geheimen = [
    {
      naam: "APP_PASSWORD",
      wat: "Het wachtwoord voor de voordeur.",
      gezet: (process.env.APP_PASSWORD ?? "").length >= 8,
    },
    {
      naam: "ANTHROPIC_API_KEY",
      wat: "Zonder deze mislukt elke import.",
      gezet: (process.env.ANTHROPIC_API_KEY ?? "").startsWith("sk-"),
    },
    {
      naam: "INGEST_TOKEN",
      wat: "Het geheim dat de iOS-Shortcut meestuurt.",
      gezet: (process.env.INGEST_TOKEN ?? "").length >= 16,
    },
    {
      naam: "APP_BASE_URL",
      wat: "Op https zet het inlogkoekje de Secure-vlag.",
      gezet: (process.env.APP_BASE_URL ?? "").startsWith("https://"),
    },
  ];

  return (
    <main>
      <Link href="/ik" className="back">
        <Icon icon={icons.back} size={16} />
        Terug
      </Link>

      <div className="page-head">
        <h1>Instellingen</h1>
        <p>Voorkeuren staan in de database, geheimen in een bestand.</p>
      </div>
      <Vastkop titel="Instellingen" />

      <form action={saveSettings} className="editor">
        <section>
          <h2 className="section" style={{ marginTop: 0 }}>
            Huishouden
          </h2>
          <p className="muted hint">
            Voor hoeveel mensen kook je meestal? Dit is voortaan de standaard
            voor een gerecht op het weekmenu, en daarmee ook voor de
            boodschappenlijst. Per avond kun je er nog van afwijken — voor als
            er iemand blijft eten, of juist niet.
          </p>
          <label className="field" style={{ maxWidth: "9rem" }}>
            <span className="eyebrow">Personen</span>
            <input
              type="number"
              name="huishouden"
              min={1}
              max={HUISHOUDEN_MAX}
              defaultValue={thuis}
              required
            />
          </label>
        </section>

        <section>
          <h2 className="section">Wie gebruiken de app</h2>
          <p className="muted hint">
            Gescheiden door komma&apos;s. De volgorde bepaalt welke kleur bij wie
            hoort. Laat je dit leeg, dan vraagt de app niets meer en blijft alles
            naamloos — het is een naamkaartje, geen slot.
          </p>
          {/* Boven het veld en niet eronder: de zwevende opslaanknop dekt
              anders precies deze melding af. */}
          {herkomst === "omgeving" && (
            <p className="notice">
              Deze namen komen nu uit <code>APP_USERS</code> in <code>.env</code>.
              Sla je hier iets op, dan neemt de app het over en kijkt hij niet
              meer naar dat bestand.
            </p>
          )}

          <label className="field">
            <span className="eyebrow">Namen</span>
            <input
              type="text"
              name="personen"
              defaultValue={namen.join(", ")}
              placeholder="Chris, Sanne"
            />
          </label>

          {namen.length > 0 && (
            <div className="namen-voorbeeld">
              {namen.map((naam) => (
                <Avatar key={naam} name={naam} size={28} withName />
              ))}
            </div>
          )}
        </section>

        {namen.length > 0 && (
          <section>
            <h2 className="section">Wat eet wie niet</h2>
            <p className="muted hint">
              Hiermee houden de voorstellen op het weekmenu rekening. Het
              overzicht blijft alles tonen — dit is een voorkeur, geen slot op
              je eigen collectie.
            </p>
            <p className="muted hint">
              <strong>Het verschil telt.</strong> Een dieet wordt vergeleken met
              het etiket dat het model uit de ingrediënten afleidde, en dat is
              een inschatting. Wat je bij <em>niet in mijn eten</em> zet, wordt
              vergeleken met de ingrediënten zelf. Wat iemand écht moet
              vermijden, hoort daar.
            </p>
            <p className="muted hint">
              <strong>Het zwangerschapsvinkje</strong> zet bij elk recept een
              waarschuwing aan voor ingrediënten die dan beter kunnen wachten.
              Het filtert niets weg en het is geen medisch advies — het is de
              lijst van het {BRON.split(",")[0]} naast je ingrediënten gelegd,
              zodat je niet elke keer hoeft te zoeken. Twijfel je, vraag het je
              verloskundige.
            </p>

            <div className="wensen">
              {namen.map((naam) => {
                const wens = wensen[naam] ?? LEEG;
                return (
                  <fieldset key={naam} className="wens">
                    <legend>
                      <Avatar name={naam} size={26} withName />
                    </legend>

                    <div className="checks">
                      {DIETS.map((diet) => (
                        <label key={diet} className="check" title={DIET_HINTS[diet]}>
                          <input
                            type="checkbox"
                            name={`dieet:${naam}`}
                            value={diet}
                            defaultChecked={wens.dieet.includes(diet)}
                          />
                          <span>{DIET_LABELS[diet]}</span>
                        </label>
                      ))}
                    </div>

                    <label className="field">
                      <span className="eyebrow">Niet in mijn eten</span>
                      <input
                        type="text"
                        name={`afkeer:${naam}`}
                        defaultValue={wens.afkeer.join(", ")}
                        placeholder="varkensvlees, koriander"
                        autoComplete="off"
                      />
                    </label>

                    {/* Apart van de dieetvinkjes, want het is iets anders: het
                        is tijdelijk, en het zet een waarschuwing áán in plaats
                        van recepten weg te filteren. */}
                    <label className="zwanger-schakelaar">
                      <input
                        type="checkbox"
                        name={`zwanger:${naam}`}
                        value="aan"
                        defaultChecked={wens.zwanger}
                      />
                      <span className="zwanger-tekst">
                        <strong>Ik ben zwanger</strong>
                        <span className="muted">
                          Zet bij elk recept een waarschuwing aan bij
                          ingrediënten die dan beter kunnen wachten.
                        </span>
                      </span>
                    </label>
                  </fieldset>
                );
              })}
            </div>
          </section>
        )}

        <div className="editor-bar">
          <button type="submit" className="grow">
            <Icon icon={icons.done} size={17} />
            Opslaan
          </button>
        </div>
      </form>

      <section>
        <h2 className="section">Uit het bestand</h2>
        <p className="muted hint">
          Deze staan in <code>.env</code> en zijn hier met opzet niet te
          wijzigen: een formulier dat het wachtwoord kan aanpassen is een
          formulier waarmee iemand die binnen is jou eruit kan zetten. Je ziet
          alleen óf ze ingevuld zijn.
        </p>
        <ul className="geheimen">
          {geheimen.map((geheim) => (
            <li key={geheim.naam}>
              <span className={`stip ${geheim.gezet ? "ok" : "bad"}`} aria-hidden />
              <code>{geheim.naam}</code>
              <span className="muted">{geheim.wat}</span>
              <span className="staat">{geheim.gezet ? "ingevuld" : "ontbreekt"}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
