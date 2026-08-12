import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { icons } from "@/lib/icons";
import { currentPerson } from "@/lib/who";
import { people as configuredPeople } from "@/lib/settings";
import { chooseWho } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wie ben jij?",
};

/**
 * Eén tik om te zeggen wie je bent.
 *
 * Geen wachtwoord: het slot zat op de voordeur en die ben je al door. Dit
 * bepaalt alleen wiens naam er bij een oordeel of een import komt te staan.
 */
export default async function WhoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const next = readOne(query.verder) ?? "/";
  const people = await configuredPeople();
  const current = await currentPerson();

  // Zonder namen valt er niets te kiezen; dan is de functie uit en hoort deze
  // pagina er ook niet te zijn.
  if (people.length === 0) redirect("/");

  return (
    <main className="gate">
      <div className="gate-card">
        <span className="gate-mark" aria-hidden>
          <Icon icon={icons.people} size={28} strokeWidth={1.2} />
        </span>
        <h1>Wie kookt er?</h1>
        <p className="muted">
          Zodat een oordeel een naam krijgt. Wisselen kan altijd, en het is geen
          tweede wachtwoord — jullie delen de app.
        </p>

        <form action={chooseWho} className="who-pick">
          <input type="hidden" name="verder" value={next.startsWith("/") ? next : "/"} />
          {people.map((person) => (
            <button
              key={person}
              type="submit"
              name="naam"
              value={person}
              className={person === current ? "on" : "secondary"}
            >
              <Avatar name={person} size={26} />
              {person}
            </button>
          ))}
        </form>

        <p className="muted small">
          <Link href={next.startsWith("/") ? next : "/"}>Overslaan</Link>
        </p>
      </div>
    </main>
  );
}

function readOne(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || null;
}
