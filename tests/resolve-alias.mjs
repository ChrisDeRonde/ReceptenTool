import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

/**
 * Twee dingen die Node niet uit zichzelf doet en een bundler wel.
 *
 * `@/lib/x` is het pad-alias uit tsconfig; dat vertalen we naar `src/lib/x`.
 * En de bron importeert elkaar zonder bestandsextensie (`./schema`), wat in
 * ESM niet mag maar in een bundler normaal is; daar plakken we `.ts` achter.
 *
 * Zo draaien de tests rechtstreeks op de TypeScript-bestanden — Node 22
 * streept de types er zelf af — zonder eerst te compileren en zonder dat de
 * app-code iets van de tests hoeft te weten.
 */

const ROOT = path.resolve(fileURLToPath(new URL("../src/", import.meta.url)));

function bestand(...kandidaten) {
  return kandidaten.find((pad) => existsSync(pad) && statSync(pad).isFile());
}

export function resolve(specifier, context, next) {
  let basis = null;

  if (specifier.startsWith("@/")) {
    basis = path.join(ROOT, specifier.slice(2));
  } else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    basis = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  } else {
    // Pakketten en alles met een extensie: gewoon doorgeven.
    return next(specifier, context);
  }

  const gevonden = bestand(
    basis,
    `${basis}.ts`,
    `${basis}.tsx`,
    path.join(basis, "index.ts"),
  );

  return next(gevonden ? pathToFileURL(gevonden).href : specifier, context);
}
