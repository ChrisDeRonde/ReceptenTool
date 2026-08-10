import Link from "next/link";
import { TabBar } from "@/components/TabBar";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** De gewone app: wordmerk bovenaan, tabblok onderaan, inhoud ertussen. */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Het aantal wachtende items staat als badge op de Inbox-tab, zodat je niet
  // hoeft te kijken of er iets is blijven hangen.
  const openItems = await prisma.shareItem.count({
    where: { status: { in: ["pending", "processing", "needs_input", "failed"] } },
  });

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="wordmark">
          <Mark />
          Recepten
        </Link>
      </header>
      {children}
      <TabBar openItems={openItems} />
    </div>
  );
}

/** Drie borden op een rij. Kost geen bestand en geeft de kop een gezicht. */
function Mark() {
  return (
    <svg width="30" height="18" viewBox="0 0 30 18" aria-hidden focusable="false">
      <circle cx="7" cy="9" r="7" fill="var(--accent)" />
      <circle cx="15" cy="9" r="7" fill="var(--pop)" />
      <circle cx="23" cy="9" r="7" fill="var(--ink)" />
    </svg>
  );
}
