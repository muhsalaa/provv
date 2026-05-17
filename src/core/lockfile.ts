import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SkillsLockFile, SkillsLockSkill } from '../types.js';

const LOCKFILE_NAME = 'skills-lock.json';

export function getLockfilePath(masterPath: string): string {
  return join(masterPath, LOCKFILE_NAME);
}

export function readLockfile(masterPath: string): SkillsLockFile | null {
  const path = getLockfilePath(masterPath);
  try {
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw) as SkillsLockFile;
  } catch {
    return null;
  }
}

export function writeLockfile(masterPath: string, data: SkillsLockFile): void {
  const path = getLockfilePath(masterPath);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

export function removeSkillFromLockfile(masterPath: string, skillName: string): boolean {
  const lockfile = readLockfile(masterPath);
  if (!lockfile) return false;
  if (!lockfile.skills[skillName]) return false;

  delete lockfile.skills[skillName];
  writeLockfile(masterPath, lockfile);
  return true;
}

export function addSkillToLockfile(
  masterPath: string,
  skillName: string,
  entry: SkillsLockSkill,
): void {
  const lockfile = readLockfile(masterPath) ?? { version: 1, skills: {} };
  lockfile.skills[skillName] = entry;
  writeLockfile(masterPath, lockfile);
}
