import { readFileSync, existsSync } from 'node:fs';
import { atomicWriteSync } from './fs-utils.js';
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
  atomicWriteSync(path, JSON.stringify(data, null, 2) + '\n');
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

/**
 * Human-friendly display name for a skill's source repo.
 * Extracts owner/repo from a GitHub URL or `owner/repo` shorthand.
 * Falls back to the raw source, or 'skills.sh' if unknown.
 */
export function getSkillSource(masterPath: string, skillName: string): string {
  const lockfile = readLockfile(masterPath);
  const source = lockfile?.skills[skillName]?.source;
  if (!source) return 'skills.sh';

  // GitHub URL: https://github.com/owner/repo[.git][?params]
  const gh = source.match(/github\.com\/([^/?#]+)\/([^/?#]+)/);
  if (gh) return `${gh[1]}/${gh[2].replace(/\.git$/, '')}`;

  // owner/repo shorthand
  const short = source.match(/^([\w.-]+\/[\w.-]+)/);
  if (short) return short[1];

  return source;
}
