#!/usr/bin/env node
/**
 * De app-iconen tekenen.
 *
 * Eén bron — het bordje dat ook in de app staat (Hugeicons Dish01) — en
 * daaruit alle maten die iOS, Android en straks Xcode willen. Zo hoef je bij
 * een nieuw icoon niet in acht bestanden te knippen.
 *
 * Draaien: npm run iconen
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT = path.join(process.cwd(), "public", "icoon");

/** Dezelfde salie en hetzelfde papier als in globals.css. */
const INK = "#fffefa";
const BG = "#477060";

/**
 * Het bordje uit de app, op een vierkant vlak.
 *
 * `inset` is de kantlijn: bij een maskable icoon knipt het systeem er een
 * willekeurige vorm uit, en dan moet de tekening ruim binnen de veilige cirkel
 * van 80% blijven. Bij een gewoon icoon mag hij groter staan.
 */
function svg(size, inset) {
  const glyph = size * (1 - inset * 2);
  const offset = size * inset;
  // Lijndikte meeschalen: het bronicoon is 24 breed met 1.5 lijn, maar dat
  // wordt dun op een klein icoon. Iets steviger tekent beter op 48px.
  const stroke = 1.9;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <g transform="translate(${offset} ${offset}) scale(${glyph / 24})"
     fill="none" stroke="${INK}" stroke-width="${stroke}"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 17H22"/>
    <path d="M12 7C12 7 13.5 5.96638 13.5 4.69135C13.5 2.43622 10.5 2.43622 10.5 4.69135C10.5 5.96638 12 7 12 7Z"/>
    <path d="M3 17L3.62127 19.4851C3.84385 20.3754 4.64382 21 5.56155 21H18.4384C19.3562 21 20.1561 20.3754 20.3787 19.4851L21 17"/>
    <path d="M20.5 14.5C20.0017 10.2768 16.3861 7 12 7C7.61386 7 3.99834 10.2768 3.5 14.5"/>
  </g>
</svg>`);
}

/**
 * Wat er gemaakt wordt.
 *
 * De 1024 is er voor later: dat is precies wat Xcode vraagt als je er ooit een
 * Capacitor-schil omheen zet, en dan hoef je niets opnieuw te tekenen.
 */
const TARGETS = [
  { file: "icoon-192.png", size: 192, inset: 0.2 },
  { file: "icoon-512.png", size: 512, inset: 0.2 },
  // Maskable: het systeem knipt er zelf een vorm uit, dus meer lucht eromheen.
  { file: "icoon-maskable-512.png", size: 512, inset: 0.28 },
  // iOS zet er zelf de ronde hoeken op en verdraagt geen transparantie.
  { file: "apple-touch-icon.png", size: 180, inset: 0.18 },
  { file: "icoon-1024.png", size: 1024, inset: 0.2 },
];

async function main() {
  await mkdir(OUT, { recursive: true });

  for (const target of TARGETS) {
    const png = await sharp(svg(target.size, target.inset))
      .png({ compressionLevel: 9 })
      .toBuffer();
    await writeFile(path.join(OUT, target.file), png);
    console.log(`${target.file}  ${target.size}×${target.size}  ${Math.round(png.length / 1024)} kB`);
  }

  // Het losse bronbestand erbij, voor als je het ooit wilt bijstellen.
  await writeFile(path.join(OUT, "icoon.svg"), svg(512, 0.2));
  console.log("icoon.svg");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
