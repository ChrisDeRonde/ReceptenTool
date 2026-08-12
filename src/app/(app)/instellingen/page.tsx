import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { Vastkop } from "@/components/Vastkop";
import { icons } from "@/lib/icons";
import {
  HUISHOUDEN_MAX,
  huishouden,
  people,
  peopleSource,
} from "@/lib/settings";
import { saveSettings } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Wat je zonder bestand te bewerken kunt bijstellen.
 *
 * En, even belangrijk: wat níét. De geheimen staan onderaan in een leeslijst,
 * met per stuk of hij is ingevuld — zodat je kunt zien hoe de app erbij staat
 * zonder dat dit scherm ze kan wijzigen.
 */
export default async function InstellingenPagina() {
  const [thuis, namen, herkomst] = await Promise.all([
    huishouden(),
    people(),
    peopleSource(),
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
