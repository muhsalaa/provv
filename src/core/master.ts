import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { SkillOption } from '../types.js';
import { readLockfile } from './lockfile.js';
import { readConfig } from './config.js';

export function isMaster(path: string): boolean {
  // Config points here → definitive master
  const config = readConfig();
  if (config?.masterPath === path) return true;

  // Has skills/ dir with actual subdirectories → strong signal
  const skillsDir = join(path, 'skills');
  if (existsSync(skillsDir)) {
    const entries = readdirSync(skillsDir).filter((name) => {
      const fullPath = join(skillsDir, name);
      return statSync(fullPath).isDirectory();
    });
    if (entries.length > 0) return true;
  }

  return false;
}

export function validateMaster(path: string): string[] {
  const errors: string[] = [];
  if (!existsSync(path)) {
    errors.push(`Master path does not exist: ${path}`);
    return errors;
  }
  if (!existsSync(join(path, 'skills')) && !existsSync(join(path, 'skills-lock.json'))) {
    errors.push(`Not a valid master: missing both skills/ directory and skills-lock.json`);
  }
  return errors;
}

export function discoverOwnSkills(masterPath: string): SkillOption[] {
  const skillsDir = join(masterPath, 'skills');
  if (!existsSync(skillsDir)) return [];

  try {
    const entries = readdirSync(skillsDir);
    return entries
      .filter((name) => {
        const fullPath = join(skillsDir, name);
        return statSync(fullPath).isDirectory();
      })
      .map((name) => ({
        name,
        type: 'own' as const,
        synced: true,
      }));
  } catch {
    return [];
  }
}

export function discoverSkillsShSkills(masterPath: string): SkillOption[] {
  const lockfile = readLockfile(masterPath);
  if (!lockfile) return [];

  const skillsDir = join(masterPath, '.agents', 'skills');
  return Object.keys(lockfile.skills).map((name) => ({
    name,
    type: 'skills.sh' as const,
    synced: existsSync(join(skillsDir, name)),
  }));
}

export function getAllSkills(masterPath: string): SkillOption[] {
  const own = discoverOwnSkills(masterPath);
  const skillsSh = discoverSkillsShSkills(masterPath);

  const skillsShFiltered = skillsSh.filter(
    (s) => !own.some((o) => o.name === s.name),
  );

  return [...own, ...skillsShFiltered];
}

export function detectFlatSkills(path: string): string[] {
  try {
    const entries = readdirSync(path);
    return entries.filter((name) => {
      const fullPath = join(path, name);
      if (!statSync(fullPath).isDirectory()) return false;
      if (name.startsWith('.') || name === 'node_modules' || name === 'dist') return false;
      return (
        existsSync(join(fullPath, 'SKILL.md')) || existsSync(join(fullPath, 'CATALOG.md'))
      );
    });
  } catch {
    return [];
  }
}
