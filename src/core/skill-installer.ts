import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

function cleanupAgentDirs(masterPath: string): void {
  try {
    const entries = readdirSync(masterPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('.')) continue;
      if (entry.name === '.git' || entry.name === '.agents') continue;

      // Remove any hidden directory that has a skills/ subfolder
      // (agent-specific dirs created by skills.sh all follow this pattern)
      const skillsPath = join(masterPath, entry.name, 'skills');
      if (existsSync(skillsPath)) {
        rmSync(join(masterPath, entry.name), { recursive: true, force: true });
      }
    }
  } catch {
    // Silently skip — cleanup is best-effort
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
      const cmd = `npx skills add "${repoUrl}" --skill "${name}" --copy -y 2>&1`;
      execSync(cmd, { cwd: masterPath, stdio: 'inherit' });
      cleanupAgentDirs(masterPath);
    } catch (err) {
      console.error(`Failed to install ${name}:`, String(err));
      success = false;
    }
  }

  if (names.length === 0) {
    try {
      const cmd = `npx skills add "${repoUrl}" --all --copy -y 2>&1`;
      execSync(cmd, { cwd: masterPath, stdio: 'inherit' });
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
        execSync(`npx skills update "${name}" -y 2>&1`, {
          cwd: masterPath,
          stdio: 'inherit',
        });
        cleanupAgentDirs(masterPath);
      } catch (err) {
        console.error(`Failed to update ${name}:`, String(err));
      }
    }
  } else {
    try {
      execSync('npx skills update -y 2>&1', {
        cwd: masterPath,
        stdio: 'inherit',
      });
      cleanupAgentDirs(masterPath);
    } catch (err) {
      console.error('Failed to update skills:', String(err));
    }
  }
}
