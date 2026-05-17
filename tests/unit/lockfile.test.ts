import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDir, cleanupDir } from '../helpers.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let tmpDir = '';

beforeEach(() => {
  tmpDir = createTempDir();
});
afterEach(() => {
  cleanupDir(tmpDir);
});

const testSkills = {
  a: { source: 'x/y', sourceType: 'github', computedHash: '1' },
  b: { source: 'x/z', sourceType: 'github', computedHash: '2' },
};

describe('lockfile', () => {
  it('returns null when no lockfile', async () => {
    const { readLockfile } = await import('../../src/core/lockfile.js');
    expect(readLockfile(tmpDir)).toBeNull();
  });

  it('reads and writes lockfile', async () => {
    const { writeLockfile, readLockfile } = await import('../../src/core/lockfile.js');
    writeLockfile(tmpDir, { version: 1, skills: { ...testSkills } });
    const data = readLockfile(tmpDir);
    expect(data?.skills['a'].source).toBe('x/y');
    expect(data?.skills['a'].computedHash).toBe('1');
  });

  it('removes a skill from lockfile', async () => {
    const { writeLockfile, removeSkillFromLockfile, readLockfile } = await import('../../src/core/lockfile.js');
    writeLockfile(tmpDir, { version: 1, skills: { ...testSkills } });

    const ok = removeSkillFromLockfile(tmpDir, 'a');
    expect(ok).toBe(true);

    // Verify file directly
    const raw = readFileSync(join(tmpDir, 'skills-lock.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.skills['a']).toBeUndefined();
    expect(parsed.skills['b']).toBeDefined();

    // Verify via readLockfile
    const data = readLockfile(tmpDir);
    expect(data?.skills['a']).toBeUndefined();
    expect(data?.skills['b']).toBeDefined();
  });

  it('removeSkillFromLockfile returns false for missing skill', async () => {
    const { removeSkillFromLockfile } = await import('../../src/core/lockfile.js');
    const ok = removeSkillFromLockfile(tmpDir, 'ghost');
    expect(ok).toBe(false);
  });

  it('adds a skill to lockfile', async () => {
    const { addSkillToLockfile, readLockfile } = await import('../../src/core/lockfile.js');
    addSkillToLockfile(tmpDir, 'new-skill', {
      source: 'acme/skills',
      sourceType: 'github',
      computedHash: 'hash123',
    });
    const data = readLockfile(tmpDir);
    expect(data?.skills['new-skill'].source).toBe('acme/skills');
  });

  it('removeSkillFromLockfile returns false when no lockfile', async () => {
    const { removeSkillFromLockfile } = await import('../../src/core/lockfile.js');
    expect(removeSkillFromLockfile(tmpDir, 'x')).toBe(false);
  });
});
