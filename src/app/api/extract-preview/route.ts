import { isAuthorized } from "@/lib/auth";
import { extractSource } from "@/lib/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Draait alleen de ophaalstap en laat zien wat eruit komt — geen modelaanroep,
 * dus geen tokens.
 *
 * Hiermee zie je van een bron die niet lukt precies welke strategieën zijn
 * geprobeerd en waarop ze afketsten, zonder er een recept van te maken.
 *
 *   curl -X POST https://jouw-app/api/extract-preview \
 *     -H "authorization: Bearer $INGEST_TOKEN" \
 *     -H 'content-type: application/json' \
 *     -d '{"url":"https://www.instagram.com/p/XXXX/"}'
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  let payload: { url?: unknown; text?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return Response.json({ error: "Ongeldige body" }, { status: 400 });
  }

  const result = await extractSource({
    url: typeof payload.url === "string" ? payload.url : null,
    text: typeof payload.text === "string" ? payload.text : null,
  });

  if (result.status === "needs_input") {
    return Response.json({
      status: result.status,
      sourceType: result.sourceType,
      reason: result.reason,
      attempts: result.attempts,
    });
  }

  return Response.json({
    status: result.status,
    sourceType: result.sourceType,
    strategy: result.strategy,
    attempts: result.attempts,
    canonicalUrl: result.canonicalUrl,
    meta: result.meta,
    characters: result.text.length,
    text: result.text,
  });
}
