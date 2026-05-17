import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDir, cleanupDir } from '../helpers.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

let tmpDir = '';

beforeEach(() => {
  tmpDir = createTempDir();
});
afterEach(() => {
  cleanupDir(tmpDir);
});

async function detectProject() {
  const mod = await import('../../src/utils/project.js');
  return mod.detectProject(tmpDir);
}

describe('project detection', () => {
  it('detects .git', async () => {
    mkdirSync(join(tmpDir, '.git'), { recursive: true });
    const result = await detectProject();
    expect(result.isProject).toBe(true);
    expect(result.reason).toContain('.git');
  });

  it('detects .agents', async () => {
    mkdirSync(join(tmpDir, '.agents'), { recursive: true });
    const result = await detectProject();
    expect(result.isProject).toBe(true);
    expect(result.reason).toContain('.agents');
  });

  it('detects CLAUDE.md', async () => {
    writeFileSync(join(tmpDir, 'CLAUDE.md'), '# instructions');
    const result = await detectProject();
    expect(result.isProject).toBe(true);
    expect(result.reason).toContain('CLAUDE.md');
  });

  it('detects AGENTS.md', async () => {
    writeFileSync(join(tmpDir, 'AGENTS.md'), '# agents');
    const result = await detectProject();
    expect(result.isProject).toBe(true);
    expect(result.reason).toContain('AGENTS.md');
  });

  it('returns false for empty dir', async () => {
    const result = await detectProject();
    expect(result.isProject).toBe(false);
  });

  it('returns false for non-existent dir', async () => {
    const { detectProject: dp } = await import('../../src/utils/project.js');
    const result = dp('/nonexistent-path-xyz');
    expect(result.isProject).toBe(false);
  });
});
