import { TabBar } from "@/components/TabBar";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** De gewone app: inhoud in een leeskolom, tabbalk onderaan. */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Het aantal wachtende items staat als teller op de Inbox-tab, zodat je niet
  // hoeft te kijken of er iets is blijven hangen.
  const [openItems, listItems] = await Promise.all([
    prisma.shareItem.count({
      where: { status: { in: ["pending", "processing", "needs_input", "failed"] } },
    }),
    prisma.shoppingItem.count({ where: { checked: false } }),
  ]);

  return (
    <div className="shell">
      {children}
      <TabBar openItems={openItems} listItems={listItems} />
    </div>
  );
}
