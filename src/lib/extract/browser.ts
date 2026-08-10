import { createRequire } from "node:module";
import path from "node:path";

/**
 * Optionele fallback: de pagina in een echte browser renderen.
 *
 * Nodig voor sites die hun recept pas met JavaScript opbouwen. De meeste
 * receptensites hebben server-side JSON-LD en hebben dit niet nodig, dus staat
 * het standaard uit — een browser meeslepen maakt de deploy fors zwaarder.
 *
 * Aanzetten:
 *   npm install playwright && npx playwright install chromium
 *   SCRAPER_BROWSER=1 in .env
 */

// Verankerd op de projectroot in plaats van op import.meta.url: in een
// gebundelde Next-chunk wijst die laatste niet naar een pad waarvandaan
// node_modules te vinden is.
const requireFromProject = createRequire(
  path.join(process.cwd(), "package.json"),
);

type PlaywrightModule = {
  chromium: {
    launch(options?: {
      headless?: boolean;
      executablePath?: string;
    }): Promise<BrowserLike>;
  };
};

type BrowserLike = {
  newPage(options?: { locale?: string }): Promise<PageLike>;
  close(): Promise<void>;
};

type PageLike = {
  goto(
    url: string,
    options?: { waitUntil?: string; timeout?: number },
  ): Promise<unknown>;
  content(): Promise<string>;
  url(): string;
  waitForTimeout(ms: number): Promise<void>;
};

export type RenderOutcome =
  | { ok: true; url: string; html: string }
  | { ok: false; reason: string };

export function browserEnabled(): boolean {
  const flag = process.env.SCRAPER_BROWSER?.toLowerCase();
  return flag === "1" || flag === "true";
}

export async function renderPage(url: string): Promise<RenderOutcome> {
  // De modulenaam komt uit een variabele zodat de bundler playwright niet
  // probeert mee te nemen als het niet geïnstalleerd is. Meteen ook de knop om
  // playwright-core te gebruiken, dat geen browsers meedownloadt.
  const moduleName = process.env.SCRAPER_BROWSER_MODULE ?? "playwright";

  let playwright: PlaywrightModule;
  try {
    playwright = requireFromProject(moduleName) as PlaywrightModule;
  } catch {
    return {
      ok: false,
      reason: `SCRAPER_BROWSER staat aan maar '${moduleName}' is niet geïnstalleerd`,
    };
  }

  let browser: BrowserLike | null = null;
  try {
    browser = await playwright.chromium.launch({
      headless: true,
      // Zo hergebruik je een al aanwezige Chromium in plaats van er een te
      // laten downloaden.
      ...(process.env.SCRAPER_BROWSER_EXECUTABLE
        ? { executablePath: process.env.SCRAPER_BROWSER_EXECUTABLE }
        : {}),
    });
    const page = await browser.newPage({ locale: "nl-NL" });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
    // Even ademruimte voor scripts die het recept pas na hydratatie invullen.
    await page.waitForTimeout(1_500);
    return { ok: true, url: page.url(), html: await page.content() };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await browser?.close().catch(() => {});
  }
}
