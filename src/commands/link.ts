import * as p from '@clack/prompts';
import { join, relative } from 'node:path';
import { existsSync } from 'node:fs';
import { readConfig } from '../core/config.js';
import { getAllSkills } from '../core/master.js';
import { addLink } from '../core/tracking.js';
import { createSymlink, addToGitExclude } from '../core/symlink.js';
import { detectProject } from '../utils/project.js';
import { confirmContinue } from '../utils/prompts.js';
import type { SkillOption } from '../types.js';

export async function linkCommand(skillArgs: string[]): Promise<void> {
  p.intro('Prov Link');

  // 1. Detect project
  const project = detectProject(process.cwd());
  if (!project.isProject) {
    const proceed = await confirmContinue(
      `No project indicators found (${project.reason}). Continue anyway?`,
      false,
    );
    if (!proceed) {
      p.outro('Link cancelled.');
      return;
    }
  }

  // 2. Check master config
  const config = readConfig();
  if (!config?.masterPath) {
    p.log.error('No master folder configured.');
    p.outro('Link cancelled.');
    return;
  }

  const masterPath = config.masterPath;
  if (!existsSync(masterPath)) {
    p.log.error(`Master folder not found: ${masterPath}`);
    p.outro('Link cancelled.');
    return;
  }

  // Guard: master is also a git repo. Don't link into it.
  if (process.cwd() === masterPath) {
    p.log.warn('You are in the master folder.');
    p.log.info('To link to a project, cd to the project directory first.');
    p.outro('Link cancelled.');
    return;
  }

  // 3. Load only skills with actual files available
  const allSkills = getAllSkills(masterPath);
  const availableSkills = allSkills.filter((s) => {
    if (s.type === 'own') return true; // own skills are always available
    return s.synced; // skills.sh only if files exist
  });

  let selectedSkills: SkillOption[];

  if (skillArgs.length > 0) {
    selectedSkills = availableSkills.filter((s) => skillArgs.includes(s.name));
    if (selectedSkills.length === 0) {
      p.log.warn(
        'No matching skills found. skills.sh skills must be installed first via `prov install`.',
      );
      p.outro('Link cancelled.');
      return;
    }
  } else {
    if (availableSkills.length === 0) {
      p.log.warn('No available skills to link. Run `prov install` first.');
      p.outro('Link cancelled.');
      return;
    }

    const options = availableSkills.map((s) => ({
      value: s.name,
      label: `${s.name} [${s.type}]`,
    }));

    const picked = await p.multiselect({
      message: 'Select skills to link to current project:',
      options,
      required: false,
    });
    if (p.isCancel(picked)) return;

    selectedSkills = availableSkills.filter((s) =>
      (picked as string[]).includes(s.name),
    );
  }

  if (selectedSkills.length === 0) {
    p.log.warn('No skills selected.');
    p.outro('Done.');
    return;
  }

  // 4. Link each skill
  const targetProject = process.cwd();
  const results: { name: string; ok: boolean; msg: string }[] = [];

  for (const skill of selectedSkills) {
    const s = p.spinner();
    s.start(`Linking ${skill.name}...`);

    try {
      const sourcePath =
        skill.type === 'own'
          ? join(masterPath, 'skills', skill.name)
          : join(masterPath, '.agents', 'skills', skill.name);

      const targetPath = join(targetProject, '.agents', 'skills', skill.name);
      createSymlink(targetPath, sourcePath);

      // Git exclude
      const exclude = await confirmContinue(
        `Exclude ${skill.name} symlink from git?`,
        true,
      );
      if (exclude) {
        addToGitExclude(targetProject, `.agents/skills/${skill.name}`);
      }

      addLink(masterPath, skill.name, targetProject, skill.type);

      s.stop('Done');
      results.push({ name: skill.name, ok: true, msg: 'Linked' });
    } catch (err) {
      s.stop('Error');
      results.push({ name: skill.name, ok: false, msg: String(err) });
    }
  }

  // Report
  for (const r of results) {
    if (r.ok) p.log.success(`  ✓ ${r.name}: ${r.msg}`);
    else p.log.error(`  ✗ ${r.name}: ${r.msg}`);
  }

  p.outro('Link complete.');
}
