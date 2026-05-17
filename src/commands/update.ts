import * as p from '@clack/prompts';
import { existsSync } from 'node:fs';
import { readConfig } from '../core/config.js';
import { discoverSkillsShSkills } from '../core/master.js';
import { updateSkillsShSkills } from '../core/skill-installer.js';
import { handleCancel } from '../utils/prompts.js';

export async function updateCommand(skillArgs: string[]): Promise<void> {
  p.intro('Prov Update');

  const config = readConfig();
  if (!config?.masterPath) {
    p.log.error('No master folder configured.');
    p.outro('Update cancelled.');
    return;
  }

  const masterPath = config.masterPath;
  if (!existsSync(masterPath)) {
    p.log.error(`Master folder not found: ${masterPath}`);
    p.outro('Update cancelled.');
    return;
  }

  const skillsSh = discoverSkillsShSkills(masterPath);

  if (skillsSh.length === 0) {
    p.log.warn('No skills.sh skills found in master to update.');
    p.outro('Done.');
    return;
  }

  let nameFilter: string[] | undefined;

  if (skillArgs.length > 0) {
    nameFilter = skillArgs.filter((a) => skillsSh.some((s) => s.name === a));
    const missing = skillArgs.filter((a) => !skillsSh.some((s) => s.name === a));
    if (missing.length > 0) {
      p.log.warn(`Not found in master: ${missing.join(', ')}`);
    }
  } else {
    const options = skillsSh.map((s) => ({
      value: s.name,
      label: s.name,
    }));

    const picked = await p.multiselect({
      message: 'Select skills.sh skills to update:',
      options,
      required: false,
    });
    if (p.isCancel(picked)) return;

    const pickedArr = picked as string[];
    if (pickedArr.includes('__ALL__')) {
      nameFilter = undefined;
    } else {
      nameFilter = pickedArr;
    }
  }

  if (nameFilter !== undefined && nameFilter.length === 0) {
    p.log.warn('No skills selected.');
    p.outro('Done.');
    return;
  }

  const s = p.spinner();
  s.start('Updating skills...');

  try {
    updateSkillsShSkills(masterPath, nameFilter);
    s.stop('Update complete');
    p.log.success(
      nameFilter
        ? `Updated ${nameFilter.length} skill(s)`
        : 'All skills.sh skills updated',
    );
  } catch (err) {
    s.stop('Update failed');
    p.log.error(String(err));
  }

  p.outro('Update complete.');
}
