import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDir, cleanupDir } from '../helpers.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

let masterDir = '';

beforeEach(() => {
  masterDir = createTempDir();
});
afterEach(() => {
  cleanupDir(masterDir);
});

describe('tracking', () => {
  it('returns empty tracking for new master', async () => {
    const { readTracking } = await import('../../src/core/tracking.js');
    const tracking = readTracking(masterDir);
    expect(tracking).toEqual({ version: 1, skills: {} });
  });

  it('adds a link entry', async () => {
    const { readTracking, addLink } = await import('../../src/core/tracking.js');
    addLink(masterDir, 'my-skill', '/tmp/project', 'own');
    const tracking = readTracking(masterDir);
    expect(tracking.skills['my-skill']).toBeDefined();
    expect(tracking.skills['my-skill'].linkedTo).toContain('/tmp/project');
    expect(tracking.skills['my-skill'].type).toBe('own');
  });

  it('does not duplicate a link entry', async () => {
    const { addLink, readTracking } = await import('../../src/core/tracking.js');
    addLink(masterDir, 'my-skill', '/tmp/project', 'own');
    addLink(masterDir, 'my-skill', '/tmp/project', 'own');
    const tracking = readTracking(masterDir);
    expect(tracking.skills['my-skill'].linkedTo).toHaveLength(1);
  });

  it('removes a link entry', async () => {
    const { addLink, removeLink, readTracking } = await import('../../src/core/tracking.js');
    addLink(masterDir, 'my-skill', '/tmp/project', 'own');
    const removed = removeLink(masterDir, 'my-skill', '/tmp/project');
    expect(removed).toBe(true);
    const tracking = readTracking(masterDir);
    expect(tracking.skills['my-skill']).toBeUndefined();
  });

  it('removeLink returns false for non-existent link', async () => {
    const { removeLink } = await import('../../src/core/tracking.js');
    const removed = removeLink(masterDir, 'ghost', '/tmp/project');
    expect(removed).toBe(false);
  });

  it('removeAllLinks returns all targets and clears entry', async () => {
    const { addLink, removeAllLinks, readTracking } = await import('../../src/core/tracking.js');
    addLink(masterDir, 's1', '/tmp/a', 'own');
    addLink(masterDir, 's1', '/tmp/b', 'own');
    const targets = removeAllLinks(masterDir, 's1');
    expect(targets).toEqual(['/tmp/a', '/tmp/b']);
    const tracking = readTracking(masterDir);
    expect(tracking.skills['s1']).toBeUndefined();
  });

  it('persists tracking to disk', async () => {
    const { addLink, readTracking } = await import('../../src/core/tracking.js');
    addLink(masterDir, 'persist', '/tmp/p', 'skills.sh');
    // Re-read from disk via fresh import
    const { readTracking: read2 } = await import('../../src/core/tracking.js');
    const tracking = read2(masterDir);
    expect(tracking.skills['persist'].linkedTo).toContain('/tmp/p');
  });

  describe('reconcileTracking', () => {
    it('removes stale entries for missing symlinks', async () => {
      const { addLink, reconcileTracking, readTracking } = await import('../../src/core/tracking.js');
      const { mkdirSync, symlinkSync, writeFileSync } = await import('node:fs');
      // Add a link to a real project with a real symlink
      const projectDir = join(masterDir, '..', 'fake-project');
      mkdirSync(projectDir, { recursive: true });
      mkdirSync(join(projectDir, '.agents', 'skills'), { recursive: true });
      const target = join(projectDir, '.agents', 'skills', 'good-skill');
      writeFileSync(join(masterDir, 'skillsrc'), 'hello');
      symlinkSync(join(masterDir, 'skillsrc'), target);

      addLink(masterDir, 'good-skill', projectDir, 'own');
      addLink(masterDir, 'stale-skill', '/tmp/non-existent-project', 'own');

      const { staleRemoved, skills } = reconcileTracking(masterDir);
      expect(staleRemoved).toBe(1);
      expect(skills).toBe(1);

      const tracking = readTracking(masterDir);
      expect(tracking.skills['good-skill']).toBeDefined();
      expect(tracking.skills['stale-skill']).toBeUndefined();
    });

    it('does nothing when all tracking entries are valid', async () => {
      const { addLink, reconcileTracking } = await import('../../src/core/tracking.js');
      const { mkdirSync, symlinkSync, writeFileSync } = await import('node:fs');
      const projectDir = join(masterDir, '..', 'valid-proj');
      mkdirSync(join(projectDir, '.agents', 'skills'), { recursive: true });
      writeFileSync(join(masterDir, 'src'), 'data');
      symlinkSync(join(masterDir, 'src'), join(projectDir, '.agents', 'skills', 'v'));

      addLink(masterDir, 'v', projectDir, 'own');

      const { staleRemoved, skills } = reconcileTracking(masterDir);
      expect(staleRemoved).toBe(0);
      expect(skills).toBe(1);
    });

    it('does nothing on empty tracking', async () => {
      const { reconcileTracking } = await import('../../src/core/tracking.js');
      const { staleRemoved, skills } = reconcileTracking(masterDir);
      expect(staleRemoved).toBe(0);
      expect(skills).toBe(0);
    });
  });
});
