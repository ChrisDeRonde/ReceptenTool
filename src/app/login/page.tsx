import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import { icons } from "@/lib/icons";
import { MIN_PASSWORD_LENGTH, configuredPassword } from "@/lib/session";
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
