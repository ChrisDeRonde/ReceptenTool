import path from "node:path";

/**
 * Maakt van een relatieve SQLite-URL een absolute.
 *
 * Nodig omdat de Prisma CLI `file:./dev.db` uitlegt ten opzichte van
 * prisma/schema.prisma, terwijl de driver-adapter dat doet ten opzichte van de
 * working directory. Zonder normalisatie schrijven `prisma db push` en de app
 * naar twee verschillende bestanden. Beide kanten roepen deze functie aan, met
 * de projectroot als anker.
 *
 * Deze module wordt ook door prisma.config.ts geladen (buiten de Next-bundel
 * om), dus hij mag niets importeren behalve node-ingebouwde modules.
 */
export function resolveDatabaseUrl(
  url: string | undefined,
  projectRoot: string = process.cwd(),
): string {
  if (!url) {
    throw new Error("DATABASE_URL ontbreekt. Kopieer .env.example naar .env.");
  }
  if (!url.startsWith("file:")) {
    // Postgres, MySQL en consorten hebben geen padprobleem.
    return url;
  }

  const filePath = url.slice("file:".length);
  if (filePath.startsWith("/")) return url;

  return `file:${path.resolve(projectRoot, filePath)}`;
}
