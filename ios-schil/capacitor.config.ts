/**
 * Voorbeeld voor in de hoofdmap van de repo, na `npx cap init`.
 *
 * De schil is een venster en verder niets: hij laadt jouw server en heeft
 * geen kopie van de app aan boord. Zonder bereikbare server is het een leeg
 * scherm — dat is geen bug maar de opzet.
 */
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "nl.jouwnaam.klapper",
  appName: "Klapper",

  // Capacitor wil een webmap, ook als hij hem niet gebruikt. `public` bestaat
  // al en bevat niets geheims.
  webDir: "public",

  server: {
    // Hetzelfde adres als APP_BASE_URL in je .env, zonder afsluitende slash.
    // Móet https zijn: met http blokkeert iOS de verbinding en zie je een wit
    // scherm zonder uitleg.
    url: "https://klapper.jouw-tailnet.ts.net",
    cleartext: false,
  },

  ios: {
    // De app tekent zelf tot in de hoeken; de veilige zones zijn in de CSS al
    // opgevangen met env(safe-area-inset-*).
    contentInset: "never",
    // Papierkleur, zodat je bij het opstarten geen wit schokje ziet.
    backgroundColor: "#f8f5ef",
  },
};

export default config;
