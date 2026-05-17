import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTempDir, cleanupDir, createOwnSkill, createLockfile, cleanConfig, writeJson } from '../helpers.js';
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { rmSync, existsSync } from 'node:fs';

const TEST_HOME = '/tmp/provv-test-home-master';

vi.mock('node:os', () => ({
  homedir: () => TEST_HOME,
}));

let tmpDir = '';

beforeEach(() => {
  // Clean config dir
  const configDir = join(TEST_HOME, '.config', 'provv');
  if (existsSync(configDir)) rmSync(configDir, { recursive: true, force: true });
  tmpDir = createTempDir();
});
afterEach(() => {
  cleanupDir(tmpDir);
});

function createConfig(path: string): void {
  const configDir = join(TEST_HOME, '.config', 'provv');
  mkdirSync(configDir, { recursive: true });
  writeJson(join(configDir, 'config.json'), { masterPath: path });
}

describe('isMaster', () => {
  it('returns true when config points here', async () => {
    createConfig(tmpDir);
    const { isMaster } = await import('../../src/core/master.js');
    expect(isMaster(tmpDir)).toBe(true);
  });

  it('returns true when skills/ has child dirs', async () => {
    createOwnSkill(tmpDir, 'my-skill');
    const { isMaster } = await import('../../src/core/master.js');
    expect(isMaster(tmpDir)).toBe(true);
  });

  it('returns false for empty dir', async () => {
    const { isMaster } = await import('../../src/core/master.js');
    expect(isMaster(tmpDir)).toBe(false);
  });

  it('returns false when only skills-lock.json exists', async () => {
    createLockfile(tmpDir, {});
    const { isMaster } = await import('../../src/core/master.js');
    expect(isMaster(tmpDir)).toBe(false);
  });
});

describe('discoverOwnSkills', () => {
  it('returns empty for empty skills/ dir', async () => {
    mkdirSync(join(tmpDir, 'skills'));
    const { discoverOwnSkills } = await import('../../src/core/master.js');
    expect(discoverOwnSkills(tmpDir)).toEqual([]);
  });

  it('discovers own skill directories', async () => {
    createOwnSkill(tmpDir, 'alpha');
    createOwnSkill(tmpDir, 'beta');
    const { discoverOwnSkills } = await import('../../src/core/master.js');
    const skills = discoverOwnSkills(tmpDir);
    expect(skills).toHaveLength(2);
    expect(skills.map((s) => s.name).sort()).toEqual(['alpha', 'beta']);
    expect(skills.every((s) => s.type === 'own')).toBe(true);
    expect(skills.every((s) => s.synced)).toBe(true);
  });

  it('ignores files in skills/ dir', async () => {
    mkdirSync(join(tmpDir, 'skills'), { recursive: true });
    writeFileSync(join(tmpDir, 'skills', 'readme.md'), 'hello');
    const { discoverOwnSkills } = await import('../../src/core/master.js');
    expect(discoverOwnSkills(tmpDir)).toEqual([]);
  });
});

describe('discoverSkillsShSkills', () => {
  it('returns empty when no lockfile', async () => {
    const { discoverSkillsShSkills } = await import('../../src/core/master.js');
    expect(discoverSkillsShSkills(tmpDir)).toEqual([]);
  });

  it('returns skills from lockfile with sync status', async () => {
    createLockfile(tmpDir, {
      alpha: { source: 'foo/bar', sourceType: 'github', computedHash: 'abc' },
      beta: { source: 'foo/bar', sourceType: 'github', computedHash: 'def' },
    });
    const skillsDir = join(tmpDir, '.agents', 'skills', 'alpha');
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(join(skillsDir, 'SKILL.md'), '# alpha');

    const { discoverSkillsShSkills } = await import('../../src/core/master.js');
    const skills = discoverSkillsShSkills(tmpDir);
    expect(skills).toHaveLength(2);
    expect(skills.find((s) => s.name === 'alpha')?.synced).toBe(true);
    expect(skills.find((s) => s.name === 'beta')?.synced).toBe(false);
    expect(skills.every((s) => s.type === 'skills.sh')).toBe(true);
  });
});

describe('detectFlatSkills', () => {
  it('detects directories with SKILL.md or CATALOG.md', async () => {
    const flatDir = join(tmpDir, 'my-custom');
    mkdirSync(flatDir, { recursive: true });
    writeFileSync(join(flatDir, 'SKILL.md'), '# my-custom');

    const { detectFlatSkills } = await import('../../src/core/master.js');
    const found = detectFlatSkills(tmpDir);
    expect(found).toContain('my-custom');
  });

  it('does not detect hidden dirs or node_modules', async () => {
    mkdirSync(join(tmpDir, '.hidden'), { recursive: true });
    writeFileSync(join(tmpDir, '.hidden', 'SKILL.md'), '# hidden');
    mkdirSync(join(tmpDir, 'node_modules'), { recursive: true });
    writeFileSync(join(tmpDir, 'node_modules', 'SKILL.md'), '# nm');

    const { detectFlatSkills } = await import('../../src/core/master.js');
    const found = detectFlatSkills(tmpDir);
    expect(found).not.toContain('.hidden');
    expect(found).not.toContain('node_modules');
  });
});
