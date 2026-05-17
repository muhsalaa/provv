import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { SkillOption } from '../types.js';
import { readLockfile } from './lockfile.js';

export function isMaster(path: string): boolean {
  // A master has either skills-lock.json or a skills/ directory
  return existsSync(join(path, 'skills-lock.json')) || existsSync(join(path, 'skills'));
}

export function validateMaster(path: string): string[] {
  const errors: string[] = [];
  if (!existsSync(path)) {
    errors.push(`Master path does not exist: ${path}`);
    return errors;
  }
  if (!existsSync(join(path, 'skills-lock.json')) && !existsSync(join(path, 'skills'))) {
    errors.push(`Not a valid master: missing both skills-lock.json and skills/ directory`);
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

  // Deduplicate: if name appears in both, keep own (prefer local)
  const skillsShFiltered = skillsSh.filter(
    (s) => !own.some((o) => o.name === s.name),
  );

  return [...own, ...skillsShFiltered];
}

export function detectFlatSkills(path: string): string[] {
  // Detect skill folders at root level (directories with SKILL.md or CATALOG.md)
  try {
    const entries = readdirSync(path);
    return entries.filter((name) => {
      const fullPath = join(path, name);
      if (!statSync(fullPath).isDirectory()) return false;
      // Skip common non-skill dirs
      if (name.startsWith('.') || name === 'node_modules' || name === 'dist') return false;
      // Has skill indicators
      return (
        existsSync(join(fullPath, 'SKILL.md')) || existsSync(join(fullPath, 'CATALOG.md'))
      );
    });
  } catch {
    return [];
  }
}
