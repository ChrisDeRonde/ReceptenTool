import { after } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { detectSourceType } from "@/lib/extract";
import { processShareItem } from "@/lib/pipeline";

export const runtime = "nodejs";
// Nooit cachen: dit is puur een schrijf-endpoint.
export const dynamic = "force-dynamic";

type SharePayload = {
  url?: unknown;
  text?: unknown;
  sharedBy?: unknown;
};

/**
 * Ingest-endpoint voor de iOS-share sheet.
 *
 * Antwoordt met 202 zodra het item veilig is opgeslagen; het ophalen en
 * verwerken gebeurt daarna via `after()`. De Shortcut hoeft dus niet 30
 * seconden te wachten op een modelaanroep.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const payload = await readPayload(request);
  if (!payload) {
    return Response.json({ error: "Ongeldige body" }, { status: 400 });
  }

  const url = asString(payload.url);
  const text = asString(payload.text);
  const sharedBy = asString(payload.sharedBy);

  if (!url && !text) {
    return Response.json(
      { error: "Geef minstens een url of text mee" },
      { status: 400 },
    );
  }

  const item = await prisma.shareItem.create({
    data: {
      status: "pending",
      sourceType: detectSourceType(url),
      sourceUrl: url,
      sharedText: text,
      sharedBy,
    },
  });

  after(() => processShareItem(item.id));

  const base = process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "";
  return Response.json(
    {
      id: item.id,
      status: item.status,
      inboxUrl: `${base}/inbox`,
      statusUrl: `${base}/api/items/${item.id}`,
    },
    { status: 202 },
  );
}

async function readPayload(request: Request): Promise<SharePayload | null> {
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      return (await request.json()) as SharePayload;
    }
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const form = await request.formData();
      return {
        url: form.get("url"),
        text: form.get("text"),
        sharedBy: form.get("sharedBy"),
      };
    }
    // Shortcuts stuurt soms kale tekst; behandel dat als url óf tekst.
    const body = (await request.text()).trim();
    if (!body) return null;
    return /^https?:\/\/\S+$/i.test(body) ? { url: body } : { text: body };
  } catch {
    return null;
  }
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
