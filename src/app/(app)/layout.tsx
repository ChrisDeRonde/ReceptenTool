import { TabBar } from "@/components/TabBar";
import { prisma } from "@/lib/db";
import { currentPerson } from "@/lib/who";

export const dynamic = "force-dynamic";

/** De gewone app: inhoud in een leeskolom, tabbalk onderaan. */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Het aantal wachtende items staat als teller op de Inbox-tab, zodat je niet
  // hoeft te kijken of er iets is blijven hangen.
  const openItems = await prisma.shareItem.count({
    where: { status: { in: ["pending", "processing", "needs_input", "failed"] } },
  });

  return (
    <div className="shell">
      {/* Eerste ding in de tabvolgorde. Wie met een toetsenbord of een
          schermlezer werkt, moet anders bij elke paginawissel eerst langs de
          hele tabbalk voor hij bij de inhoud is. Onzichtbaar tot hij focus
          krijgt; zie `.overslaan` in globals.css. */}
      <a href="#inhoud" className="overslaan">
        Naar de inhoud
      </a>
      <div id="inhoud">{children}</div>
      <TabBar openItems={openItems} who={await currentPerson()} />
    </div>
  );
}
