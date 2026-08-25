"use client";

import { useEffect, useState } from "react";

/** Eén regel op de lijst, zoals de pagina hem aanlevert. */
export type Regel = {
  naam: string;
  hoeveelheid: string;
  uit: string[];
  /** Zwangerschapsoordeel, als het vinkje aanstaat. Zie lib/zwanger.ts. */
  let_op?: { niveau: string; label: string; waarom: string } | null;
};

export type Vak = { sleutel: string; kop: string; regels: Regel[] };

/**
 * De boodschappenlijst, met een streep door wat al in de kar ligt.
 *
 * **Waarom dit er eerst niet was, en waarom nu wel.** In de code stond: "Deze
 * app draait op een servertje thuis; in de winkel wil je iets dat het altijd
 * doet, ook zonder bereik." Dat klopte. Alleen is de premisse veranderd — er
 * is nu een service worker, en de native app krijgt een eigen kast. En het
 * afvinken hoeft de server sowieso niet te halen: het staat in
 * `localStorage`, dus het werkt in een supermarktkelder zonder bereik net zo
 * goed als thuis.
 *
 * **Waarom niet in de database, terwijl zelf toegevoegde regels dat wél zijn.**
 * Afvinken is van jouw kant van de winkel: jij hebt de boerenkool in de kar,
 * niet je huisgenoot die thuis op de bank zit. Zou het gedeeld zijn, dan zag je
 * regels wegstrepen die jij nog moet pakken. Toevoegen is precies andersom —
 * wat de één erbij zet moet de ander zien. Twee soorten gegevens, twee plekken.
 *
 * Per week bewaard en niet per regel-id, want die id's bestaan niet: de lijst
 * wordt bij elke weergave opnieuw berekend. De sleutel is naam plus
 * hoeveelheid; verandert het weekmenu, dan klopt een enkel vinkje niet meer en
 * dat is de goede uitkomst — er ligt dan ook werkelijk iets anders in de kar.
 */
export function Afvinklijst({
  vakken,
  week,
  meerdereGerechten,
}: {
  vakken: Vak[];
  week: string;
  meerdereGerechten: boolean;
}) {
  const bewaarplek = `klapper:boodschappen:${week}`;
  const [af, setAf] = useState<Set<string>>(new Set());
  const [geladen, setGeladen] = useState(false);

  // Pas ná de eerste weergave lezen. Zou dit tijdens het renderen gebeuren, dan
  // verschilt de server-HTML van wat de browser tekent en klaagt React.
  useEffect(() => {
    try {
      const ruw = localStorage.getItem(bewaarplek);
      if (ruw) setAf(new Set(JSON.parse(ruw) as string[]));
    } catch {
      // Privémodus, of rommel in de opslag. Dan begint de lijst schoon; er
      // gaat niets verloren wat niet met één tik terug te zetten is.
    }
    setGeladen(true);
  }, [bewaarplek]);

  const wissel = (sleutel: string) => {
    setAf((vorige) => {
      const volgende = new Set(vorige);
      if (volgende.has(sleutel)) volgende.delete(sleutel);
      else volgende.add(sleutel);
      try {
        localStorage.setItem(bewaarplek, JSON.stringify([...volgende]));
      } catch {
        // Niet kunnen bewaren is vervelend maar niet fataal: binnen deze
        // sessie blijft de streep gewoon staan.
      }
      return volgende;
    });
  };

  const alles = vakken.reduce((som, vak) => som + vak.regels.length, 0);
  const klaar = af.size;

  return (
    <>
      {geladen && klaar > 0 && (
        <div className="afvink-stand">
          <div
            className="afvink-balk"
            role="progressbar"
            aria-valuenow={klaar}
            aria-valuemin={0}
            aria-valuemax={alles}
            aria-label="Hoeveel je al hebt"
          >
            <span style={{ width: `${(klaar / Math.max(alles, 1)) * 100}%` }} />
          </div>
          <p>
            {klaar} van de {alles}
            {klaar === alles && " — alles binnen."}
            {klaar < alles && (
              <button type="button" className="linky" onClick={() => {
                setAf(new Set());
                try { localStorage.removeItem(bewaarplek); } catch { /* zie boven */ }
              }}>
                Alles terugzetten
              </button>
            )}
          </p>
        </div>
      )}

      <div className="list">
        {vakken.map((vak) => (
          <section key={vak.sleutel} className="aisle">
            <h2 className="eyebrow">{vak.kop}</h2>
            <ul>
              {vak.regels.map((regel) => {
                const sleutel = `${regel.naam}|${regel.hoeveelheid}`;
                const uit = af.has(sleutel);
                return (
                  <li key={sleutel} className={uit ? "af" : undefined}>
                    {/* Een label om de hele regel: in een winkel mik je niet op
                        een vakje van twintig pixels. */}
                    <label>
                      <input
                        type="checkbox"
                        checked={uit}
                        onChange={() => wissel(sleutel)}
                      />
                      <span className="what">
                        <span className="name">
                          {regel.naam}
                          {regel.let_op && (
                            <span className={`zw-vlag ${regel.let_op.niveau}`}>
                              {regel.let_op.label}
                            </span>
                          )}
                        </span>
                        {regel.let_op && (
                          <span className="zw-waarom">{regel.let_op.waarom}</span>
                        )}
                        {meerdereGerechten && (
                          <span className="from">{regel.uit.join(" · ")}</span>
                        )}
                      </span>
                      <span className="amount">{regel.hoeveelheid}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
