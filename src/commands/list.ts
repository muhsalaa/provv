import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { readConfigWithDefaults } from '../core/config.js';
import { getAllSkills } from '../core/master.js';
import { readTracking } from '../core/tracking.js';
import { detectProject } from '../utils/project.js';
import type { SkillOption } from '../types.js';

function checkSymlinkHealth(targetDir: string, skillName: string): 'ok' | 'missing' | 'broken' {
  const symlinkPath = join(targetDir, '.agents', 'skills', skillName);
  try {
    if (!existsSync(symlinkPath)) return 'missing';
    const stat = lstatSync(symlinkPath);
    if (!stat.isSymbolicLink()) return 'broken';
    // Symlink exists but target might be gone
    const target = symlinkPath; // lstatSync gives us the link, existsSync follows it
    if (!existsSync(symlinkPath)) return 'broken';
    return 'ok';
  } catch {
    return 'broken';
  }
}

export async function listCommand(): Promise<void> {
  p.intro('Provv List');

  const config = readConfigWithDefaults();
  if (!config.masterPath) {
    p.log.error('No master folder configured.');
    p.outro('Done.');
    return;
  }

  const masterPath = config.masterPath;
  if (!existsSync(masterPath)) {
    p.log.error(`Master folder not found: ${masterPath}`);
    p.outro('Done.');
    return;
  }

  const skills = getAllSkills(masterPath);
  const tracking = readTracking(masterPath);

  if (skills.length === 0) {
    p.log.info('No skills found in master.');
    p.outro('Done.');
    return;
  }

  p.log.info(`Master: ${masterPath}`);

  const project = detectProject(process.cwd());
  const cwd = process.cwd();

  if (project.isProject) {
    const own = skills.filter((s) => s.type === 'own');
    const skillsSh = skills.filter((s) => s.type === 'skills.sh');

    function printProjectGroup(label: string, group: typeof own): void {
      if (group.length === 0) return;

      const linkedHere = group.filter((s) => {
        const entry = tracking.skills[s.name];
        return entry?.linkedTo.includes(cwd);
      });
      const others = group.filter(
        (s) => !tracking.skills[s.name]?.linkedTo.includes(cwd),
      );

      if (linkedHere.length > 0) {
        p.log.info(`── ${label} (linked to this project) ──`);
        for (const s of linkedHere) {
          const prefix =
            s.type === 'skills.sh'
              ? `${s.name} ${s.synced ? pc.dim('[✓]') : pc.dim('[⇣]')}`
              : s.name;
          const health = checkSymlinkHealth(cwd, s.name);
          const status =
            health === 'ok'
              ? pc.green('→ linked here')
              : pc.yellow(`→ ⚠ symlink ${health} (reinstall: provv install ${s.name})`);
          console.log(`  ${prefix} ${status}`);
        }
      }

      if (others.length > 0) {
        p.log.info(`── ${label} (not linked here) ──`);
        for (const s of others) {
          const prefix =
            s.type === 'skills.sh'
              ? `${s.name} ${s.synced ? pc.dim('[✓]') : pc.dim('[⇣]')}`
              : s.name;
          const linkedElsewhere = tracking.skills[s.name]?.linkedTo ?? [];
          const elsewhereHealthy = linkedElsewhere.filter((t) =>
            checkSymlinkHealth(t, s.name) === 'ok',
          );
          const elsewhereBroken = linkedElsewhere.filter((t) =>
            checkSymlinkHealth(t, s.name) !== 'ok',
          );

          let status: string;
          if (linkedElsewhere.length === 0) {
            status = pc.dim('→ not linked');
          } else if (elsewhereBroken.length > 0) {
            status = pc.yellow(
              `→ ⚠ ${elsewhereHealthy.length} ok, ${elsewhereBroken.length} broken`,
            );
          } else {
            status = pc.dim(`→ linked to ${linkedElsewhere.length} project(s)`);
          }
          console.log(`  ${prefix} ${status}`);
        }
      }
    }

    printProjectGroup('Your Skills', own);
    printProjectGroup('skills.sh', skillsSh);
  } else {
    const own = skills.filter((s) => s.type === 'own');
    const skillsSh = skills.filter((s) => s.type === 'skills.sh');

    if (own.length > 0) {
      p.log.info('── Your Skills ──');
      for (const s of own) {
        console.log(`  ${s.name} ${pc.dim('→ available')}`);
      }
    }

    if (skillsSh.length > 0) {
      p.log.info('── skills.sh ──');
      for (const s of skillsSh) {
        const status = s.synced ? pc.dim('[✓]') : pc.dim('[⇣]');
        console.log(`  ${s.name} ${status} ${pc.dim('→ available')}`);
      }
    }
  }

  p.log.info(`Total: ${skills.length} skill(s) in master`);
  p.outro('Done.');
}
