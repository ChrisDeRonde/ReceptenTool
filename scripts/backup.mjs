#!/usr/bin/env node
/**
 * Back-up van de database én de foto's.
 *
 * Die twee horen bij elkaar: in de database staat alleen de verwijzing naar
 * een foto, dus een database zonder uploadmap is een receptenlijst met lege
 * vakken, en een uploadmap zonder database is een stapel losse plaatjes.
 * Daarom maakt dit script ze in één run, in één map, met dezelfde datum.
 *
 * De database wordt niet gekopieerd maar gedumpt met `VACUUM INTO`. Een
 * draaiende SQLite-database kopiëren met `cp` levert een half bestand op als
 * er net iets geschreven wordt; `VACUUM INTO` schrijft een samenhangende
 * momentopname en mag gewoon terwijl de app draait.
 *
 * Draaien:  npm run db:backup
 * Elke nacht om 03:15 (crontab -e):
 *   15 3 * * * cd /pad/naar/receptentool && /usr/bin/npm run db:backup >> backups/log.txt 2>&1
 */

import { execFile } from "node:child_process";
import {
  cp,
  link,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import Database from "better-sqlite3";

const run = promisify(execFile);

const root = process.cwd();
if (existsSync(path.join(root, ".env"))) process.loadEnvFile(path.join(root, ".env"));

/** Hoeveel runs blijven staan. Twee weken is genoeg om een fout op te merken. */
const KEEP = Number(process.env.BACKUP_KEEP ?? 14);

const STATUS_FILE = "laatste-backup.json";

function databaseFile() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:")) {
    throw new Error(
      `Dit script back-upt SQLite. DATABASE_URL wijst naar iets anders (${url.split(":")[0]}:…); ` +
        "gebruik dan het back-upgereedschap van die database.",
    );
  }
  const file = url.slice("file:".length);
  return path.isAbsolute(file) ? file : path.resolve(root, file);
}

function uploadDir() {
  return process.env.UPLOAD_DIR ?? path.join(root, "uploads");
}

function backupDir() {
  return process.env.BACKUP_DIR ?? path.join(root, "backups");
}

/** 2026-08-11_031500 — sorteert vanzelf op tijd. */
function stamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function human(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * De database wegschrijven en meteen controleren of het resultaat leesbaar is.
 *
 * Zonder die controle weet je alleen dat er een bestand ontstond, en dat is
 * precies de zekerheid die je niet hebt op de dag dat je hem nodig hebt.
 */
async function dumpDatabase(source, target) {
  const db = new Database(source, { readonly: true });
  try {
    // Het pad gaat als SQL-tekenreeks mee, dus enkele quotes verdubbelen.
    db.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
  } finally {
    db.close();
  }

  const copy = new Database(target, { readonly: true });
  try {
    const check = copy.pragma("integrity_check", { simple: true });
    if (check !== "ok") throw new Error(`Kopie is niet in orde: ${check}`);
    const { count } = copy.prepare("SELECT COUNT(*) AS count FROM Recipe").get();
    return count;
  } finally {
    copy.close();
  }
}

/** Naam, grootte en wijzigingstijd van alles in de uploadmap. */
async function photoManifest(dir) {
  if (!existsSync(dir)) return [];
  const names = (await readdir(dir)).filter((name) => !name.startsWith(".")).sort();
  const rows = [];
  for (const name of names) {
    const info = await stat(path.join(dir, name));
    if (info.isFile()) rows.push(`${name} ${info.size} ${Math.floor(info.mtimeMs)}`);
  }
  return rows;
}

/**
 * De foto's in één archief. Ze zijn onveranderlijk (elke foto krijgt bij het
 * opslaan een nieuwe naam), dus is er meestal niets veranderd sinds gisteren.
 * In dat geval koppelen we het archief van de vorige run erbij in plaats van
 * hetzelfde nog eens weg te schrijven: elke map blijft compleet, maar veertien
 * dagen foto's kosten één keer schijfruimte.
 */
async function archivePhotos(dir, target, manifest, previous) {
  if (manifest.length === 0) return { reused: false, bytes: 0 };

  if (previous) {
    try {
      await link(previous, target);
      const info = await stat(target);
      return { reused: true, bytes: info.size };
    } catch {
      // Andere schijf, of een bestandssysteem zonder harde links. Dan gewoon
      // kopiëren; het resultaat is hetzelfde, het kost alleen ruimte.
      await cp(previous, target);
      const info = await stat(target);
      return { reused: true, bytes: info.size };
    }
  }

  // Geen compressie: het zijn JPEG's en PNG's, die krimpen toch niet, en zo
  // blijft het archief met een kale `tar xf` uit te pakken.
  await run("tar", ["-cf", target, "-C", path.dirname(dir), path.basename(dir)]);
  const info = await stat(target);
  return { reused: false, bytes: info.size };
}

/** Kan het foto-archief van de vorige run hergebruikt worden? */
async function reusablePhotoArchive(dest, manifest) {
  const runs = await previousRuns(dest);
  for (const folder of runs) {
    const listFile = path.join(dest, folder, "fotos.lijst");
    const archive = path.join(dest, folder, "fotos.tar");
    if (!existsSync(listFile) || !existsSync(archive)) continue;
    const previous = await readFile(listFile, "utf8");
    return previous === manifest.join("\n") ? archive : null;
  }
  return null;
}

/** Bestaande runmappen, nieuwste eerst. */
async function previousRuns(dest) {
  if (!existsSync(dest)) return [];
  const entries = await readdir(dest, { withFileTypes: true });
  return entries
    .filter((entry) =>
      entry.isDirectory() && /^\d{4}-\d{2}-\d{2}_\d{4,6}(-\d+)?$/.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort()
    .reverse();
}

/**
 * Een eigen, lege map voor deze run.
 *
 * Niet op de klok vertrouwen voor uniciteit: draai je hem twee keer achter
 * elkaar, dan is de stempel gelijk en weigert `VACUUM INTO` te schrijven naar
 * een bestand dat er al staat — met een foutmelding waar je niets aan hebt.
 * Een back-up hoort nooit te mislukken omdat je hem nog eens draait.
 */
async function makeRunDir(dest, base) {
  for (let n = 1; ; n += 1) {
    const name = n === 1 ? base : `${base}-${n}`;
    try {
      await mkdir(path.join(dest, name), { recursive: false });
      return name;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
}

async function prune(dest, keep) {
  const runs = await previousRuns(dest);
  const doomed = runs.slice(keep);
  for (const name of doomed) {
    await rm(path.join(dest, name), { recursive: true, force: true });
  }
  return doomed.length;
}

async function main() {
  const source = databaseFile();
  if (!existsSync(source)) {
    throw new Error(`Database niet gevonden: ${source}`);
  }

  const dest = backupDir();
  await mkdir(dest, { recursive: true });
  const folder = await makeRunDir(dest, stamp(new Date()));
  const target = path.join(dest, folder);

  const recipes = await dumpDatabase(source, path.join(target, "recepten.db"));

  const photos = uploadDir();
  const manifest = await photoManifest(photos);
  const reusable = await reusablePhotoArchive(dest, manifest);
  const archive = await archivePhotos(
    photos,
    path.join(target, "fotos.tar"),
    manifest,
    reusable,
  );
  if (manifest.length > 0) {
    await writeFile(path.join(target, "fotos.lijst"), manifest.join("\n"));
  }

  const dbSize = (await stat(path.join(target, "recepten.db"))).size;
  const bytes = dbSize + archive.bytes;

  await writeFile(
    path.join(dest, STATUS_FILE),
    `${JSON.stringify(
      { at: new Date().toISOString(), folder, recipes, photos: manifest.length, bytes },
      null,
      2,
    )}\n`,
  );

  const removed = await prune(dest, KEEP);

  console.log(
    `${new Date().toISOString()}  ${folder}  ` +
      `${recipes} recepten (${human(dbSize)}), ` +
      `${manifest.length} foto's (${human(archive.bytes)}${archive.reused ? ", ongewijzigd" : ""})` +
      `${removed > 0 ? `, ${removed} oude opgeruimd` : ""}`,
  );
}

main().catch((error) => {
  // Niet-nul afsluiten, anders merkt cron het verschil niet en mailt het niets.
  console.error(`${new Date().toISOString()}  BACK-UP MISLUKT: ${error.message}`);
  process.exit(1);
});
