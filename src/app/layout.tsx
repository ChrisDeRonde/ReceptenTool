import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recepten",
  description: "Recepten van Instagram, AH en websites, netjes opgeslagen.",
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
      <body>{children}</body>
    </html>
  );
}
