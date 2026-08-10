import type { NextConfig } from "next";

const config: NextConfig = {
  // Recepten komen van willekeurige sites; we tonen afbeeldingen via <img> in
  // plaats van next/image zodat we geen remote-host allowlist hoeven bij te houden.
  images: { unoptimized: true },

  experimental: {
    // Een server action mag standaard 1 MB aan body; een paar telefoonfoto's
    // gaan daar ruim overheen. Vijf foto's van 5 MB plus base64-overhead.
    serverActions: { bodySizeLimit: "40mb" },
  },
};

export default config;
