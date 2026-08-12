"use client";

import { Misgegaan } from "@/components/Misgegaan";

/**
 * Alles buiten de app-schil: de kookmodus, het inloggen, het naamkaartje.
 * Zonder tabbalk, want die hoort daar ook niet.
 */
export default function Fout({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Misgegaan
      titel="Daar ging iets mis"
      uitleg="Dit scherm kon niet worden opgebouwd. Sta je midden in een gerecht, dan is het recept zelf niets overkomen — je kunt de kookmodus opnieuw openen."
      kenmerk={error.digest}
      opnieuw={reset}
    />
  );
}
