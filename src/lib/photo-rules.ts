/**
 * De grenzen van een fotobron, zonder node-imports.
 *
 * Apart bestand omdat de client hier ook bij moet: `photos.ts` raakt de schijf
 * aan en kan daardoor niet in een client component geladen worden.
 */

/** Wat het model aankan. HEIC hoort er niet bij — zie photos.ts. */
export const ACCEPTED_IMAGE_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

/** Per foto. De API weigert afbeeldingen die groter zijn. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Een recept beslaat soms twee pagina's; meer dan dit is geen recept meer. */
export const MAX_PHOTOS = 5;
