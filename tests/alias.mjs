/**
 * `@/lib/...` oplosbaar maken voor Node's testrunner.
 *
 * De app-code gebruikt het pad-alias uit tsconfig, en dat kent Node niet. In
 * plaats van de bron te verbouwen of eerst te compileren vertaalt deze hook
 * `@/x` naar `src/x`, met de extensie erachter. Node 22 streept de types er
 * zelf af, dus de tests draaien rechtstreeks op de TypeScript-bestanden.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./resolve-alias.mjs", pathToFileURL("./tests/"));
