"use client";

import { Misgegaan } from "@/components/Misgegaan";

/**
 * Een pagina binnen de app die stukliep. De tabbalk blijft staan — dit vangt
 * alleen het middenstuk op, dus je bent niet uit de app gevallen.
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
      uitleg="Deze pagina kon niet worden opgebouwd. Meestal helpt het om het nog een keer te proberen; jouw recepten staan gewoon nog in de database."
      kenmerk={error.digest}
      opnieuw={reset}
    />
  );
}
