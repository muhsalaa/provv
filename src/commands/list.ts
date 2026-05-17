import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync } from 'node:fs';
import { readConfig } from '../core/config.js';
import { getAllSkills } from '../core/master.js';
import { readTracking } from '../core/tracking.js';

export async function listCommand(): Promise<void> {
  p.intro('Prov List');

  const config = readConfig();
  if (!config?.masterPath) {
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

  const own = skills.filter((s) => s.type === 'own');
  const skillsSh = skills.filter((s) => s.type === 'skills.sh');

  function printGroup(label: string, group: typeof own): void {
    if (group.length === 0) return;

    p.log.info(`── ${label} ──`);

    for (const s of group) {
      const entry = tracking.skills[s.name];
      const targets = entry?.linkedTo ?? [];

      const prefix = s.type === 'skills.sh'
        ? `${s.name} ${s.synced ? pc.dim('[✓]') : pc.dim('[⇣]')}`
        : s.name;

      const status =
        targets.length > 0
          ? pc.green('→ linked')
          : pc.dim('→ not linked');

      console.log(`  ${prefix} ${status}`);
    }
  }

  printGroup('Your Skills', own);
  printGroup('skills.sh', skillsSh);

  p.log.info(`Total: ${skills.length} skill(s) in master`);
  p.outro('Done.');
}
