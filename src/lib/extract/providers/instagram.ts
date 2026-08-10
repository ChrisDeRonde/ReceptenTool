import { fetchPage } from "../fetchPage";
import { parseHtml, readMeta } from "../html";
import type { Provider, SourceDocument } from "../types";

/**
 * Instagram zonder API-key.
 *
 * De gewone post-URL levert bots vrijwel altijd een loginmuur. De
 * embed-pagina niet: die is bedoeld om posts op externe sites te tonen en is
 * daarom publiek toegankelijk, inclusief het volledige bijschrift. Dat is de
 * enige route die zonder Graph API-token structureel werkt.
 *
 * We proberen op de embed-pagina drie dingen, van robuust naar oppervlakkig:
 *  1. het JSON-blok met `edge_media_to_caption` — ongevoelig voor CSS-wijzigingen
 *  2. de `.Caption`-div — de zichtbare tekst op de embed-pagina
 *  3. de og:description van de gewone post-URL — laatste strohalm
 *
 * Werkt alleen voor openbare posts. Privé-accounts blijven handwerk.
 */
export const instagramProvider: Provider = {
  name: "instagram-embed",

  canHandle(url) {
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host === "instagram.com" || host.endsWith(".instagram.com");
  },

  async run(url) {
    const shortcode = readShortcode(url);
    if (!shortcode) {
      throw new Error(
        "geen post-, reel- of tv-code in de URL gevonden (profiel-link?)",
      );
    }

    // Overschrijfbaar zodat je de embed via een eigen proxy kunt routeren —
    // handig als Instagram het IP van je server blokkeert — en zodat de
    // strategie tegen een fixture te testen is.
    const base = (
      process.env.INSTAGRAM_EMBED_BASE ?? "https://www.instagram.com"
    ).replace(/\/$/, "");
    const embedUrl = `${base}/p/${shortcode}/embed/captioned/`;
    const page = await fetchPage(embedUrl, {
      // Zonder Referer serveert Instagram de embed soms zonder bijschrift.
      headers: { Referer: "https://www.instagram.com/" },
    });

    const $ = parseHtml(page.html);
    const caption = captionFromJson(page.html) ?? captionFromDom($);

    if (!caption) return null;

    const meta = readMeta($);
    const image =
      $("img.EmbeddedMediaImage").first().attr("src") ?? meta.imageUrl;
    const author =
      $(".UsernameText").first().text().trim() ||
      $(".Username").first().text().trim() ||
      null;

    const text = [
      author ? `Instagram-account: @${author}` : null,
      "# Bijschrift",
      caption,
    ]
      .filter(Boolean)
      .join("\n\n");

    const document: SourceDocument = {
      strategy: "instagram-embed",
      text,
      meta: {
        ...meta,
        imageUrl: image ?? null,
        siteName: author ? `@${author}` : "Instagram",
      },
      canonicalUrl: `https://www.instagram.com/p/${shortcode}/`,
    };
    return document;
  },
};

/** /p/CODE/, /reel/CODE/, /reels/CODE/ en /tv/CODE/ leiden allemaal naar dezelfde post. */
function readShortcode(url: URL): string | null {
  const match = url.pathname.match(
    /\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/,
  );
  return match ? match[1] : null;
}

/**
 * De embed-pagina bevat een JSON-blob met de post-data. Het bijschrift zit in
 * `edge_media_to_caption.edges[0].node.text`. We zoeken dat veld direct in de
 * ruwe HTML in plaats van de hele blob te parsen — die is groot en de exacte
 * plek verschuift regelmatig.
 */
function captionFromJson(html: string): string | null {
  const match = html.match(
    /"edge_media_to_caption":\{"edges":\[\{"node":\{"text":"((?:[^"\\]|\\.)*)"/,
  );
  if (!match) return null;
  try {
    const decoded = JSON.parse(`"${match[1]}"`) as string;
    const trimmed = decoded.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * Fallback: de zichtbare bijschrifttekst. De `.Caption`-div begint met de
 * gebruikersnaam en eindigt met het aantal reacties; die knippen we eraf.
 */
function captionFromDom($: ReturnType<typeof parseHtml>): string | null {
  const $caption = $(".Caption").first();
  if ($caption.length === 0) return null;

  const $clone = $caption.clone();
  $clone.find(".CaptionUsername, .CaptionComments").remove();
  $clone.find("br").replaceWith("\n");

  const text = $clone
    .text()
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text.length > 0 ? text : null;
}
