import { createHash } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/photo-rules";
import { photoDir } from "@/lib/photos";

/**
 * De foto bij een recept naar de eigen schijf halen.
 *
 * Tot nu toe stond in `imageUrl` het adres bij de bron, en linkten we daar
 * rechtstreeks naartoe. Dat werkt tot de dag dat die site de afbeelding
 * verplaatst of hotlinken blokkeert — en dan is je overzicht een raster met
 * lege vakken, en merk je het pas als je ernaar kijkt. Eén keer downloaden bij
 * het importeren maakt het recept onafhankelijk van de bron, en scheelt
 * meteen een verzoek naar buiten elke keer dat je de lijst opent.
 *
 * Ze gaan naar dezelfde map als de gefotografeerde bronnen: het is hetzelfde
 * soort bestand — het hoort bij de database, niet bij de code — en dan pakt de
 * back-up ze vanzelf mee.
 */

/** Ruimer dan een telefoonfoto: dit zijn plaatjes van een website. */
const MAX_BYTES = 8 * 1024 * 1024;

/** Een trage bron mag een import niet ophouden. */
const TIMEOUT_MS = 10_000;

/**
 * De naam is een hash van de bron-URL.
 *
 * Daarmee is het downloaden herhaalbaar: hetzelfde recept nog eens importeren,
 * of twee recepten met dezelfde foto, leveren hetzelfde bestand op in plaats
 * van een tweede kopie.
 */
function nameFor(url: string, extension: string): string {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 32);
  return `${hash}.${extension}`;
}

async function exists(file: string): Promise<boolean> {
  try {
    return (await stat(file)).size > 0;
  } catch {
    return false;
  }
}

/**
 * Haalt de afbeelding op en geeft het lokale pad terug, of `null` als dat niet
 * lukt.
 *
 * Faalt nooit hard: een recept zonder foto is nog steeds een recept, en dit
 * mag een import niet laten struikelen. De aanroeper valt dan terug op de
 * oorspronkelijke URL — precies wat we hiervoor deden.
 */
export async function storeRemoteImage(
  url: string | null | undefined,
): Promise<string | null> {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const dir = photoDir();

  // Al eens opgehaald? Dan hoeft er niets naar buiten. We kunnen de naam
  // pas raden als we de extensie weten, dus we proberen ze alle vier.
  for (const extension of new Set(ACCEPTED_IMAGE_TYPES.values())) {
    const name = nameFor(url, extension);
    if (await exists(path.join(dir, name))) return `/api/foto/${name}`;
  }

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // Sommige sites weigeren een kale fetch; dit is wat een browser stuurt.
        Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    if (!response.ok) return null;

    const type = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const extension = ACCEPTED_IMAGE_TYPES.get(type);
    // Geen AVIF, geen SVG: het eerste kan Safari's oudere versies niet aan en
    // het tweede is een document dat scripts kan bevatten.
    if (!extension) return null;

    // Eerst de opgegeven lengte, want dan hoeven we een te groot bestand niet
    // eens binnen te halen.
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > MAX_BYTES) return null;

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return null;

    const name = nameFor(url, extension);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), bytes);
    return `/api/foto/${name}`;
  } catch {
    // Time-out, DNS, een site die niets teruggeeft. Niet erg genoeg om een
    // import op te laten stranden.
    return null;
  }
}

/** Het bestandsdeel van een eigen `/api/foto/<naam>`, of null. */
export function localImageName(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  const match = /^\/api\/foto\/([a-f0-9-]+\.(?:jpg|png|webp|gif))$/i.exec(imageUrl);
  return match ? match[1] : null;
}
