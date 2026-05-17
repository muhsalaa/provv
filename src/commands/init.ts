import * as p from '@clack/prompts';
import { existsSync, mkdirSync, writeFileSync, renameSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeConfig } from '../core/config.js';
import { detectFlatSkills } from '../core/master.js';
import { handleCancel } from '../utils/prompts.js';
import { getTrackingPath } from '../core/tracking.js';

export async function initMaster(cwd: string): Promise<void> {
  p.intro('Prov Master Init');

  const alreadyMaster = existsSync(join(cwd, 'skills-lock.json'));
  if (alreadyMaster) {
    p.log.warn('This folder is already a master (skills-lock.json found).');
    const reconfirm = await p.confirm({
      message: 'Re-init anyway? (recreates config, preserves existing files)',
      active: 'Yes',
      inactive: 'No',
      initialValue: false,
    });
    if (p.isCancel(reconfirm)) {
      p.cancel('Cancelled');
      return;
    }
    if (!reconfirm) {
      p.outro('OK, nothing changed.');
      return;
    }
  }

  // Create skills/ directory
  const skillsDir = join(cwd, 'skills');
  if (!existsSync(skillsDir)) {
    mkdirSync(skillsDir, { recursive: true });
    p.log.success('Created skills/ directory');
  }

  // Create .gitignore
  const gitignorePath = join(cwd, '.gitignore');
  const requiredPatterns = ['node_modules', '.agents'];
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, requiredPatterns.join('\n') + '\n');
    p.log.success('Created .gitignore');
  } else {
    const content = readFileSync(gitignorePath, 'utf-8');
    const lines = content.split('\n').map((l) => l.trim());
    const missing = requiredPatterns.filter((p) => !lines.includes(p));
    if (missing.length > 0) {
      writeFileSync(gitignorePath, content + '\n' + missing.join('\n') + '\n');
      p.log.success(`Appended to .gitignore: ${missing.join(', ')}`);
    } else {
      p.log.info('.gitignore already has all required entries');
    }
  }

  // Create skills-lock.json if missing
  const lockfilePath = join(cwd, 'skills-lock.json');
  if (!existsSync(lockfilePath)) {
    writeFileSync(lockfilePath, JSON.stringify({ version: 1, skills: {} }, null, 2) + '\n');
    p.log.success('Created skills-lock.json');
  }

  // Detect flat skills and suggest migration
  const flatSkills = detectFlatSkills(cwd);
  if (flatSkills.length > 0) {
    p.log.info(
      `Found ${flatSkills.length} skill folder(s) at root: ${flatSkills.join(', ')}`,
    );
    const migrate = await p.confirm({
      message: 'Move them into skills/ directory?',
      active: 'Yes',
      inactive: 'No',
      initialValue: true,
    });
    if (p.isCancel(migrate)) {
      p.cancel('Cancelled');
      return;
    }

    if (migrate) {
      for (const skillName of flatSkills) {
        const oldPath = join(cwd, skillName);
        const newPath = join(cwd, 'skills', skillName);
        renameSync(oldPath, newPath);
      }
      p.log.success(`Moved ${flatSkills.length} skill(s) into skills/`);

      // Create provv-links.json for those skills
      const trackingPath = getTrackingPath(cwd);
      if (!existsSync(trackingPath)) {
        const trackingData: Record<string, unknown> = {
          version: 1,
          skills: {},
        };
        for (const name of flatSkills) {
          (trackingData.skills as Record<string, unknown>)[name] = {
            type: 'own',
            linkedTo: [],
          };
        }
        writeFileSync(trackingPath, JSON.stringify(trackingData, null, 2) + '\n');
        p.log.success('Created provv-links.json with migrated skills');
      }
    }
  }

  // Write config
  writeConfig({ masterPath: cwd });
  p.log.success('Config saved to ~/.config/provv/config.json');

  p.outro(`Master initialized at ${cwd}`);
}
