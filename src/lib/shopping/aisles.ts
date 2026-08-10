/**
 * Schappen en winkels.
 *
 * Het doel is niet een kaart van elke vestiging, maar dat je niet drie keer
 * heen en weer loopt: groente bij de groente, zuivel bij de zuivel, en de
 * volgorde ongeveer zoals je door die winkel loopt.
 *
 * De volgordes hieronder zijn een benadering van de gebruikelijke indeling per
 * keten — filialen verschillen onderling, dus zie het als een startpunt. Klopt
 * het bij jullie winkel net anders, dan versleep je hier een regel.
 */

export const STORES = ["ah", "jumbo", "plus", "lidl", "aldi"] as const;
export type Store = (typeof STORES)[number];

export const STORE_LABELS: Record<Store, string> = {
  ah: "Albert Heijn",
  jumbo: "Jumbo",
  plus: "PLUS",
  lidl: "Lidl",
  aldi: "Aldi",
};

export const DEFAULT_STORE: Store = "ah";

export function isStore(value: string | null | undefined): value is Store {
  return !!value && (STORES as readonly string[]).includes(value);
}

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
 * De looproute per winkel.
 *
 * AH, Jumbo en PLUS beginnen doorgaans bij de groente en eindigen bij de
 * koeling; Lidl en Aldi zetten de bakafdeling vooraan en hebben een kortere
 * route met minder schappen.
 */
const ROUTES: Record<Store, Aisle[]> = {
  ah: [
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
  ],
  jumbo: [
    "groente",
    "brood",
    "vlees",
    "vis",
    "kaas",
    "zuivel",
    "voorraad",
    "kruiden",
    "bakken",
    "diepvries",
    "drank",
    "nonfood",
    "overig",
  ],
  plus: [
    "groente",
    "vlees",
    "vis",
    "kaas",
    "brood",
    "zuivel",
    "voorraad",
    "kruiden",
    "bakken",
    "diepvries",
    "drank",
    "nonfood",
    "overig",
  ],
  lidl: [
    "brood",
    "groente",
    "zuivel",
    "kaas",
    "vlees",
    "vis",
    "diepvries",
    "voorraad",
    "kruiden",
    "bakken",
    "drank",
    "nonfood",
    "overig",
  ],
  aldi: [
    "groente",
    "brood",
    "zuivel",
    "kaas",
    "vlees",
    "diepvries",
    "voorraad",
    "kruiden",
    "bakken",
    "vis",
    "drank",
    "nonfood",
    "overig",
  ],
};

export function aisleOrder(store: Store): Aisle[] {
  return ROUTES[store];
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
    "cacao", "poedersuiker", "basterdsuiker", "amandelmeel", "custard", "marsepein",
  ]],
  ["kruiden", [
    "peper", "zout", "kaneel", "komijn", "kurkuma", "paprikapoeder", "oregano",
    "tijm", "rozemarijn", "laurier", "kruidnagel", "nootmuskaat", "kerrie",
    "chilipoeder", "korianderzaad", "venkelzaad", "garam masala", "za'atar",
    "sumak", "saffraan", "gedroogde", "bouillonblokje", "bouillontablet",
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
    "miso", "mosterd", "ketchup", "mayonaise", "honing", "suiker", "stroop",
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

  return "overig";
}
