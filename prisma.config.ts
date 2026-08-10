import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl } from "./src/lib/database-url";

// Prisma 7 laadt .env niet meer automatisch. Next.js doet dat wel voor de app
// zelf, dus dit is puur zodat de CLI (`prisma generate`, `db push`, `studio`)
// dezelfde database ziet.
const envFile = path.join(process.cwd(), ".env");
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    // Absoluut maken, anders resolvet de CLI het pad t.o.v. het schemabestand
    // en de runtime t.o.v. de working directory — twee databases.
    url: resolveDatabaseUrl(process.env.DATABASE_URL),
  },
});
