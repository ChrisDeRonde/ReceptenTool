import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recepten",
  description: "Recepten van Instagram, AH en websites, netjes opgeslagen.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#16140f" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body>
        <div className="shell">
          <header className="topbar">
            <h1>
              <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
                Recepten
              </Link>
            </h1>
            <nav>
              <Link href="/">Alles</Link>
              <Link href="/inbox">Inbox</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
