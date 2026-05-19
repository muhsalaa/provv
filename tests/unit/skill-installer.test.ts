import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTempDir, cleanupDir, createLockfile } from '../helpers.js';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const mockExecSync = vi.fn();

vi.mock('node:child_process', () => ({
  execSync: mockExecSync,
}));

let masterDir = '';

beforeEach(() => {
  masterDir = createTempDir();
  mockExecSync.mockReset();
  // Default: mock success
  mockExecSync.mockReturnValue(Buffer.from(''));
});

afterEach(() => {
  cleanupDir(masterDir);
});

async function loadInstaller() {
  return import('../../src/core/skill-installer.js');
}

describe('installFromSkillsSh', () => {
  it('calls execSync with correct command for named skills', async () => {
    const { installFromSkillsSh } = await loadInstaller();
    const result = installFromSkillsSh(masterDir, 'user/repo', ['caveman']);
    expect(result).toBe(true);
    expect(mockExecSync).toHaveBeenCalledTimes(1);
    const [cmd, opts] = mockExecSync.mock.calls[0];
    expect(cmd).toContain('npx skills add');
    expect(cmd).toContain('user/repo');
    expect(cmd).toContain('--skill "caveman"');
    expect(cmd).toContain('--copy -y');
    expect(opts.cwd).toBe(masterDir);
    expect(opts.timeout).toBe(60_000);
  });

  it('passes timeout option to execSync', async () => {
    const { installFromSkillsSh } = await loadInstaller();
    installFromSkillsSh(masterDir, 'user/repo', ['skill-a']);
    expect(mockExecSync.mock.calls[0][1].timeout).toBe(60_000);
  });

  it('returns false when execSync throws', async () => {
    mockExecSync.mockImplementation(() => { throw new Error('npx failed'); });
    const { installFromSkillsSh } = await loadInstaller();
    const result = installFromSkillsSh(masterDir, 'user/repo', ['failing']);
    expect(result).toBe(false);
  });

  it('installs multiple skills separately', async () => {
    const { installFromSkillsSh } = await loadInstaller();
    installFromSkillsSh(masterDir, 'user/repo', ['alpha', 'beta']);
    expect(mockExecSync).toHaveBeenCalledTimes(2);
    expect(mockExecSync.mock.calls[0][0]).toContain('"alpha"');
    expect(mockExecSync.mock.calls[1][0]).toContain('"beta"');
  });

  it('installs all skills when names array is empty', async () => {
    const { installFromSkillsSh } = await loadInstaller();
    const result = installFromSkillsSh(masterDir, 'user/repo', []);
    expect(result).toBe(true);
    expect(mockExecSync).toHaveBeenCalledTimes(1);
    expect(mockExecSync.mock.calls[0][0]).toContain('--all');
  });

  it('returns false when --all install fails', async () => {
    mockExecSync.mockImplementation(() => { throw new Error('network error'); });
    const { installFromSkillsSh } = await loadInstaller();
    const result = installFromSkillsSh(masterDir, 'user/repo', []);
    expect(result).toBe(false);
  });

  it('continues installing remaining skills after one failure', async () => {
    mockExecSync
      .mockImplementationOnce(() => Buffer.from('')) // first succeeds
      .mockImplementationOnce(() => { throw new Error('fail'); }) // second fails
      .mockImplementationOnce(() => Buffer.from('')); // third succeeds
    const { installFromSkillsSh } = await loadInstaller();
    const result = installFromSkillsSh(masterDir, 'user/repo', ['a', 'b', 'c']);
    expect(result).toBe(false); // overall failure
    expect(mockExecSync).toHaveBeenCalledTimes(3); // all tried
  });

  it('creates .agents/skills dir if missing', async () => {
    const { installFromSkillsSh } = await loadInstaller();
    const skillsDir = join(masterDir, '.agents', 'skills');
    expect(existsSync(skillsDir)).toBe(false); // doesn't exist yet
    installFromSkillsSh(masterDir, 'user/repo', ['test']);
    expect(existsSync(skillsDir)).toBe(true); // created by function
  });
});

describe('updateSkillsShSkills', () => {
  it('calls execSync for each named skill', async () => {
    const { updateSkillsShSkills } = await loadInstaller();
    updateSkillsShSkills(masterDir, ['s1', 's2']);
    expect(mockExecSync).toHaveBeenCalledTimes(2);
    expect(mockExecSync.mock.calls[0][0]).toContain('update "s1"');
    expect(mockExecSync.mock.calls[1][0]).toContain('update "s2"');
  });

  it('calls execSync without args for all skills', async () => {
    const { updateSkillsShSkills } = await loadInstaller();
    updateSkillsShSkills(masterDir);
    expect(mockExecSync).toHaveBeenCalledTimes(1);
    expect(mockExecSync.mock.calls[0][0]).toBe('npx skills update -y');
    expect(mockExecSync.mock.calls[0][1].timeout).toBe(60_000);
  });

  it('does not throw on execSync failure', async () => {
    mockExecSync.mockImplementation(() => { throw new Error('fail'); });
    const { updateSkillsShSkills } = await loadInstaller();
    expect(() => updateSkillsShSkills(masterDir, ['s1'])).not.toThrow();
  });
});
