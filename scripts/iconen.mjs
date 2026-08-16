#!/usr/bin/env node
/**
 * De app-iconen tekenen.
 *
 * Eén bron — het merk van Klapper: een kookboek met een koksmuts en een lint —
 * en daaruit alle maten die iOS, Android en Xcode willen. Zo hoef je bij een
 * wijziging niet in zes bestanden te knippen.
 *
 * Draaien: npm run iconen
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT = path.join(process.cwd(), "public", "icoon");

/** Dezelfde salie en hetzelfde papier als in globals.css, plus het lint. */
const PAPIER = "#fffefa";
const SALIE = "#477060";
const LINT = "#d8a441";

/**
 * Het merk op een vierkant vlak, omgekeerd: een papieren boek op salie.
 *
 * Zo is de tegel zelf de kleurvlek tussen de andere iconen op een beginscherm,
 * in plaats van een klein merkje op een lichte achtergrond.
 *
 * `inset` is de kantlijn: bij een maskable icoon knipt het systeem er een
 * willekeurige vorm uit, en dan moet de tekening ruim binnen de veilige cirkel
 * van 80% blijven. Bij een gewoon icoon mag hij groter staan.
 */
function svg(size, inset) {
  const glyph = size * (1 - inset * 2);
  const offset = size * inset;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${SALIE}"/>
  <g transform="translate(${offset} ${offset}) scale(${glyph / 24})">
    <rect x="3.2" y="1.8" width="17.6" height="19.6" rx="2.6" fill="${PAPIER}"/>
    <path d="M10 15.6 H13.8 V23.4 L11.9 21.6 L10 23.4 Z" fill="${LINT}"/>
    <rect x="5.9" y="15.9" width="12.2" height="3" rx="1.3" fill="${SALIE}"/>
    <circle cx="8.9" cy="8.1" r="2.85" fill="${SALIE}"/>
    <circle cx="15.1" cy="8.1" r="2.85" fill="${SALIE}"/>
    <circle cx="12" cy="6.7" r="3.45" fill="${SALIE}"/>
    <rect x="8.7" y="10.1" width="6.6" height="3.3" rx="0.8" fill="${SALIE}"/>
  </g>
</svg>`);
}

/**
 * Wat er gemaakt wordt.
 *
 * De 1024 is wat Xcode vraagt voor de app-schil; die staat in `ios-schil/`.
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
