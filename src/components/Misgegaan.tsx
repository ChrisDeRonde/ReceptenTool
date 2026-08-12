"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { icons } from "@/lib/icons";

/**
 * Het scherm als er iets stukging.
 *
 * Er zijn maar twee dingen die hier moeten gebeuren: zeggen dat het aan ons
 * ligt en niet aan jou, en een weg terug bieden. Geen stacktrace, geen
 * excuusverhaal, geen tekening van een omgevallen pannetje.
 *
 * Wel het kenmerk van de fout, als Next er een meegeeft. In productie krijgt de
 * browser de melding zelf niet te zien — die staat alleen in het serverlog — en
 * dan is dat korte nummer het enige waarmee je de twee aan elkaar knoopt.
 */
export function Misgegaan({
  titel,
  uitleg,
  kenmerk,
  opnieuw,
}: {
  titel: string;
  uitleg: string;
  /** `error.digest` van Next; verwijst naar de regel in het serverlog. */
  kenmerk?: string;
  /** Next' eigen `reset`: probeert dit stuk pagina nog eens op te bouwen. */
  opnieuw?: () => void;
}) {
  return (
    <main className="misgegaan">
      <span className="misgegaan-mark" aria-hidden>
        <Icon icon={icons.plate} size={26} strokeWidth={1.3} />
      </span>
      <h1>{titel}</h1>
      <p className="muted">{uitleg}</p>

      <div className="row">
        {opnieuw && (
          <button type="button" onClick={opnieuw}>
            <Icon icon={icons.reset} size={17} />
            Opnieuw proberen
          </button>
        )}
        <Link href="/" className={`button ${opnieuw ? "secondary" : ""}`}>
          Naar de recepten
        </Link>
      </div>

      {kenmerk && <p className="misgegaan-kenmerk">Kenmerk {kenmerk}</p>}
    </main>
  );
}
