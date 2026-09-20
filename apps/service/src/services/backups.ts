import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// postgres-backup-local writes into daily/, weekly/, monthly/, and last/ under the backup
// directory, so a shallow walk finds every dump.
const MAX_DEPTH = 3;

/**
 * The modification time of the newest file under the backup directory, or null when there is
 * none or the directory cannot be read (System health shows that as "no backup").
 */
export async function newestBackupTime(directory: string | undefined): Promise<Date | null> {
  if (directory === undefined) return null;
  let newest: Date | null = null;

  async function walk(path: string, depth: number): Promise<void> {
    let entries;
    try {
      entries = await readdir(path, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) {
        if (depth < MAX_DEPTH) await walk(full, depth + 1);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        try {
          const { mtime } = await stat(full);
          if (newest === null || mtime > newest) newest = mtime;
        } catch {
          // A file pruned mid-walk is simply not the newest.
        }
      }
    }
  }

  await walk(directory, 1);
  return newest;
}
