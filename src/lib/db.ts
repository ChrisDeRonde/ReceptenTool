import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma";
import { resolveDatabaseUrl } from "@/lib/database-url";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient() {
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: resolveDatabaseUrl(process.env.DATABASE_URL),
    }),
  });
}

// In dev hergebruikt Next.js het module-scope bij hot reload; zonder deze cache
// zou elke reload een nieuwe pool openen.
export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
