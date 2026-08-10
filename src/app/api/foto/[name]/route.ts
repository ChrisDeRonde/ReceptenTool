import { NextResponse } from "next/server";
import { readPhotoBytes } from "@/lib/photos";

/**
 * Serveert een gefotografeerde bron terug aan de browser.
 *
 * De bestanden staan buiten `public/`, want ze horen bij de database en niet
 * bij de code — je wilt ze meenemen in een back-up van je data, niet in een
 * deploy. Deze route is de enige weg ernaartoe, en `readPhotoBytes` laat alleen
 * namen door die eruitzien zoals wij ze schrijven.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const photo = await readPhotoBytes(name);
  if (!photo) {
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  }

  const type = name.endsWith(".png")
    ? "image/png"
    : name.endsWith(".webp")
      ? "image/webp"
      : name.endsWith(".gif")
        ? "image/gif"
        : "image/jpeg";

  return new NextResponse(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": type,
      // De naam is willekeurig en de inhoud verandert nooit, dus dit mag lang
      // in de cache van de telefoon blijven staan.
      "Cache-Control": "private, max-age=31536000, immutable",
      ETag: `"${photo.etag}"`,
    },
  });
}
