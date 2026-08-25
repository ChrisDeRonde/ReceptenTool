"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Hoe vaak we kijken. Genoeg om levend te voelen, weinig genoeg om niets te kosten. */
const TUSSENPOOS = 3000;

/** Na zo lang ophouden. Blijft het dan nog hangen, dan is er iets anders mis. */
const GEDULD = 3 * 60 * 1000;

/**
 * De pagina laten verversen zolang er iets in behandeling is.
 *
 * De inbox toonde netjes de status *Bezig*, maar ververste niet uit zichzelf.
 * Je deelde iets, opende de inbox, en er gebeurde schijnbaar niets — terwijl
 * het model gewoon aan het werk was. Dat is precies het scherm waar wachten
 * hoort, dus het is ook het scherm dat zichzelf hoort bij te werken.
 *
 * `router.refresh()` en geen `location.reload()`: dat haalt alleen de
 * server-componenten opnieuw op en laat je scrollpositie en je half ingetypte
 * tekstvak met rust.
 *
 * Er zit een grens op. Een item dat na drie minuten nog op *Bezig* staat, komt
 * er niet meer vanzelf; dan is doorpollen alleen een pagina die zichzelf tot
 * in de eeuwigheid ophaalt terwijl er niemand meer kijkt.
 */
export function Verversen({ actief }: { actief: boolean }) {
  const router = useRouter();
  const [opgegeven, setOpgegeven] = useState(false);

  useEffect(() => {
    if (!actief || opgegeven) return;

    // Overslaan in een tabblad dat niemand ziet, en meteen bijwerken zodra je
    // terugkomt. Doorpollen in de achtergrond is de helft van de pollende
    // pagina's op deze wereld en het levert nooit iets op.
    const tik = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, TUSSENPOOS);
    const stop = setTimeout(() => setOpgegeven(true), GEDULD);

    const bijWisselen = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", bijWisselen);

    return () => {
      clearInterval(tik);
      clearTimeout(stop);
      document.removeEventListener("visibilitychange", bijWisselen);
    };
  }, [actief, opgegeven, router]);

  return null;
}
