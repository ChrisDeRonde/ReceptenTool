import { fetchPage } from "./fetchPage";
import { parseHtml, readMeta, readableText, type PageMeta } from "./html";
import { compactRecipeJsonLd, findRecipeJsonLd } from "./jsonld";

export type SourceType = "instagram" | "ah" | "website" | "text";

export type ExtractInput = {
  url?: string | null;
  text?: string | null;
};

export type ExtractResult =
  | {
      status: "ok";
      sourceType: SourceType;
      /** De tekst die naar het model gaat. */
      text: string;
      meta: PageMeta;
      canonicalUrl: string | null;
    }
  | {
      status: "needs_input";
      sourceType: SourceType;
      /** Uitleg voor de gebruiker: wat moet die zelf aanleveren? */
      reason: string;
      meta: PageMeta;
      canonicalUrl: string | null;
    };

export function detectSourceType(url: string | null | undefined): SourceType {
  if (!url) return "text";
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "text";
  }
  if (host === "instagram.com" || host.endsWith(".instagram.com")) {
    return "instagram";
  }
  if (host === "ah.nl" || host.endsWith(".ah.nl")) return "ah";
  return "website";
}

/** Genoeg tekst om er plausibel een recept in te vinden. */
const MIN_USEFUL_CHARS = 200;

export async function extractSource(
  input: ExtractInput,
): Promise<ExtractResult> {
  const url = normalizeUrl(input.url);
  const sourceType = detectSourceType(url);

  let sharedText = input.text?.trim() ?? "";
  // De simpelste iOS-Shortcut zet de gedeelde waarde in zowel `url` als `text`,
  // zodat één shortcut zowel links als tekstselecties aankan. Bij een link is
  // die tekst dan een duplicaat en heeft het model er niets aan.
  if (sharedText && input.url && sharedText === input.url.trim()) {
    sharedText = "";
  }

  const emptyMeta: PageMeta = {
    title: null,
    description: null,
    imageUrl: null,
    siteName: null,
  };

  // Geen URL: de gedeelde tekst ís de bron (recept uit Notities, WhatsApp, …).
  if (!url) {
    if (sharedText.length < MIN_USEFUL_CHARS) {
      return {
        status: "needs_input",
        sourceType: "text",
        reason: "Er is geen link en te weinig tekst om een recept van te maken.",
        meta: emptyMeta,
        canonicalUrl: null,
      };
    }
    return {
      status: "ok",
      sourceType: "text",
      text: sharedText,
      meta: emptyMeta,
      canonicalUrl: null,
    };
  }

  let html: string;
  let finalUrl = url;
  try {
    const page = await fetchPage(url);
    html = page.html;
    finalUrl = page.url;
  } catch (error) {
    // De pagina ophalen kan mislukken (loginmuur, timeout, blokkade). Als er
    // meegedeelde tekst is, is dat alsnog genoeg om mee te werken.
    if (sharedText.length >= MIN_USEFUL_CHARS) {
      return {
        status: "ok",
        sourceType,
        text: sharedText,
        meta: emptyMeta,
        canonicalUrl: url,
      };
    }
    return {
      status: "needs_input",
      sourceType,
      reason: `De pagina kon niet worden opgehaald (${errorMessage(error)}). Plak de recepttekst erbij.`,
      meta: emptyMeta,
      canonicalUrl: url,
    };
  }

  const $ = parseHtml(html);
  const meta = readMeta($);

  const parts: string[] = [];
  if (sharedText) {
    parts.push(`# Meegedeelde tekst\n${sharedText}`);
  }

  const jsonLd = findRecipeJsonLd($);
  if (jsonLd) {
    parts.push(
      `# schema.org/Recipe uit de bron (betrouwbaarste data)\n${compactRecipeJsonLd(jsonLd)}`,
    );
  }

  if (sourceType === "instagram") {
    // Instagram serveert bots meestal een loginmuur. Wat er wél doorheen komt
    // is de og:description-meta, en daar staat op openbare posts het bijschrift
    // in. Meer dan dat gaan we niet forceren.
    if (meta.description) {
      parts.push(`# Instagram-bijschrift\n${meta.description}`);
    }
  } else {
    const body = readableText($);
    if (body) {
      parts.push(`# Paginatekst\n${body}`);
    }
  }

  const text = parts.join("\n\n---\n\n").trim();

  if (text.length < MIN_USEFUL_CHARS) {
    return {
      status: "needs_input",
      sourceType,
      reason:
        sourceType === "instagram"
          ? "Instagram gaf alleen een loginmuur terug. Kopieer het bijschrift van de post en plak het hieronder."
          : "Er kwam te weinig bruikbare tekst uit deze pagina. Plak de recepttekst hieronder.",
      meta,
      canonicalUrl: finalUrl,
    };
  }

  return { status: "ok", sourceType, text, meta, canonicalUrl: finalUrl };
}

function normalizeUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    // Tracking-parameters zorgen ervoor dat dezelfde post als twee items binnenkomt.
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "igshid" || key === "fbclid") {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
