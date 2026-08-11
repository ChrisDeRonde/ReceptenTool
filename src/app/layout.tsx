import type { Metadata, Viewport } from "next";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recepten",
  description: "Recepten van Instagram, AH en websites, netjes opgeslagen.",
  applicationName: "Recepten",
  icons: {
    icon: [
      { url: "/icoon/icoon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icoon/icoon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icoon/apple-touch-icon.png",
  },
  appleWebApp: {
    // Zonder dit opent "Zet op beginscherm" alsnog een Safari-venster met balk.
    capable: true,
    title: "Recepten",
    // Doorzichtige statusbalk: de klok staat over onze eigen achtergrond, en
    // de veilige zones vangen we in CSS op.
    statusBarStyle: "default",
  },
  formatDetection: {
    // Anders maakt iOS van "200 g" en van tijden ineens telefoonnummers.
    telephone: false,
  },
  other: {
    // Next zendt tegenwoordig alleen `mobile-web-app-capable`. Safari kijkt
    // van oudsher naar de apple-variant, en zonder die tag opent "Zet op
    // beginscherm" alsnog een venster mét adresbalk — precies wat we niet
    // willen. Nieuwere iOS-versies leiden het ook uit het manifest af; beide
    // meesturen kost niets en dekt allebei de gevallen.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Kookmodus staat tot in de hoeken; de veilige zones regelen we in CSS.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8faf9" },
    { media: "(prefers-color-scheme: dark)", color: "#101413" },
  ],
};

/**
 * Alleen het document. De koptekst met navigatie zit in `(app)/layout.tsx`,
 * zodat de kookmodus — die daarbuiten valt — een leeg scherm krijgt zonder
 * app-chrome erboven.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
