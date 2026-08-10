const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

const MAX_BYTES = 6 * 1024 * 1024;
const TIMEOUT_MS = 20_000;

export type FetchedPage = {
  url: string;
  html: string;
  /** Welke user agent het opleverde — puur voor het spoor in de inbox. */
  via: "desktop" | "mobile";
};

export class FetchError extends Error {
  readonly status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "FetchError";
    this.status = status;
  }
}

/**
 * Haalt HTML op. Bij een 403/429 op de desktop-UA volgt één herkansing met een
 * mobiele UA: sites die datacenter-verkeer weren serveren de mobiele variant
 * vaak wél, en die pagina's zijn bovendien lichter.
 *
 * Meer dan twee pogingen doen we bewust niet — dan is de bron het gewoon niet
 * met ons eens, en is zelf tekst plakken sneller dan doorrammen.
 */
export async function fetchPage(
  url: string,
  options: { headers?: Record<string, string> } = {},
): Promise<FetchedPage> {
  let lastError: FetchError | null = null;

  for (const via of ["desktop", "mobile"] as const) {
    try {
      return await attempt(url, via, options.headers ?? {});
    } catch (error) {
      lastError = error instanceof FetchError ? error : new FetchError(String(error));
      // Alleen opnieuw proberen als het op een blokkade lijkt.
      const retryable =
        lastError.status === 403 ||
        lastError.status === 429 ||
        lastError.status === null;
      if (!retryable) break;
    }
  }

  throw lastError ?? new FetchError("Onbekende fout bij ophalen");
}

async function attempt(
  url: string,
  via: "desktop" | "mobile",
  extraHeaders: Record<string, string>,
): Promise<FetchedPage> {
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": via === "desktop" ? DESKTOP_UA : MOBILE_UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7",
        ...extraHeaders,
      },
    });
  } catch (error) {
    // Netwerkfout of timeout: geen HTTP-status om op te sturen.
    throw new FetchError(describeNetworkError(error), null);
  }

  if (!response.ok) {
    throw new FetchError(`HTTP ${response.status}`, response.status);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("html") && !contentType.includes("xml")) {
    throw new FetchError(`geen webpagina (content-type: ${contentType})`, null);
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) {
    throw new FetchError("pagina te groot om te verwerken", null);
  }

  return {
    url: response.url || url,
    html: new TextDecoder("utf-8").decode(buffer),
    via,
  };
}

/** JSON ophalen, voor oEmbed-endpoints. */
export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": DESKTOP_UA, Accept: "application/json" },
  }).catch((error: unknown) => {
    throw new FetchError(describeNetworkError(error), null);
  });

  if (!response.ok) {
    throw new FetchError(`HTTP ${response.status}`, response.status);
  }
  return (await response.json()) as T;
}

function describeNetworkError(error: unknown): string {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "time-out na 20 seconden";
  }
  return error instanceof Error ? error.message : String(error);
}
