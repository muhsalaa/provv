import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export function createTempDir(): string {
  const dir = `/tmp/provv-test-${randomUUID().slice(0, 8)}`;
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function cleanupDir(dir: string): void {
  if (dir && existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function writeJson(path: string, data: unknown): void {
  const dir = path.substring(0, path.lastIndexOf('/'));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

export function createOwnSkill(masterPath: string, name: string): string {
  const dir = join(masterPath, 'skills', name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), `# ${name}\n`);
  return dir;
}

export function createLockfile(masterPath: string, skills: Record<string, unknown>): void {
  writeJson(join(masterPath, 'skills-lock.json'), {
    version: 1,
    skills,
  });
}

/** Clean a config directory for a given home path */
export function cleanConfig(homePath?: string): void {
  const base = homePath || '/tmp/provv-test-home';
  const configDir = join(base, '.config', 'provv');
  if (existsSync(configDir)) {
    rmSync(configDir, { recursive: true, force: true });
  }
}
