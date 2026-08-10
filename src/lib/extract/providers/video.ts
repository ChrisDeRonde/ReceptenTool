import { fetchJson, fetchPage } from "../fetchPage";
import { parseHtml, readMeta } from "../html";
import type { Provider, SourceDocument } from "../types";

/**
 * TikTok via de publieke oEmbed-endpoint. Die vraagt geen sleutel en geeft de
 * volledige bijschrifttekst terug in het `title`-veld — bij kookvideo's staat
 * daar meestal het hele recept in.
 */
export const tiktokProvider: Provider = {
  name: "tiktok-oembed",

  canHandle(url) {
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host === "tiktok.com" || host.endsWith(".tiktok.com");
  },

  async run(url) {
    const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url.toString())}`;
    const data = await fetchJson<{
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    }>(endpoint);

    const caption = data.title?.trim();
    if (!caption) return null;

    const document: SourceDocument = {
      strategy: "tiktok-oembed",
      text: [
        data.author_name ? `TikTok-account: @${data.author_name}` : null,
        "# Bijschrift",
        caption,
      ]
        .filter(Boolean)
        .join("\n\n"),
      meta: {
        title: caption.slice(0, 120),
        description: caption,
        imageUrl: data.thumbnail_url ?? null,
        siteName: data.author_name ? `@${data.author_name}` : "TikTok",
      },
      canonicalUrl: url.toString(),
    };
    return document;
  },
};

/**
 * YouTube. De oEmbed-endpoint geeft geen beschrijving terug, en juist daar
 * staat bij kookkanalen het recept. Daarom halen we de watch-pagina op en
 * vissen we `shortDescription` uit de player-JSON die erin staat.
 */
export const youtubeProvider: Provider = {
  name: "youtube-description",

  canHandle(url) {
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return (
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtu.be"
    );
  },

  async run(url) {
    const videoId = readVideoId(url);
    if (!videoId) throw new Error("geen video-id in de URL gevonden");

    const page = await fetchPage(`https://www.youtube.com/watch?v=${videoId}`);
    const description = readShortDescription(page.html);
    if (!description) return null;

    const $ = parseHtml(page.html);
    const meta = readMeta($);

    const document: SourceDocument = {
      strategy: "youtube-description",
      text: [
        meta.title ? `Video: ${meta.title}` : null,
        "# Videobeschrijving",
        description,
      ]
        .filter(Boolean)
        .join("\n\n"),
      meta: {
        ...meta,
        imageUrl:
          meta.imageUrl ?? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        siteName: meta.siteName ?? "YouTube",
      },
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
    return document;
  },
};

function readVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return id || null;
  }
  const fromQuery = url.searchParams.get("v");
  if (fromQuery) return fromQuery;
  const match = url.pathname.match(/\/(?:shorts|embed|live)\/([\w-]+)/);
  return match ? match[1] : null;
}

/**
 * `shortDescription` staat als JSON-string in de pagina. We pakken alleen dat
 * ene veld in plaats van de hele ytInitialPlayerResponse te parsen — die is
 * megabytes groot en verandert voortdurend van vorm.
 */
function readShortDescription(html: string): string | null {
  const match = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
  if (!match) return null;
  try {
    const decoded = JSON.parse(`"${match[1]}"`) as string;
    const trimmed = decoded.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}
