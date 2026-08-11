import type { Ingredient } from "./schema";

/**
 * Een getypte hoeveelheid terug naar getal en eenheid.
 *
 * Dit is de tegenhanger van `formatAmount` in format.ts. In het bewerkscherm
 * staat de hoeveelheid als één veldje — je typt "300 g", niet een getal in het
 * ene vakje en een eenheid in het andere — dus moet dat er hier weer uit
 * gepeuterd worden. Alles wat `formatAmount` kan opleveren moet er ongeschonden
 * doorheen komen: open je een recept, sla je het op zonder iets te wijzigen,
 * dan hoort er geen letter veranderd te zijn.
 */

/** Wat formatNumber ervan maakt, en terug. */
const FRACTIONS = new Map<string, number>([
  ["¼", 0.25],
  ["⅓", 1 / 3],
  ["½", 0.5],
  ["⅔", 2 / 3],
  ["¾", 0.75],
]);

/**
 * "2-3 el" is geen getal maar een marge, en die valt niet te schalen. In
 * plaats van er stiekem 2 van te maken blijft de hele tekst als eenheid staan:
 * op het scherm klopt het, en het recept doet niet alsof het preciezer is dan
 * het is.
 */
const RANGE = /^\d+(?:[.,]\d+)?\s*[-–—]\s*\d/;

export function parseAmount(raw: string): { quantity: number | null; unit: string | null } {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return { quantity: null, unit: null };
  if (RANGE.test(text)) return { quantity: null, unit: text };

  // "1½", "½", "1 ½"
  const withFraction = /^(\d+)?\s*([¼⅓½⅔¾])\s*(.*)$/.exec(text);
  if (withFraction) {
    const whole = withFraction[1] ? Number(withFraction[1]) : 0;
    return {
      quantity: whole + (FRACTIONS.get(withFraction[2]) ?? 0),
      unit: rest(withFraction[3]),
    };
  }

  // "1/2", "3 / 4"
  const asFraction = /^(\d+)\s*\/\s*(\d+)\s*(.*)$/.exec(text);
  if (asFraction) {
    const denominator = Number(asFraction[2]);
    if (denominator > 0) {
      return {
        quantity: Number(asFraction[1]) / denominator,
        unit: rest(asFraction[3]),
      };
    }
  }

  // "300", "0,5", "1.25"
  const plain = /^(\d+(?:[.,]\d+)?)\s*(.*)$/.exec(text);
  if (plain) {
    return {
      quantity: Number(plain[1].replace(",", ".")),
      unit: rest(plain[2]),
    };
  }

  // Geen getal: dan is het hele ding een maat. "snufje", "naar smaak".
  return { quantity: null, unit: text };
}

function rest(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Eén ingrediënt uit de drie velden van het bewerkscherm. */
export function ingredientFromFields(fields: {
  amount: string;
  name: string;
  note: string;
}): Ingredient | null {
  const name = fields.name.trim().replace(/\s+/g, " ");
  // Zonder naam is het geen ingrediënt maar een lege regel die je bent
  // vergeten weg te halen.
  if (!name) return null;

  const { quantity, unit } = parseAmount(fields.amount);
  const note = fields.note.trim();
  return { quantity, unit, name, note: note ? note : null };
}
