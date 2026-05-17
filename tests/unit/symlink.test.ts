import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDir, cleanupDir } from '../helpers.js';
import { existsSync, mkdirSync, writeFileSync, lstatSync, readlinkSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let tmpDir = '';
let gitDir = '';

beforeEach(() => {
  tmpDir = createTempDir();
  gitDir = createTempDir();
  mkdirSync(join(gitDir, '.git', 'info'), { recursive: true });
  writeFileSync(join(gitDir, '.git', 'info', 'exclude'), '');
});
afterEach(() => {
  cleanupDir(tmpDir);
  cleanupDir(gitDir);
});

describe('symlink', () => {
  it('creates a symlink', async () => {
    const { createSymlink } = await import('../../src/core/symlink.js');
    const source = join(tmpDir, 'source.txt');
    const target = join(tmpDir, 'link.txt');
    writeFileSync(source, 'hello');
    createSymlink(target, source);
    expect(existsSync(target)).toBe(true);
    // Use lstatSync to check symlink (statSync follows the link)
    expect(lstatSync(target).isSymbolicLink()).toBe(true);
    expect(readlinkSync(target)).toBe(source);
  });

  it('removes existing symlink before recreating', async () => {
    const { createSymlink } = await import('../../src/core/symlink.js');
    const source1 = join(tmpDir, 'src1.txt');
    const source2 = join(tmpDir, 'src2.txt');
    const target = join(tmpDir, 'link.txt');
    writeFileSync(source1, 'one');
    writeFileSync(source2, 'two');
    createSymlink(target, source1);
    createSymlink(target, source2);
    expect(readlinkSync(target)).toBe(source2);
  });

  it('overwrites real file to create symlink', async () => {
    const { createSymlink } = await import('../../src/core/symlink.js');
    const target = join(tmpDir, 'real.txt');
    const source = join(tmpDir, 'original.txt');
    writeFileSync(target, 'real file');
    writeFileSync(source, 'original');
    createSymlink(target, source);
    expect(lstatSync(target).isSymbolicLink()).toBe(true);
    expect(readlinkSync(target)).toBe(source);
  });

  it('removes a symlink', async () => {
    const { createSymlink, removeSymlink } = await import('../../src/core/symlink.js');
    const target = join(tmpDir, 'to-remove');
    writeFileSync(join(tmpDir, 'src'), 'src');
    createSymlink(target, join(tmpDir, 'src'));
    const removed = removeSymlink(target);
    expect(removed).toBe(true);
    expect(existsSync(target)).toBe(false);
  });

  it('removeSymlink returns false for non-symlink', async () => {
    const { removeSymlink } = await import('../../src/core/symlink.js');
    const target = join(tmpDir, 'notalink');
    writeFileSync(target, 'text');
    const removed = removeSymlink(target);
    expect(removed).toBe(false);
  });

  it('removeSymlink returns false for missing path', async () => {
    const { removeSymlink } = await import('../../src/core/symlink.js');
    const removed = removeSymlink(join(tmpDir, 'ghost'));
    expect(removed).toBe(false);
  });
});

describe('git exclude', () => {
  it('appends pattern to .git/info/exclude', async () => {
    const { addToGitExclude } = await import('../../src/core/symlink.js');
    const added = addToGitExclude(gitDir, '.agents/skills/test');
    expect(added).toBe(true);
    const content = readFileSync(join(gitDir, '.git', 'info', 'exclude'), 'utf-8');
    expect(content).toContain('.agents/skills/test');
  });

  it('does not duplicate patterns', async () => {
    const { addToGitExclude } = await import('../../src/core/symlink.js');
    addToGitExclude(gitDir, '.agents/skills/test');
    const added = addToGitExclude(gitDir, '.agents/skills/test');
    expect(added).toBe(false);
  });

  it('removes pattern from .git/info/exclude', async () => {
    const { addToGitExclude, removeFromGitExclude } = await import('../../src/core/symlink.js');
    addToGitExclude(gitDir, '.agents/skills/test');
    const removed = removeFromGitExclude(gitDir, '.agents/skills/test');
    expect(removed).toBe(true);
    const content = readFileSync(join(gitDir, '.git', 'info', 'exclude'), 'utf-8');
    expect(content).not.toContain('.agents/skills/test');
  });

  it('returns false when no .git dir', async () => {
    const { addToGitExclude } = await import('../../src/core/symlink.js');
    const added = addToGitExclude(tmpDir, '.agents/skills/test');
    expect(added).toBe(false);
  });
});
