import { formatNumber } from "@/lib/recipe/format";

/**
 * Hoeveelheden optellen die uit verschillende recepten komen.
 *
 * Twee recepten die allebei uien willen moeten op één regel eindigen, anders
 * sta je in de winkel zelf te rekenen. Daarvoor moet je weten dat "500 g" en
 * "0,5 kg" hetzelfde zijn, en dat eetlepels en grammen dat niet zijn.
 */

/** Waar we in rekenen. Alles binnen een familie is optelbaar. */
type Family = "gewicht" | "volume" | "lepel" | "stuk";

type UnitSpec = {
  family: Family;
  /** Hoeveel basiseenheden (g, ml, tl, stuk) er in één van deze gaan. */
  factor: number;
  /** Hoe het teruggeschreven wordt als er niets omgerekend hoeft. */
  label: string;
};

/**
 * Alles wat we herkennen. De sleutel is de eenheid zoals het model hem
 * schrijft, kleine letters en zonder punt.
 */
const UNITS = new Map<string, UnitSpec>([
  ["g", { family: "gewicht", factor: 1, label: "g" }],
  ["gram", { family: "gewicht", factor: 1, label: "g" }],
  ["gr", { family: "gewicht", factor: 1, label: "g" }],
  ["kg", { family: "gewicht", factor: 1000, label: "g" }],
  ["kilo", { family: "gewicht", factor: 1000, label: "g" }],
  ["pond", { family: "gewicht", factor: 500, label: "g" }],

  ["ml", { family: "volume", factor: 1, label: "ml" }],
  ["cl", { family: "volume", factor: 10, label: "ml" }],
  ["dl", { family: "volume", factor: 100, label: "ml" }],
  ["l", { family: "volume", factor: 1000, label: "ml" }],
  ["liter", { family: "volume", factor: 1000, label: "ml" }],

  // Lepels blijven lepels: 3 tl is geen 15 ml op je boodschappenlijst.
  ["tl", { family: "lepel", factor: 1, label: "tl" }],
  ["theelepel", { family: "lepel", factor: 1, label: "tl" }],
  ["el", { family: "lepel", factor: 3, label: "tl" }],
  ["eetlepel", { family: "lepel", factor: 3, label: "tl" }],
]);

/**
 * Telbare dingen. Die hebben geen omrekening nodig, maar wél een gedeelde
 * noemer: "2 stuks ui" en "3 ui" is samen 5 ui.
 */
const COUNTABLE = new Set([
  "",
  "stuk",
  "stuks",
  "st",
  "x",
  "teentje",
  "teentjes",
  "teen",
  "tenen",
  "blaadje",
  "blaadjes",
  "takje",
  "takjes",
  "bosje",
  "bosjes",
  "blik",
  "blikken",
  "pak",
  "pakken",
  "zakje",
  "zakjes",
  "plak",
  "plakken",
  "bol",
  "bollen",
]);

export type Amount = {
  /** null = "naar smaak", "een snufje": geen getal om op te tellen. */
  quantity: number | null;
  unit: string | null;
};

/**
 * De sleutel waarop twee hoeveelheden optelbaar zijn. Verschillende sleutels
 * betekent: twee regels, want 200 g bloem en 2 el bloem gaan niet samen.
 */
export function amountKey(amount: Amount): string {
  const unit = cleanUnit(amount.unit);
  const spec = UNITS.get(unit);
  if (spec) return spec.family;
  if (COUNTABLE.has(unit)) return `stuk:${unit || "los"}`;
  // Onbekende eenheid ("snufje", "handvol"): alleen met zichzelf optelbaar.
  return `overig:${unit}`;
}

/** Telt twee hoeveelheden bij elkaar op. Aanroepen met gelijke `amountKey`. */
export function addAmounts(a: Amount, b: Amount): Amount {
  // Eén van de twee heeft geen getal ("zout, naar smaak"): dan blijft het
  // zonder getal staan. Optellen bij "onbekend" levert niets zinnigs op.
  if (a.quantity === null || b.quantity === null) {
    return { quantity: null, unit: a.unit ?? b.unit };
  }

  const specA = UNITS.get(cleanUnit(a.unit));
  const specB = UNITS.get(cleanUnit(b.unit));

  if (specA && specB) {
    const total = a.quantity * specA.factor + b.quantity * specB.factor;
    return { quantity: total, unit: specA.label };
  }

  // Telbaar of onbekend: eenheden zijn hier per definitie gelijk.
  return { quantity: a.quantity + b.quantity, unit: a.unit ?? b.unit };
}

/**
 * Hoe het in de winkel op je scherm staat. Grote getallen krijgen de grotere
 * eenheid terug: 1500 g leest als 1,5 kg, 45 tl als 15 el.
 */
export function formatAmount(amount: Amount): string {
  if (amount.quantity === null) {
    // Zonder getal is een maateenheid zinloos: "g" op je lijst zegt niets.
    // Een omschrijving als "snufje" of "bosje" wél, dus die blijft staan.
    const unit = cleanUnit(amount.unit);
    return unit && !UNITS.has(unit) ? (amount.unit ?? "") : "";
  }

  const unit = cleanUnit(amount.unit);
  const value = amount.quantity;

  if ((unit === "g" || unit === "gram") && value >= 1000) {
    return `${formatNumber(round(value / 1000, 2))} kg`;
  }
  if (unit === "ml" && value >= 1000) {
    return `${formatNumber(round(value / 1000, 2))} l`;
  }
  if (unit === "tl" && value >= 3) {
    const spoons = value / 3;
    // Alleen als het netjes uitkomt; 4 tl blijft 4 tl.
    if (Math.abs(spoons - Math.round(spoons * 4) / 4) < 0.01) {
      return `${formatNumber(round(spoons, 2))} el`;
    }
  }

  return [formatNumber(round(value, 2)), amount.unit].filter(Boolean).join(" ");
}

function cleanUnit(unit: string | null | undefined): string {
  return (unit ?? "").trim().toLowerCase().replace(/\.$/, "");
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Twee keer hetzelfde ingrediënt herkennen, ook als het ene recept "Uien"
 * schrijft en het andere "ui".
 *
 * Bewust een vaste tabel en geen slimme meervoudsregel: Nederlands is daar te
 * grillig voor ("ananas" is geen meervoud, "eieren" wel), en een verkeerde gok
 * voegt twee dingen samen die niet samenhoren. Mis je iets, zet het erbij.
 */
const SINGULARS = new Map<string, string>([
  ["uien", "ui"],
  ["rode uien", "rode ui"],
  ["sjalotten", "sjalot"],
  ["tomaten", "tomaat"],
  ["trostomaten", "trostomaat"],
  ["aardappelen", "aardappel"],
  ["aardappels", "aardappel"],
  ["wortels", "wortel"],
  ["wortelen", "wortel"],
  ["paprika's", "paprika"],
  ["courgettes", "courgette"],
  ["aubergines", "aubergine"],
  ["champignons", "champignon"],
  ["citroenen", "citroen"],
  ["limoenen", "limoen"],
  ["sinaasappels", "sinaasappel"],
  ["appels", "appel"],
  ["peren", "peer"],
  ["bananen", "banaan"],
  ["eieren", "ei"],
  ["teentjes knoflook", "knoflook"],
  ["tenen knoflook", "knoflook"],
  ["knoflookteentjes", "knoflook"],
  ["preien", "prei"],
  ["venkels", "venkel"],
  ["komkommers", "komkommer"],
  ["kipfilets", "kipfilet"],
  ["worteltjes", "wortel"],
  ["blikken tomatenblokjes", "tomatenblokjes"],
]);

/** Kleine letters, zonder lidwoord, meervoud waar we het zeker weten. */
export function canonicalName(name: string): string {
  const clean = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^(de|het|een)\s+/, "");

  const heel = SINGULARS.get(clean);
  if (heel) return heel;

  // Ook als er een bijvoeglijk naamwoord voor staat: "rode paprika's" hoort op
  // dezelfde regel te belanden als "rode paprika". De tabel blijft de
  // autoriteit — we passen hem alleen toe op het laatste woord, want daar zit
  // in het Nederlands de kern.
  const spatie = clean.lastIndexOf(" ");
  if (spatie > 0) {
    const kern = SINGULARS.get(clean.slice(spatie + 1));
    if (kern) return `${clean.slice(0, spatie)} ${kern}`;
  }

  return clean;
}
