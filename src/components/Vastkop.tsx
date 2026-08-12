"use client";

import { useEffect, useRef, useState } from "react";

/**
 * De kop die blijft staan.
 *
 * Zodra de echte titel het beeld uit is schuift er bovenaan een smalle balk in
 * met dezelfde titel erin. Dat is het enige wat hij doet: zeggen waar je bent.
 * Niet navigeren — daar is de tabbalk voor, en een knop in een balk die je
 * alleen ziet als je gescrold hebt is een knop die je niet vindt.
 *
 * Waarom niet gewoon de echte kop `position: sticky`? Die is twee regels hoog
 * en houdt dus een tiende van het scherm bezet terwijl je een ingrediëntenlijst
 * leest. Deze balk is één regel en er alleen als je hem nodig hebt.
 *
 * Zonder JavaScript gebeurt er niets: de balk blijft buiten beeld en de pagina
 * werkt als altijd. Dat is de reden dat dit een balk erbij is en geen andere
 * opmaak van de kop die er al staat.
 */
export function Vastkop({ titel, meta }: { titel: string; meta?: string }) {
  const [grens, voorbij] = useVoorbijGescrold();

  return (
    <>
      <div ref={grens} className="kop-grens" aria-hidden />
      {/* Altijd aria-hidden: de titel staat al in de h1 hierboven, en twee keer
          dezelfde kop voorlezen helpt niemand. */}
      <div className={`vastkop ${voorbij ? "op" : ""}`} aria-hidden>
        <div className="vastkop-in">
          <span className="vastkop-titel">{titel}</span>
          {meta && <span className="vastkop-meta">{meta}</span>}
        </div>
      </div>
    </>
  );
}

/**
 * Is dit punt in de pagina naar boven weggescrold?
 *
 * Hang de ref aan een streepje op de plek waar de kop ophoudt. Een
 * IntersectionObserver en geen scroll-luisteraar: die laatste vuurt bij elke
 * pixel en dwingt de browser tot rekenen op precies het moment dat hij aan het
 * schuiven is.
 *
 * Het streepje is één pixel hoog en niet nul: een element zonder oppervlak
 * haalt in sommige browsers nooit een verhouding boven nul en zou dus nooit
 * "in beeld" zijn.
 */
export function useVoorbijGescrold(): [
  React.RefObject<HTMLDivElement | null>,
  boolean,
] {
  const grens = useRef<HTMLDivElement>(null);
  const [voorbij, setVoorbij] = useState(false);

  useEffect(() => {
    const element = grens.current;
    if (!element) return;

    const kijker = new IntersectionObserver(
      ([item]) => {
        // Alleen naar bóven weggescrold telt. Zonder die tweede voorwaarde
        // staat de balk er ook als het streepje nog onder het beeld hangt —
        // dat is bij een korte pagina die net geladen is.
        setVoorbij(!item.isIntersecting && item.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );

    kijker.observe(element);
    return () => kijker.disconnect();
  }, []);

  return [grens, voorbij];
}
