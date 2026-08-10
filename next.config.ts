import type { NextConfig } from "next";

const config: NextConfig = {
  // Recepten komen van willekeurige sites; we tonen afbeeldingen via <img> in
  // plaats van next/image zodat we geen remote-host allowlist hoeven bij te houden.
  images: { unoptimized: true },
};

export default config;
