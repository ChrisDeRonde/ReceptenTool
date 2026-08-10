const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 ReceptenTool/0.1";

const MAX_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 20_000;

export type FetchedPage = {
  url: string;
  html: string;
};

/**
 * Haalt een pagina op met een browser-achtige UA. Sites die op user agent
 * blokkeren (Instagram doet dit vaak) leveren nog steeds een 200 met een
 * loginmuur op — dat vangen we verderop af, niet hier.
 */
export async function fetchPage(url: string): Promise<FetchedPage> {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Bron gaf HTTP ${response.status} terug`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("html") && !contentType.includes("xml")) {
    throw new Error(`Bron is geen webpagina (content-type: ${contentType})`);
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error("Pagina is te groot om te verwerken");
  }

  return {
    url: response.url || url,
    html: new TextDecoder("utf-8").decode(buffer),
  };
}
