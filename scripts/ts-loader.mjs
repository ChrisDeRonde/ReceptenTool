/**
 * App-code rechtstreeks vanuit Node kunnen draaien.
 *
 * De bron gebruikt het pad-alias uit tsconfig (`@/lib/...`) en laat extensies
 * weg; Node kent allebei niet. In plaats van de bron te verbouwen of eerst te
 * compileren vertaalt deze hook `@/x` naar `src/x` en plakt de ontbrekende
 * `.ts` erachter. Node 22 streept de types er zelf af.
 *
 * Gebruikt door de testrunner én door `scripts/export.mjs`, dat de
 * markdown-opmaak uit `src/lib/recipe/markdown.ts` haalt. Vandaar dat dit in
 * `scripts/` staat en niet in `tests/`: het is gereedschap, geen test.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./resolve-alias.mjs", pathToFileURL("./scripts/"));
