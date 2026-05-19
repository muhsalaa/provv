import { writeFileSync, renameSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Atomic synchronous write: writes to a temp file, then renames over target.
 * renameSync is atomic on POSIX — no partial reads possible.
 */
export function atomicWriteSync(filePath: string, data: string): void {
  const tmpDir = mkdtempSync(join(tmpdir(), 'provv-'));
  try {
    const tmpFile = join(tmpDir, 'data.json');
    writeFileSync(tmpFile, data, 'utf-8');
    renameSync(tmpFile, filePath);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
