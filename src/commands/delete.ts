import * as p from '@clack/prompts';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { readConfig } from '../core/config.js';
import { removeAllLinks } from '../core/tracking.js';
import { removeSkillFromLockfile } from '../core/lockfile.js';
import { removeSymlink, removeFromGitExclude } from '../core/symlink.js';
import { getAllSkills } from '../core/master.js';

export async function deleteCommand(skillArgs: string[]): Promise<void> {
  p.intro('Prov Delete (master)');

  const config = readConfig();
  if (!config?.masterPath) {
    p.log.error('No master folder configured.');
    p.outro('Delete cancelled.');
    return;
  }

  const masterPath = config.masterPath;

  let skillsToDelete: string[];

  if (skillArgs.length > 0) {
    skillsToDelete = skillArgs;
  } else {
    const allSkills = getAllSkills(masterPath);
    if (allSkills.length === 0) {
      p.log.warn('No skills in master.');
      p.outro('Done.');
      return;
    }

    const options = allSkills.map((s) => ({
      value: s.name,
      label: `${s.name} [${s.type}]`,
    }));

    const picked = await p.multiselect({
      message: 'Select skills to DELETE from master:',
      options,
      required: true,
    });
    if (p.isCancel(picked)) return;
    skillsToDelete = picked as string[];
  }

  if (skillsToDelete.length === 0) {
    p.outro('Done.');
    return;
  }

  // Confirm destructive action
  const confirm = await p.confirm({
    message: `This will delete ${skillsToDelete.length} skill(s) from master AND all linked projects. Continue?`,
    active: 'Yes, delete',
    inactive: 'No, cancel',
    initialValue: false,
  });
  if (p.isCancel(confirm)) return;
  if (!confirm) {
    p.outro('Delete cancelled.');
    return;
  }

  const results: { name: string; ok: boolean; msg: string }[] = [];

  for (const name of skillsToDelete) {
    const s = p.spinner();
    s.start(`Deleting ${name}...`);

    try {
      // 1. Remove all linked symlinks and git exclude entries
      const linkedTargets = removeAllLinks(masterPath, name);
      for (const target of linkedTargets) {
        const symlinkPath = join(target, '.agents', 'skills', name);
        removeSymlink(symlinkPath);
        removeFromGitExclude(target, `.agents/skills/${name}`);
      }

      // 2. Remove from skills-lock.json (for skills.sh skills)
      removeSkillFromLockfile(masterPath, name);

      // 3. Delete skill files
      const ownPath = join(masterPath, 'skills', name);
      const skillsShPath = join(masterPath, '.agents', 'skills', name);

      if (existsSync(ownPath)) {
        rmSync(ownPath, { recursive: true, force: true });
      }
      if (existsSync(skillsShPath)) {
        rmSync(skillsShPath, { recursive: true, force: true });
      }

      s.stop('Deleted');
      results.push({
        name,
        ok: true,
        msg: `Removed${linkedTargets.length > 0 ? ` + ${linkedTargets.length} symlink(s)` : ''}`,
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

  p.outro('Delete complete.');
}
