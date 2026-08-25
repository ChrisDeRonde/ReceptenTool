/**
 * Wat de strook onderin het weekmenu moet zeggen.
 *
 * De server actions eindigen met een `redirect` en laten hun boodschap achter
 * in de URL; zie `components/Melding.tsx` voor waarom dat zo moet. Hier wordt
 * die parameter weer tot iets leesbaars gemaakt.
 *
 * Puur, zonder database en zonder `next/headers`, zodat de vertaling van
 * parameter naar zin te testen is zonder een pagina op te bouwen — en zodat
 * rommel in de URL hier stukloopt en niet op het scherm.
 */

import { dayLabel, strikteDag } from "@/lib/menu/week";

export type Melding = {
  tekst: string;
  /** Ingevuld als de handeling terug te draaien is. */
  terug?: { recipeId: string; dag: string; porties?: string };
};

/**
 * `gedaan=gezet.2026-08-26` of `gedaan=weg` met `terug=<id>.<dag>.<porties>`.
 *
 * Alles wat niet klopt levert `null` op. Een verzonnen parameter hoort geen zin
 * op het scherm te toveren, en een half gelezen `terug` hoort geen knop op te
 * leveren die iets anders terugzet dan wat je weggooide.
 */
export function leesMelding(
  gedaan: string | null | undefined,
  terug: string | null | undefined,
): Melding | null {
  if (!gedaan) return null;

  if (gedaan.startsWith("gezet.")) {
    const dag = strikteDag(gedaan.slice("gezet.".length));
    return dag ? { tekst: `Op ${dayLabel(dag)} gezet.` } : { tekst: "Op het menu gezet." };
  }

  if (gedaan === "weg") {
    return { tekst: "Van het menu gehaald.", terug: leesTerug(terug) };
  }

  if (gedaan === "leeg") return { tekst: "De week is leeggemaakt." };

  return null;
}

function leesTerug(waarde: string | null | undefined): Melding["terug"] {
  if (!waarde) return undefined;

  // Het recept-id kan zelf geen punt bevatten (cuid), dus splitsen op punten is
  // veilig — maar we controleren het aantal delen wél, want een half gelezen
  // parameter mag geen knop opleveren die het verkeerde terugzet.
  const delen = waarde.split(".");
  if (delen.length !== 3) return undefined;

  const [recipeId, dag, porties] = delen;
  if (!recipeId || !strikteDag(dag)) return undefined;

  return {
    recipeId,
    dag,
    porties: /^\d+$/.test(porties) ? porties : undefined,
  };
}
