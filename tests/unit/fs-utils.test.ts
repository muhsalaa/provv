import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const testDir = mkdtempSync(join(tmpdir(), 'provv-fs-test-'));

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('atomicWriteSync', () => {
  it('writes content to a new file', async () => {
    const { atomicWriteSync } = await import('../../src/core/fs-utils.js');
    const filePath = join(testDir, 'new.json');
    atomicWriteSync(filePath, '{"hello":"world"}\n');
    expect(readFileSync(filePath, 'utf-8')).toBe('{"hello":"world"}\n');
  });

  it('overwrites existing file atomically', async () => {
    const { atomicWriteSync } = await import('../../src/core/fs-utils.js');
    const filePath = join(testDir, 'overwrite.json');
    atomicWriteSync(filePath, '{"v1":1}\n');
    atomicWriteSync(filePath, '{"v2":2}\n');
    expect(readFileSync(filePath, 'utf-8')).toBe('{"v2":2}\n');
  });

  it('writes empty string', async () => {
    const { atomicWriteSync } = await import('../../src/core/fs-utils.js');
    const filePath = join(testDir, 'empty.json');
    atomicWriteSync(filePath, '');
    expect(readFileSync(filePath, 'utf-8')).toBe('');
  });

  it('writes large content without corruption', async () => {
    const { atomicWriteSync } = await import('../../src/core/fs-utils.js');
    const filePath = join(testDir, 'large.json');
    const large = JSON.stringify({ data: 'x'.repeat(100_000) });
    atomicWriteSync(filePath, large);
    const read = readFileSync(filePath, 'utf-8');
    expect(read).toBe(large);
    expect(read.length).toBe(large.length);
  });
});
