import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { readLockfile, addSkillToLockfile } from './lockfile.js';

function cleanupAgentDirs(masterPath: string): void {
  try {
    const entries = readdirSync(masterPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('.')) continue;
      if (entry.name === '.git' || entry.name === '.agents') continue;
      rmSync(join(masterPath, entry.name), { recursive: true, force: true });
    }
  } catch {
    // best-effort
  }
}

export function installFromSkillsSh(
  masterPath: string,
  repoUrl: string,
  skillNames: string[],
): boolean {
  const skillsDir = join(masterPath, '.agents', 'skills');
  if (!existsSync(skillsDir)) {
    mkdirSync(skillsDir, { recursive: true });
  }

  const names = skillNames.length > 0 ? skillNames : [];
  let success = true;

  // Batch: many skills from same repo → one `--all` call (2s vs 2s×N)
  // ponytail: threshold 2 — single skills still use --skill for precision
  if (names.length >= 2) {
    try {
      execSync(`npx skills add "${repoUrl}" --all --copy -y`, {
        cwd: masterPath,
        stdio: 'pipe',
        timeout: 120_000,
      });
      cleanupAgentDirs(masterPath);

      // Verify each requested skill landed in lockfile
      const lockfile = readLockfile(masterPath);
      for (const name of names) {
        if (!lockfile || !lockfile.skills[name]) {
          console.warn(`⚠ ${name}: lockfile entry missing after install — adding stub`);
          addSkillToLockfile(masterPath, name, {
            source: repoUrl,
            sourceType: 'skills.sh',
            computedHash: '',
          });
        }
      }
    } catch (err) {
      console.error(`Failed to install from ${repoUrl}:`, String(err));
      return false;
    }
    return true;
  }

  for (const name of names) {
    try {
      execSync(`npx skills add "${repoUrl}" --skill "${name}" --copy -y`, {
        cwd: masterPath,
        stdio: 'pipe',
        timeout: 60_000,
      });
      cleanupAgentDirs(masterPath);

      // Verify lockfile was written
      const lockfile = readLockfile(masterPath);
      if (!lockfile || !lockfile.skills[name]) {
        console.warn(`⚠ ${name}: lockfile entry missing after install — adding stub`);
        addSkillToLockfile(masterPath, name, {
          source: repoUrl,
          sourceType: 'skills.sh',
          computedHash: '',
        });
      }
    } catch (err) {
      console.error(`Failed to install ${name}:`, String(err));
      success = false;
    }
  }

  if (names.length === 0) {
    try {
      execSync(`npx skills add "${repoUrl}" --all --copy -y`, {
        cwd: masterPath,
        stdio: 'pipe',
        timeout: 60_000,
      });
      cleanupAgentDirs(masterPath);
    } catch (err) {
      console.error(`Failed to install from ${repoUrl}:`, String(err));
      return false;
    }
  }

  return success;
}

export function updateSkillsShSkills(
  masterPath: string,
  skillNames?: string[],
): void {
  if (skillNames && skillNames.length > 0) {
    for (const name of skillNames) {
      try {
        execSync(`npx skills update "${name}" -y`, {
          cwd: masterPath,
          stdio: 'pipe',
          timeout: 60_000,
        });
        cleanupAgentDirs(masterPath);
      } catch (err) {
        console.error(`Failed to update ${name}:`, String(err));
      }
    }
  } else {
    try {
      execSync('npx skills update -y', {
        cwd: masterPath,
        stdio: 'pipe',
        timeout: 60_000,
      });
      cleanupAgentDirs(masterPath);
    } catch (err) {
      console.error('Failed to update skills:', String(err));
    }
  }
}
