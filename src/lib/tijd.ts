/**
 * Hoe lang geleden, in gewone taal.
 *
 * Overal in de app staat wel ergens "3 dagen geleden": bij een kooklogregel,
 * bij een voorstel voor het weekmenu, bij wat er binnenkwam. Dat stond op drie
 * plekken los uitgeschreven en liep uit elkaar. Hier staat het één keer.
 *
 * Twee regels die het hele bestand verklaren:
 *
 * 1. Tellen gebeurt in kalenderdagen, niet in verstreken uren. Iets dat je
 *    vanochtend om acht uur maakte is vanavond om elf uur nog steeds "vandaag",
 *    ook al zitten er vijftien uur tussen. Wie in uren rekent krijgt "gisteren"
 *    te zien voor het eten dat nog op het aanrecht staat.
 * 2. Geen enkele functie hier gebruikt `new Date()` zelf. De dag van vandaag
 *    komt binnen als argument. Dat maakt het testbaar zonder de klok te
 *    verzetten, en het voorkomt dat server en browser een andere mening hebben.
 */

const DAG_MS = 86_400_000;

/** Middernacht van de dag waar dit moment in valt, in lokale tijd. */
export function dagStart(datum: Date): number {
  const x = new Date(datum);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/**
 * Hoeveel kalenderdagen tussen `toen` en `nu`.
 *
 * Nooit negatief: een datum in de toekomst is voor alles wat hierop volgt
 * gewoon vandaag. Dat is eerlijker dan "-3 dagen geleden".
 */
export function dagenTussen(toen: Date, nu: Date): number {
  return Math.max(0, Math.round((dagStart(nu) - dagStart(toen)) / DAG_MS));
}

/**
 * "vandaag", "gisteren", "3 dagen geleden", "2 weken geleden".
 *
 * De grenzen zitten waar je zelf ophoudt met tellen: tot twee weken weet je
 * het nog in dagen, daarna in weken, en na twee maanden interesseert de week
 * niemand meer.
 */
export function geleden(dagen: number): string {
  if (dagen <= 0) return "vandaag";
  if (dagen === 1) return "gisteren";
  if (dagen < 14) return `${dagen} dagen geleden`;
  if (dagen < 60) return `${Math.round(dagen / 7)} weken geleden`;
  return `${Math.round(dagen / 30)} maanden geleden`;
}

/**
 * Hetzelfde, maar als stuk zin: "sinds gisteren", "sinds 3 dagen".
 *
 * `geleden` staat op zichzelf; deze vorm gaat achter iets anders aan, zoals
 * "Hoog gewaardeerd, twee weken geleden". Vandaar dat "vandaag" en "gisteren"
 * hier zonder het woord "geleden" komen — anders staat er "gisteren geleden".
 */
export function geledenAchteraan(dagen: number): string {
  if (dagen <= 0) return "vandaag gemaakt";
  if (dagen === 1) return "gisteren gemaakt";
  return geleden(dagen);
}

/**
 * "9 aug" binnen dit jaar, "9 aug 2025" daarbuiten.
 *
 * Het jaartal er altijd bij zetten is ruis in een lijst waar alles van deze
 * zomer is, en onmisbaar zodra er iets van vorig jaar tussen staat.
 */
export function datumKort(datum: Date, nu: Date): string {
  return datum.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    ...(datum.getFullYear() === nu.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** "vandaag 21:03", "gisteren 09:12", "9 aug 21:03", "9 aug 2025". */
export function momentTekst(datum: Date, nu: Date): string {
  const dagen = dagenTussen(datum, nu);
  const klok = datum.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (dagen === 0) return `vandaag ${klok}`;
  if (dagen === 1) return `gisteren ${klok}`;

  // Binnen hetzelfde jaar is het jaartal ruis; daarbuiten is het het enige dat
  // je nog wilt weten en is het tijdstip juist ruis.
  if (datum.getFullYear() === nu.getFullYear()) {
    const dag = datum.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
    return `${dag} ${klok}`;
  }

  return datum.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Eerste letter groot; nodig als een van deze zinnen een zin begint. */
export function hoofdletter(tekst: string): string {
  return tekst.charAt(0).toLocaleUpperCase("nl-NL") + tekst.slice(1);
}

/**
 * "koriander, olijf en varkensvlees" — een opsomming die als zin leest.
 *
 * Eén plek, want deze stond er drie keer bijna hetzelfde in: op de
 * receptpagina, in de voorstelredenen en in de voorleesregel van de kookmodus.
 * Alle drie met dezelfde stille bodem — een lege lijst leverde " en undefined"
 * op, wat niemand ooit zag omdat de aanroepers er nu net nooit een lege lijst
 * in stopten. Dat soort afspraak hoort in de functie te staan, niet in het
 * hoofd van wie hem aanroept.
 *
 * `hooguit` kapt de lijst af: drie redenen is een reden, tien is een lijst.
 */
export function opsomming(woorden: readonly string[], hooguit?: number): string {
  const kort = hooguit === undefined ? [...woorden] : woorden.slice(0, hooguit);
  if (kort.length === 0) return "";
  if (kort.length === 1) return kort[0];
  return `${kort.slice(0, -1).join(", ")} en ${kort.at(-1)}`;
}
