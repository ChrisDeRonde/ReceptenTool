"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { icons } from "@/lib/icons";

/** Hoe lang de strook blijft staan. Lang genoeg om te lezen én te bedenken. */
const SECONDEN = 10;

/**
 * De strook onderin die vertelt wat er net gebeurde.
 *
 * Twee dingen tegelijk, en dat is met opzet één ding geworden. Bevestigen —
 * "Op woensdag gezet" — en terugdraaien — "Van het menu gehaald · Ongedaan
 * maken". Het weekmenu is een scherm waar je van alles heen en weer schuift;
 * daar is bij elke handeling om bevestiging vragen te zwaar, en niets zeggen
 * te weinig. Achteraf mogen terugkrabbelen is precies het midden.
 *
 * **Waarom via de URL en niet via een toestand in het geheugen.** Een server
 * action eindigt met een `redirect`, en daarna is er geen component meer die
 * zich nog iets herinnert. Wat de actie in de URL zet overleeft dat wél. Het
 * kost een lelijke parameter voor de duur van één weergave, en het levert een
 * strook op die het ook doet als je de pagina herlaadt of doorstuurt.
 *
 * Zonder JavaScript blijft de strook gewoon staan met een kruisje dat naar de
 * schone URL wijst. Het terugdraaien zelf is een formulier met een server
 * action erachter, dus dat werkt daar ook.
 */
export function Melding({
  tekst,
  children,
}: {
  tekst: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [weg, setWeg] = useState(false);

  // De parameters uit de URL halen zonder een nieuwe stap in de
  // geschiedenis: anders staat de melding er weer zodra je op terug drukt.
  const schoon = () => {
    const over = new URLSearchParams(params.toString());
    over.delete("gedaan");
    over.delete("terug");
    const vraag = over.toString();
    router.replace(vraag ? `?${vraag}` : window.location.pathname, { scroll: false });
  };

  useEffect(() => {
    const klok = setTimeout(() => {
      setWeg(true);
      schoon();
    }, SECONDEN * 1000);
    return () => clearTimeout(klok);
    // Alleen opnieuw beginnen als er werkelijk iets anders gemeld wordt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tekst]);

  if (weg) return null;

  return (
    // `status` en niet `alert`: dit onderbreekt niets en hoort beleefd
    // voorgelezen te worden, na wat de gebruiker zelf aan het doen was.
    <div className="melding" role="status">
      <span className="melding-tekst">{tekst}</span>
      {children}
      <button
        type="button"
        className="melding-weg"
        onClick={() => {
          setWeg(true);
          schoon();
        }}
        aria-label="Melding sluiten"
      >
        <Icon icon={icons.close} size={15} />
      </button>
    </div>
  );
}
