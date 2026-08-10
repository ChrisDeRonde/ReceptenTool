import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
} from "@/lib/photo-rules";

/**
 * Foto's van recepten: een kookboekpagina, een kaartje van je moeder, het
 * schoolbord in een restaurant.
 *
 * De bestanden gaan naar schijf en niet de database in: een SQLite-bestand van
 * een paar honderd megabyte is lastig te back-uppen, en dit staat toch al op
 * een host met een blijvende schijf. In de database staat alleen de verwijzing.
 */

export type StoredPhoto = {
  /** Bestandsnaam op schijf, tevens het stukje URL in /api/foto/<name>. */
  name: string;
  mime: string;
};

export function photoDir(): string {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
}

export function photoUrl(photo: StoredPhoto): string {
  return `/api/foto/${photo.name}`;
}

export function parsePhotos(packed: string | null | undefined): StoredPhoto[] {
  if (!packed) return [];
  try {
    const value: unknown = JSON.parse(packed);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (entry): entry is StoredPhoto =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as StoredPhoto).name === "string" &&
        typeof (entry as StoredPhoto).mime === "string",
    );
  } catch {
    return [];
  }
}

/**
 * Slaat de aangeleverde foto's op en geeft de verwijzingen terug.
 *
 * Gooit met een uitlegbare melding zodra er iets niet klopt; die tekst komt
 * ongefilterd in de inbox terecht.
 */
export async function savePhotos(files: File[]): Promise<StoredPhoto[]> {
  const usable = files.filter((file) => file.size > 0);
  if (usable.length === 0) throw new Error("Geen foto ontvangen.");
  if (usable.length > MAX_PHOTOS) {
    throw new Error(`Maximaal ${MAX_PHOTOS} foto's per recept.`);
  }

  const dir = photoDir();
  await mkdir(dir, { recursive: true });

  const stored: StoredPhoto[] = [];
  try {
    for (const file of usable) {
      const mime = file.type.toLowerCase();

      if (mime === "image/heic" || mime === "image/heif") {
        // iOS levert dit soms aan als je een bestaande foto kiest in plaats van
        // er een maakt. Omzetten kan alleen met een extra native afhankelijkheid,
        // dus we zeggen liever eerlijk wat er aan de hand is.
        throw new Error(
          "Deze foto staat in HEIC-formaat, dat kan het model niet lezen. " +
            "Zet in Instellingen → Camera → Formaten op 'Meest compatibel', " +
            "of deel de foto via de share sheet — dan maakt iOS er JPEG van.",
        );
      }

      const extension = ACCEPTED_IMAGE_TYPES.get(mime);
      if (!extension) {
        throw new Error(
          `Bestandstype ${file.type || "onbekend"} wordt niet ondersteund. Gebruik JPEG, PNG, WebP of GIF.`,
        );
      }
      if (file.size > MAX_PHOTO_BYTES) {
        throw new Error(
          `Foto is ${Math.round(file.size / 1024 / 1024)} MB; het maximum is 5 MB per foto.`,
        );
      }

      const bytes = Buffer.from(await file.arrayBuffer());
      const name = `${randomUUID()}.${extension}`;
      await writeFile(path.join(dir, name), bytes);
      stored.push({ name, mime });
    }
  } catch (error) {
    // Half geslaagd is geen geldige toestand: ruim op wat er al stond.
    await deletePhotos(stored);
    throw error;
  }

  return stored;
}

/** Leest een foto terug als base64, klaar voor de modelaanroep. */
export async function readPhotoBase64(
  photo: StoredPhoto,
): Promise<{ mime: string; data: string }> {
  const bytes = await readFile(resolveInsideDir(photo.name));
  return { mime: photo.mime, data: bytes.toString("base64") };
}

export async function readPhotoBytes(name: string): Promise<{
  bytes: Buffer;
  etag: string;
} | null> {
  try {
    const bytes = await readFile(resolveInsideDir(name));
    return { bytes, etag: createHash("sha1").update(bytes).digest("hex") };
  } catch {
    return null;
  }
}

export async function deletePhotos(photos: StoredPhoto[]): Promise<void> {
  await Promise.all(
    photos.map(async (photo) => {
      try {
        await unlink(resolveInsideDir(photo.name));
      } catch {
        // Al weg, of nooit geschreven. Prima.
      }
    }),
  );
}

/**
 * Bestandsnamen komen uit de URL, dus die mogen nergens anders heen wijzen dan
 * de uploadmap: geen `..`, geen absolute paden, geen slashes.
 */
function resolveInsideDir(name: string): string {
  if (!/^[a-f0-9-]+\.(jpg|png|webp|gif)$/i.test(name)) {
    throw new Error("Ongeldige bestandsnaam.");
  }
  const dir = photoDir();
  const full = path.join(dir, name);
  if (path.dirname(path.resolve(full)) !== path.resolve(dir)) {
    throw new Error("Ongeldige bestandsnaam.");
  }
  return full;
}
