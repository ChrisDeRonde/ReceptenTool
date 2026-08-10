import { genericWebProvider } from "./providers/genericWeb";
import { instagramProvider } from "./providers/instagram";
import { tiktokProvider, youtubeProvider } from "./providers/video";
import {
  MIN_USEFUL_CHARS,
  emptyMeta,
  type Attempt,
  type Provider,
  type SourceDocument,
} from "./types";

export type SourceType = "instagram" | "tiktok" | "youtube" | "ah" | "website" | "text";

export type ExtractInput = {
  url?: string | null;
  text?: string | null;
};

export type ExtractResult =
  | ({ status: "ok"; sourceType: SourceType; attempts: Attempt[] } & SourceDocument)
  | {
      status: "needs_input";
      sourceType: SourceType;
      /** Uitleg voor de gebruiker: wat moet die zelf aanleveren? */
      reason: string;
      attempts: Attempt[];
      canonicalUrl: string | null;
    };

/**
 * Volgorde is betekenisvol: de eerste provider die de URL herkent én iets
 * bruikbaars oplevert, wint. `genericWebProvider` staat achteraan en accepteert
 * alles, dus hij vangt de rest op.
 */
const PROVIDERS: Provider[] = [
  instagramProvider,
  tiktokProvider,
  youtubeProvider,
  genericWebProvider,
];

export function detectSourceType(url: string | null | undefined): SourceType {
  if (!url) return "text";
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "text";
  }
  const is = (domain: string) => host === domain || host.endsWith(`.${domain}`);

  if (is("instagram.com")) return "instagram";
  if (is("tiktok.com")) return "tiktok";
  if (is("youtube.com") || is("youtu.be")) return "youtube";
  if (is("ah.nl")) return "ah";
  return "website";
}

export async function extractSource(
  input: ExtractInput,
): Promise<ExtractResult> {
  const url = normalizeUrl(input.url);
  const sourceType = detectSourceType(url);
  const attempts: Attempt[] = [];

  let sharedText = input.text?.trim() ?? "";
  // De simpelste iOS-Shortcut zet de gedeelde waarde in zowel `url` als `text`,
  // zodat één shortcut zowel links als tekstselecties aankan. Bij een link is
  // die tekst dan een duplicaat en heeft het model er niets aan.
  if (sharedText && input.url && sharedText === input.url.trim()) {
    sharedText = "";
  }

  // Geen URL: de gedeelde tekst ís de bron (recept uit Notities, WhatsApp, …).
  if (!url) {
    if (sharedText.length < MIN_USEFUL_CHARS) {
      return {
        status: "needs_input",
        sourceType: "text",
        reason: "Er is geen link en te weinig tekst om een recept van te maken.",
        attempts,
        canonicalUrl: null,
      };
    }
    return {
      status: "ok",
      sourceType: "text",
      strategy: "geplakte-tekst",
      text: sharedText,
      meta: emptyMeta,
      canonicalUrl: null,
      attempts,
    };
  }

  const parsedUrl = new URL(url);

  for (const provider of PROVIDERS) {
    if (!provider.canHandle(parsedUrl)) continue;
    try {
      const document = await provider.run(parsedUrl, sharedText, (attempt) =>
        attempts.push(attempt),
      );
      if (!document) {
        attempts.push({
          strategy: provider.name,
          ok: false,
          detail: "geen bruikbare tekst gevonden",
        });
        continue;
      }
      attempts.push({
        strategy: document.strategy,
        ok: true,
        detail: `${document.text.length} tekens`,
      });
      return {
        status: "ok",
        sourceType,
        attempts,
        ...withSharedText(document, sharedText),
      };
    } catch (error) {
      attempts.push({
        strategy: provider.name,
        ok: false,
        detail: errorMessage(error),
      });
    }
  }

  // Alle strategieën uitgeput. Meegedeelde tekst is dan alsnog genoeg.
  if (sharedText.length >= MIN_USEFUL_CHARS) {
    attempts.push({
      strategy: "geplakte-tekst",
      ok: true,
      detail: `${sharedText.length} tekens`,
    });
    return {
      status: "ok",
      sourceType,
      strategy: "geplakte-tekst",
      text: sharedText,
      meta: emptyMeta,
      canonicalUrl: url,
      attempts,
    };
  }

  return {
    status: "needs_input",
    sourceType,
    reason: explainFailure(sourceType, attempts),
    attempts,
    canonicalUrl: url,
  };
}

/** Handmatig geplakte tekst gaat mee bovenop wat de scraper vond. */
function withSharedText(
  document: SourceDocument,
  sharedText: string,
): SourceDocument {
  if (!sharedText) return document;
  return {
    ...document,
    text: `# Meegedeelde tekst\n${sharedText}\n\n---\n\n${document.text}`,
  };
}

function explainFailure(sourceType: SourceType, attempts: Attempt[]): string {
  const trail = attempts
    .map((attempt) => `${attempt.strategy}: ${attempt.detail}`)
    .join(" · ");

  const advice =
    sourceType === "instagram"
      ? "Instagram gaf het bijschrift niet vrij — dat gebeurt bij privé-accounts, of als Instagram het serverIP blokkeert. Kopieer het bijschrift uit de app en plak het hieronder."
      : sourceType === "tiktok" || sourceType === "youtube"
        ? "Er kwam geen bruikbare beschrijving uit deze video. Staat het recept alleen in de video zelf, plak het dan hieronder."
        : "Er kwam te weinig bruikbare tekst uit deze pagina. Plak de recepttekst hieronder.";

  return trail ? `${advice} (geprobeerd — ${trail})` : advice;
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

export type { Attempt, SourceDocument } from "./types";
