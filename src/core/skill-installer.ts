import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

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

  for (const name of names) {
    try {
      execSync(`npx skills add "${repoUrl}" --skill "${name}" --copy -y`, {
        cwd: masterPath,
        stdio: 'pipe',
        timeout: 60_000,
      });
      cleanupAgentDirs(masterPath);
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
