/**
 * Weken en dagen.
 *
 * Een week begint hier op maandag en loopt op lokale tijd van de server. Geen
 * tijdzone-machinerie: dit is een huishoudplanner, geen agenda-app, en jullie
 * staan allebei in dezelfde keuken.
 */

const DAY_NAMES = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const MONTH_NAMES = [
  "jan", "feb", "mrt", "apr", "mei", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
];

/** Middernacht op de dag zelf, zodat twee gerechten op één dag gelijk sorteren. */
export function midnight(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** De maandag van de week waar deze dag in valt. */
export function startOfWeek(date: Date): Date {
  const start = midnight(date);
  // getDay(): zondag is 0. Zondag hoort bij de wéék ervoor, dus zes dagen terug.
  const shift = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - shift);
  return start;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function weekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/** "2026-08-11" — wat er in de URL staat. */
export function toParam(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Leest een dag, maar geeft `null` terug in plaats van vandaag.
 *
 * Voor de JSON-laag. Op een webpagina is terugvallen op vandaag prima — je ziet
 * meteen welke week er staat en je klikt door. Bij `POST /api/v1/weekmenu` is
 * het dat niet: daar levert een dag die niet klopt een 201 op met het gerecht
 * op de verkeerde datum, en dat merk je pas als het weekmenu er raar uitziet.
 *
 * Strenger dan `fromParam` op twee punten: de vorm moet exact `2026-08-16` zijn
 * (dus mét voorloopnullen), en de onderdelen moeten terugkomen zoals ze erin
 * gingen. Dat laatste vangt `2026-13-45`, waar `new Date` zonder klagen
 * 2027-02-14 van maakt.
 */
export function strikteDag(waarde: unknown): Date | null {
  if (typeof waarde !== "string") return null;
  const match = waarde.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const jaar = Number(match[1]);
  const maand = Number(match[2]);
  const dag = Number(match[3]);
  const datum = new Date(jaar, maand - 1, dag);

  if (
    datum.getFullYear() !== jaar ||
    datum.getMonth() !== maand - 1 ||
    datum.getDate() !== dag
  ) {
    return null;
  }
  return midnight(datum);
}

/** Leest een dag uit de URL; onzin levert vandaag op. */
export function fromParam(value: string | string[] | undefined): Date {
  const raw = Array.isArray(value) ? value[0] : value;
  const match = raw?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return midnight(new Date());

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return Number.isNaN(date.getTime()) ? midnight(new Date()) : midnight(date);
}

/** "ma 11 aug" */
export function dayLabel(date: Date): string {
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

/** "11 – 17 augustus" of "29 sep – 5 okt" als de week over een maandgrens loopt. */
export function weekLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  return sameMonth
    ? `${monday.getDate()} – ${sunday.getDate()} ${MONTH_NAMES[sunday.getMonth()]}`
    : `${monday.getDate()} ${MONTH_NAMES[monday.getMonth()]} – ${sunday.getDate()} ${MONTH_NAMES[sunday.getMonth()]}`;
}

export function isToday(date: Date): boolean {
  return midnight(new Date()).getTime() === midnight(date).getTime();
}

/** Voor de query: alles vanaf maandag tot en met zondag. */
export function weekRange(monday: Date): { gte: Date; lt: Date } {
  return { gte: midnight(monday), lt: addDays(midnight(monday), 7) };
}
