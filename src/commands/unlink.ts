import * as p from '@clack/prompts';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { readConfig } from '../core/config.js';
import { readTracking, removeLink } from '../core/tracking.js';
import { removeSymlink, removeFromGitExclude } from '../core/symlink.js';
import { detectProject } from '../utils/project.js';
import { confirmContinue } from '../utils/prompts.js';

export async function unlinkCommand(skillArgs: string[]): Promise<void> {
  p.intro('Prov Unlink');

  const project = detectProject(process.cwd());
  if (!project.isProject) {
    p.log.warn(`No project indicators found (${project.reason}).`);
    const proceed = await confirmContinue('Continue anyway?', false);
    if (!proceed) {
      p.outro('Unlink cancelled.');
      return;
    }
  }

  const config = readConfig();
  if (!config?.masterPath) {
    p.log.error('No master folder configured.');
    p.outro('Unlink cancelled.');
    return;
  }

  const masterPath = config.masterPath;

  // Guard: master is also a git repo. Don't unlink from it.
  if (process.cwd() === masterPath) {
    p.log.warn('You are in the master folder.');
    p.log.info('To unlink from a project, cd to the project directory first.');
    p.outro('Unlink cancelled.');
    return;
  }

  const targetProject = process.cwd();
  const agentsSkillsDir = join(targetProject, '.agents', 'skills');

  // Find linked skills in this project
  const tracking = readTracking(masterPath);
  const projectSkills = Object.entries(tracking.skills).filter(([_, entry]) =>
    entry.linkedTo.includes(targetProject),
  );

  if (projectSkills.length === 0) {
    p.log.warn('No skills linked to this project.');
    p.outro('Done.');
    return;
  }

  let skillsToUnlink: string[];

  if (skillArgs.length > 0) {
    skillsToUnlink = projectSkills
      .filter(([name]) => skillArgs.includes(name))
      .map(([name]) => name);
    if (skillsToUnlink.length === 0) {
      p.log.warn('None of the specified skills are linked here.');
      p.outro('Unlink cancelled.');
      return;
    }
  } else {
    const options = projectSkills.map(([name, entry]) => ({
      value: name,
      label: `${name} [${entry.type}]`,
    }));

    const picked = await p.multiselect({
      message: 'Select skills to unlink from this project:',
      options,
      required: false,
    });
    if (p.isCancel(picked)) return;
    skillsToUnlink = picked as string[];
  }

  if (skillsToUnlink.length === 0) {
    p.log.warn('No skills selected.');
    p.outro('Done.');
    return;
  }

  const results: { name: string; ok: boolean; msg: string }[] = [];

  for (const name of skillsToUnlink) {
    const s = p.spinner();
    s.start(`Unlinking ${name}...`);

    try {
      const targetPath = join(agentsSkillsDir, name);
      const removed = removeSymlink(targetPath);

      // Also clean git exclude
      removeFromGitExclude(targetProject, `.agents/skills/${name}`);

      // Update tracking
      removeLink(masterPath, name, targetProject);

      s.stop('Done');
      results.push({
        name,
        ok: true,
        msg: removed ? 'Symlink removed' : 'No symlink found, tracking cleaned',
      });
    } catch (err) {
      s.stop('Error');
      results.push({ name, ok: false, msg: String(err) });
    }
  }

  for (const r of results) {
    if (r.ok) p.log.success(`  ✓ ${r.name}: ${r.msg}`);
    else p.log.error(`  ✗ ${r.name}: ${r.msg}`);
  }

  p.outro('Unlink complete.');
}
