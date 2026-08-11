import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Waar de back-ups staan, en wat de app ervan mag weten.
 *
 * Het maken gebeurt in `scripts/backup.mjs` — buiten de app, want het moet ook
 * draaien als de app stilligt. Hier staat alleen het beetje dat de Inbox nodig
 * heeft om te kunnen tonen dat het nog gebeurt. Een back-up die stilletjes
 * gestopt is, is de duurste variant: je merkt het pas als je hem nodig hebt.
 */

export const STATUS_FILE = "laatste-backup.json";

export function backupDir(): string {
  return process.env.BACKUP_DIR ?? path.join(process.cwd(), "backups");
}

export type BackupStatus = {
  /** ISO-tijdstip van de laatste geslaagde run. */
  at: string;
  /** Naam van de map met die run erin. */
  folder: string;
  recipes: number;
  photos: number;
  bytes: number;
};

export async function readBackupStatus(): Promise<BackupStatus | null> {
  try {
    const raw = await readFile(path.join(backupDir(), STATUS_FILE), "utf8");
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === "object" &&
      value !== null &&
      typeof (value as BackupStatus).at === "string"
    ) {
      return value as BackupStatus;
    }
    return null;
  } catch {
    // Nooit gedraaid, of de map staat er niet. Beide betekenen hetzelfde.
    return null;
  }
}

/** Na hoeveel dagen stilte je ongerust mag worden. */
export const STALE_AFTER_DAYS = 3;

export function backupAgeDays(status: BackupStatus): number {
  return (Date.now() - new Date(status.at).getTime()) / 86_400_000;
}
