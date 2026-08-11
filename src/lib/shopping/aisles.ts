/**
 * Schappen: onder welk kopje een ingrediënt op de lijst komt.
 *
 * Geen winkelspecifieke looproutes meer — dat bleek gereedschap voor een
 * probleem dat deze app niet heeft. Wat overblijft is groeperen, zodat een
 * lijst van twintig dingen leesbaar is en in één blik te scannen valt.
 */

export const AISLES = [
  "groente",
  "brood",
  "zuivel",
  "kaas",
  "vlees",
  "vis",
  "voorraad",
  "kruiden",
  "bakken",
  "diepvries",
  "drank",
  "nonfood",
  "overig",
] as const;

export type Aisle = (typeof AISLES)[number];

export const AISLE_LABELS: Record<Aisle, string> = {
  groente: "Groente & fruit",
  brood: "Brood & banket",
  zuivel: "Zuivel & eieren",
  kaas: "Kaas & vleeswaren",
  vlees: "Vlees",
  vis: "Vis",
  voorraad: "Voorraadkast",
  kruiden: "Kruiden & specerijen",
  bakken: "Bakproducten",
  diepvries: "Diepvries",
  drank: "Dranken",
  nonfood: "Non-food",
  overig: "Overig",
};

/**
 * De volgorde van de kopjes: ruwweg vers voorin, houdbaar achterin, en wat
 * nergens bij hoort onderaan.
 */
const ORDER: Aisle[] = [
  "groente",
  "brood",
  "kaas",
  "vlees",
  "vis",
  "zuivel",
  "voorraad",
  "kruiden",
  "bakken",
  "diepvries",
  "drank",
  "nonfood",
  "overig",
];

export function aisleOrder(): Aisle[] {
  return ORDER;
}


/**
 * Trefwoorden per schap, van specifiek naar algemeen doorzocht.
 *
 * Het is bewust plat: geen productdatabase, geen API. Een lijst woorden die je
 * zelf kunt lezen en aanvullen komt hier verder dan iets slims dat je niet kunt
 * corrigeren als het ernaast zit.
 */
const KEYWORDS: Array<[Aisle, string[]]> = [
  // Eerst de gevallen die anders bij het verkeerde schap belanden.
  ["diepvries", ["diepvries", "ijs", "ijsblokjes", "bladerdeeg", "filodeeg", "erwtjes uit de vriezer"]],
  ["bakken", [
    "bloem", "bakmeel", "gist", "bakpoeder", "vanille-extract", "vanillesuiker",
    "cacao", "suiker", "poedersuiker", "basterdsuiker", "amandelmeel", "custard",
    "marsepein",
  ]],
  ["kruiden", [
    "peper", "zout", "kaneel", "komijn", "kurkuma", "paprikapoeder", "oregano",
    "tijm", "rozemarijn", "laurier", "kruidnagel", "nootmuskaat", "kerrie",
    "chilipoeder", "korianderzaad", "venkelzaad", "garam masala", "za'atar",
    "sumak", "saffraan", "bouillonblokje", "bouillontablet",
  ]],
  ["groente", [
    "ui", "sjalot", "knoflook", "tomaat", "tomaten", "paprika", "courgette",
    "aubergine", "wortel", "prei", "venkel", "komkommer", "sla", "spinazie",
    "rucola", "boerenkool", "broccoli", "bloemkool", "spruit", "kool", "biet",
    "pompoen", "aardappel", "champignon", "paddenstoel", "peterselie", "basilicum",
    "koriander", "bieslook", "munt", "dille", "citroen", "limoen", "sinaasappel",
    "appel", "peer", "banaan", "mango", "avocado", "druif", "bes", "aardbei",
    "framboos", "gember", "peultje", "sperzieboon", "asperge", "radijs", "selderij",
    "lente-ui", "peperoni", "chilipeper", "rode peper", "padrón",
  ]],
  ["brood", ["brood", "stokbrood", "ciabatta", "pita", "wrap", "tortilla", "beschuit", "croissant", "bagel", "naan"]],
  ["zuivel", [
    "melk", "room", "slagroom", "crème fraîche", "creme fraiche", "kwark", "yoghurt",
    "karnemelk", "boter", "margarine", "ei", "eieren", "mascarpone", "ricotta",
    "hüttenkäse", "skyr", "vla",
  ]],
  ["kaas", [
    "kaas", "parmezaan", "pecorino", "mozzarella", "feta", "geitenkaas", "cheddar",
    "gruyère", "brie", "ham", "spek", "bacon", "guanciale", "pancetta", "chorizo",
    "salami", "worst", "prosciutto",
  ]],
  ["vlees", [
    "kip", "kipfilet", "kippendij", "rund", "gehakt", "biefstuk", "varken",
    "speklap", "lam", "kalkoen", "shoarma", "spareribs", "schnitzel", "rookworst",
  ]],
  ["vis", [
    "vis", "zalm", "kabeljauw", "tonijn", "garnaal", "mossel", "inktvis", "ansjovis",
    "sardine", "haring", "makreel", "coquille",
  ]],
  ["drank", [
    "wijn", "bier", "water", "sap", "cola", "limonade", "koffie", "thee", "siroop",
    "prosecco", "vermout", "rum", "wodka", "gin", "whisky", "sherry", "port",
  ]],
  ["nonfood", ["bakpapier", "aluminiumfolie", "vershoudfolie", "cocktailprikker", "servet", "afwasmiddel"]],
  ["voorraad", [
    "tomatenblokjes", "gepelde tomaten", "tomatenpuree", "passata", "kokosmelk",
    "pasta", "spaghetti", "penne", "rigatoni", "macaroni", "lasagne", "noodle",
    "rijst", "risotto", "couscous", "bulgur", "quinoa", "linze", "kikkererwt",
    "boon", "olie", "olijfolie", "azijn", "sojasaus", "vissaus", "gochujang",
    "miso", "mosterd", "ketchup", "mayonaise", "honing", "stroop",
    "tomatenpuree", "passata", "kokosmelk", "bouillon", "blik", "pot", "noten",
    "amandel", "walnoot", "cashew", "pinda", "sesam", "rozijn", "dadel", "abrikoos",
    "chocolade", "havermout", "muesli", "cornflakes", "tahin", "harissa", "curry",
    "kappertje", "olijf", "augurk", "zongedroogde",
  ]],
];

/**
 * Nederlandse samenstellingen hebben hun kern achteraan: slagroom is room,
 * boerenkool is kool. Deze woorden bepalen daarom het schap ook als er iets
 * voor staat. Alleen woorden waarbij dat altijd opgaat — "filet" staat er niet
 * bij, want kipfilet en zalmfilet liggen niet bij elkaar.
 */
const HEADS: Array<[Aisle, string[]]> = [
  ["vlees", ["gehakt"]],
  ["groente", ["kool", "sla", "peper", "appel", "peen", "bes", "ui"]],
  ["zuivel", ["room", "melk", "yoghurt", "boter", "kwark", "ei"]],
  ["kaas", ["kaas", "worst", "ham"]],
  ["brood", ["brood", "bol"]],
  ["voorraad", ["olie", "azijn", "saus", "puree", "noten", "rijst", "pasta"]],
  ["bakken", ["meel", "suiker"]],
  ["drank", ["wijn", "bier", "sap"]],
];

/** Één keer opbouwen: elk trefwoord naar zijn schap, als hele woorden. */
const EXACT = new Map<string, Aisle>();
for (const [aisle, keywords] of KEYWORDS) {
  for (const keyword of keywords) {
    if (!EXACT.has(keyword)) EXACT.set(keyword, aisle);
  }
}

/**
 * De enkelvoudsvormen die bij een afgeknipt meervoud kunnen horen.
 *
 * Twee Nederlandse regels: de lettergreep gaat dicht (bonen → boon), en de
 * slotmedeklinker verstemloost (abrikozen → abrikoos, druiven → druif). Beide
 * mogen falen; dit is de laatste poging voordat iets bij Overig belandt.
 */
function enkelvoudVarianten(stem: string): string[] {
  const out = new Set<string>();
  const devoiced = stem.replace(/z$/, "s").replace(/v$/, "f");
  for (const base of [stem, devoiced]) {
    out.add(base);
    const opened = base.replace(/([aeiou])([bcdfghjklmnpqrstvwxz])$/, "$1$1$2");
    out.add(opened);
    out.add(opened.replace(/z$/, "s").replace(/v$/, "f"));
  }
  out.delete(stem);
  return [...out];
}

/**
 * In welk schap ligt dit.
 *
 * Eerst op hele woorden, dan op de kern van een samenstelling. Geen losse
 * prefix-vergelijking: daarmee werd "slagroom" groente omdat het met "sla"
 * begint. Wat nergens op past gaat naar Overig — onderaan de lijst, maar wel
 * op de lijst.
 */
export function aisleFor(name: string): Aisle {
  const words = name
    .toLowerCase()
    .split(/[^a-zà-ÿ\']+/)
    .filter(Boolean);
  if (words.length === 0) return "overig";

  const phrase = words.join(" ");

  // Hele zinsdelen eerst: "rode peper" hoort ergens anders dan "peper".
  for (const [keyword, aisle] of EXACT) {
    if (keyword.includes(" ") && phrase.includes(keyword)) return aisle;
  }

  for (const word of words) {
    const hit = EXACT.get(word);
    if (hit) return hit;
  }

  for (const word of words) {
    for (const [aisle, heads] of HEADS) {
      for (const head of heads) {
        if (word.length > head.length && word.endsWith(head)) return aisle;
      }
    }
  }

  // Laatste poging met het meervoud eraf. Alleen hier, niet bij het samenvoegen
  // van hoeveelheden: een verkeerd schap kost je een omweg, twee ingrediënten
  // ten onrechte samenvoegen kost je een verkeerde boodschap.
  for (const word of words) {
    for (const suffix of ["'s", "en", "s"]) {
      if (!word.endsWith(suffix)) continue;
      const stem = word.slice(0, -suffix.length);
      if (stem.length < 3) continue;

      const hit = EXACT.get(stem);
      if (hit) return hit;

      // "bonen" wordt "bon" en moet "boon" worden: Nederlands verdubbelt de
      // klinker als de lettergreep in het meervoud opengaat.
      for (const candidate of enkelvoudVarianten(stem)) {
        const second = EXACT.get(candidate);
        if (second) return second;
      }
    }
  }

  return "overig";
}
