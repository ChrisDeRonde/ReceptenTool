import Link from "next/link";

/** De gewone app: koptekst met navigatie, inhoud in een leeskolom. */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
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
  );
}
