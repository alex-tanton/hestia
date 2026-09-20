import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { newestBackupTime } from './backups.js';

const made: string[] = [];

afterEach(async () => {
  await Promise.all(made.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function fixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'hearth-backups-'));
  made.push(dir);
  return dir;
}

describe('newestBackupTime', () => {
  it('finds the newest file in the backup container’s layout', async () => {
    const dir = await fixture();
    await mkdir(join(dir, 'daily'));
    await mkdir(join(dir, 'weekly'));
    const older = join(dir, 'weekly', 'postgres-2026-09-13.sql.gz');
    const newer = join(dir, 'daily', 'postgres-2026-09-18.sql.gz');
    await writeFile(older, 'x');
    await writeFile(newer, 'x');
    await utimes(older, new Date('2026-09-13T02:00:00Z'), new Date('2026-09-13T02:00:00Z'));
    await utimes(newer, new Date('2026-09-18T02:00:00Z'), new Date('2026-09-18T02:00:00Z'));

    expect((await newestBackupTime(dir))?.toISOString()).toBe('2026-09-18T02:00:00.000Z');
  });

  it('ignores files nested deeper than the layout', async () => {
    const dir = await fixture();
    await mkdir(join(dir, 'a', 'b', 'c'), { recursive: true });
    await writeFile(join(dir, 'a', 'b', 'c', 'deep.sql.gz'), 'x');
    expect(await newestBackupTime(dir)).toBeNull();
  });

  it('is null for an empty, missing, or unset directory', async () => {
    expect(await newestBackupTime(await fixture())).toBeNull();
    expect(await newestBackupTime('/nonexistent/hearth/backups')).toBeNull();
    expect(await newestBackupTime(undefined)).toBeNull();
  });
});
