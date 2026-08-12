import type { Metadata } from "next";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { icons } from "@/lib/icons";
import { MIN_PASSWORD_LENGTH, configuredPassword } from "@/lib/session";
import { people } from "@/lib/settings";
import { bekendeNaam } from "@/lib/people";
import { currentPerson } from "@/lib/who";
import { login } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inloggen",
  // Deze pagina is de enige die van buiten te zien is; hem laten indexeren
  // heeft geen enkel nut.
  robots: { index: false, follow: false },
};

const MESSAGES: Record<string, string> = {
  "1": "Dat wachtwoord klopt niet.",
  teveel: "Te veel pogingen. Probeer het over tien minuten opnieuw.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const error = readOne(query.fout);
  const next = readOne(query.verder) ?? "/";
  const configured = configuredPassword() !== null;

  const namen = await people();
  // Wie er voorgeselecteerd staat: wie je zei te zijn bij de vorige poging,
  // anders wie dit toestel al kende. Uitloggen wist het naamkaartje niet, dus
  // op je eigen telefoon staat je gezicht hier gewoon aangetikt.
  const voorgekozen =
    bekendeNaam(readOne(query.naam), namen) ?? (await currentPerson());

  return (
    <main className="gate">
      <div className="gate-card">
        <span className="gate-mark" aria-hidden>
          <Icon icon={icons.plate} size={30} strokeWidth={1.2} />
        </span>
        <h1>Recepten</h1>

        {configured ? (
          <>
            <p className="muted">Even bevestigen dat jij het bent.</p>

            <form action={login} className="stack">
              <input type="hidden" name="verder" value={next.startsWith("/") ? next : "/"} />

              {/* Het gezicht en het wachtwoord op één scherm. Het wachtwoord is
                  het slot en dat delen jullie; de keuze erboven is het
                  naamkaartje, zodat een oordeel in de kooklog van iemand is.
                  Radioknoppen en geen aparte pagina: dan hoort de keuze bij dít
                  formulier, blijft hij staan als het wachtwoord misging, en
                  werkt hij zonder een regel JavaScript. */}
              {namen.length > 0 && (
                <fieldset className="wie-veld">
                  <legend>Wie ben jij?</legend>
                  <div className="wie-rij">
                    {namen.map((persoon) => (
                      <label key={persoon} className="wie-tegel">
                        <input
                          type="radio"
                          name="naam"
                          value={persoon}
                          defaultChecked={persoon === voorgekozen}
                        />
                        <Avatar name={persoon} size={46} withName />
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <input
                type="password"
                name="wachtwoord"
                placeholder="Wachtwoord"
                autoComplete="current-password"
                aria-label="Wachtwoord"
                autoFocus
                required
              />
              <button type="submit">Inloggen</button>
            </form>

            {error && (
              <p className="notice" role="alert">
                {MESSAGES[error] ?? "Er ging iets mis."}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="muted">Deze app heeft nog geen wachtwoord.</p>
            <p className="notice">
              Zet <code>APP_PASSWORD</code> in <code>.env</code> — minstens{" "}
              {MIN_PASSWORD_LENGTH} tekens — en start de app opnieuw. Zolang dat
              er niet staat blijft alles op slot, want een app zonder wachtwoord
              is een app waar iedereen recepten kan verwijderen.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function readOne(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || null;
}
