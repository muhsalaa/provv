import * as p from '@clack/prompts';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { readConfigWithDefaults } from '../core/config.js';
import { getAllSkills } from '../core/master.js';
import { addLink } from '../core/tracking.js';
import { readLockfile } from '../core/lockfile.js';
import { createSymlink, addToGitExclude } from '../core/symlink.js';
import { installFromSkillsSh } from '../core/skill-installer.js';
import { detectProject } from '../utils/project.js';
import { handleCancel, confirmContinue } from '../utils/prompts.js';
import type { SkillOption } from '../types.js';

async function promptInstallFromSkillsSh(masterPath: string): Promise<string[]> {
  p.log.step('Install from skills.sh');

  const input = await p.text({
    message: 'Paste npx skills add command, or enter GitHub repo:',
    placeholder: 'npx skills add microsoft/azure-skills --skill azure-ai',
  });
  if (p.isCancel(input)) return [];

  let repoUrl: string;
  let skillNames: string[] = [];

  // Try to parse as full npx skills add command
  const cmdMatch = input.match(/npx\s+skills\s+add\s+(https?:\/\/[\w./-]+|[\w-]+\/[\w-]+)(?:\s+--skill\s+([\w-]+(?:\s*,\s*[\w-]+)*))?/);
  if (cmdMatch) {
    repoUrl = cmdMatch[1].trim();
    if (cmdMatch[2]) {
      skillNames = cmdMatch[2].split(/[\s,]+/).filter(Boolean);
    }
  } else {
    repoUrl = input.trim();
    // Ask for skill name
    const skill = await p.text({
      message: 'Skill name(s)? (comma-separated, or blank for all)',
    });
    if (!p.isCancel(skill) && skill) {
      skillNames = skill.split(/[\s,]+/).filter(Boolean);
    }
  }

  // Also ask for skill name if not provided and not parsed
  if (skillNames.length === 0) {
    const skill = await p.text({
      message: 'Skill name(s)? (comma-separated, or blank for all)',
    });
    if (!p.isCancel(skill) && skill) {
      skillNames = skill.split(/[\s,]+/).filter(Boolean);
    }
  }

  p.log.info(`Installing from ${repoUrl}...`);

  const ok = installFromSkillsSh(masterPath, repoUrl, skillNames);
  if (!ok) {
    p.log.error('Installation had errors. Check output above.');
    return [];
  }

  // Return the installed skill names
  if (skillNames.length > 0) return skillNames;

  // If all installed, we need to detect which skills were added to the lockfile
  // For now, ask user to confirm
  const confirmNames = await p.text({
    message: 'Skill(s) installed successfully. Confirm name(s) to link:',
    placeholder: 'e.g., azure-ai, azure-prepare',
  });
  if (p.isCancel(confirmNames)) return [];

  return confirmNames.split(/[\s,]+/).filter(Boolean);
}

export async function installCommand(skillArgs: string[]): Promise<void> {
  p.intro('Prov Install');

  // 1. Detect project
  const project = detectProject(process.cwd());
  if (!project.isProject) {
    const proceed = await confirmContinue(
      `No project indicators found (${project.reason}). Continue anyway?`,
      false,
    );
    if (!proceed) {
      p.outro('Install cancelled.');
      return;
    }
  }

  // 2. Check master config
  const config = readConfigWithDefaults();
  if (!config.masterPath) {
    p.log.error('No master folder configured.');
    p.log.info('Run `prov init` in your skills repo, or `prov master set <path>`.');
    p.outro('Install cancelled.');
    return;
  }

  const masterPath = config.masterPath;
  if (!existsSync(masterPath)) {
    p.log.error(`Master folder not found: ${masterPath}`);
    p.outro('Install cancelled.');
    return;
  }

  // Guard: master is also a git repo. Don't install into it.
  if (process.cwd() === masterPath) {
    p.log.warn('You are in the master folder.');
    p.log.info('To install to a project, cd to the project directory first.');
    p.log.step('Example: cd ~/code/my-project && prov install');
    p.outro('Install cancelled.');
    return;
  }

  // 3. Load skills
  const allSkills = getAllSkills(masterPath);

  // If skill names provided as args, filter
  let selectedSkills: SkillOption[];
  if (skillArgs.length > 0) {
    // Check for npx skills add command or URL/repo as first arg
    const isCommand =
      skillArgs[0] === 'npx' ||
      skillArgs[0].startsWith('http') ||
      /^[\w.-]+\/[\w.-]+$/.test(skillArgs[0]);

    if (isCommand) {
      // Parse the npx skills add command
      const fullCmd = skillArgs.join(' ');
      const cmdMatch = fullCmd.match(
        /npx\s+skills\s+add\s+(https?:\/\/[\w./-]+|[\w-]+\/[\w.-]+)(?:\s+--skill\s+([\w,-]+))?/,
      );

      let repoUrl: string;
      let skillNames: string[] = [];

      if (cmdMatch) {
        repoUrl = cmdMatch[1].trim();
        if (cmdMatch[2]) {
          skillNames = cmdMatch[2].split(/[\s,]+/).filter(Boolean);
        }
      } else {
        // Treat as raw URL or repo
        repoUrl = skillArgs[0];
        if (skillArgs.length > 1 && skillArgs[1] !== '--skill') {
          skillNames = skillArgs.slice(1).filter((a) => a !== '--skill');
        }
      }

      p.log.info(`Installing from ${repoUrl}...`);
      installFromSkillsSh(masterPath, repoUrl, skillNames);

      // Re-load and filter to installed skills
      const updatedSkills = getAllSkills(masterPath);
      selectedSkills = skillNames.length > 0
        ? updatedSkills.filter((s) => skillNames.includes(s.name))
        : updatedSkills.filter((s) => s.type === 'skills.sh');
    } else {
      // Match against known skills
      selectedSkills = allSkills.filter((s) => skillArgs.includes(s.name));
      if (selectedSkills.length < skillArgs.length) {
        const missing = skillArgs.filter(
          (a) => !selectedSkills.some((s) => s.name === a),
        );
        p.log.warn(`Skills not found in master: ${missing.join(', ')}`);
      }
      if (selectedSkills.length === 0) {
        p.log.error('No matching skills found.');
        p.outro('Install cancelled.');
        return;
      }
    }
  } else {
    // Build options for multiselect
    const ownOptions = allSkills
      .filter((s) => s.type === 'own')
      .map((s) => ({
        value: s.name,
        label: `${s.name} [own]`,
      }));

    const skillsShOptions = allSkills
      .filter((s) => s.type === 'skills.sh')
      .map((s) => ({
        value: s.name,
        label: `${s.name} [skills.sh ${s.synced ? '✓' : '⇣ not synced'}]`,
      }));

    const options = [
      ...ownOptions,
      ...skillsShOptions,
      { value: '__INSTALL_NEW__', label: '➜ Install new from skills.sh...' },
    ];

    if (options.length <= 1) {
      p.log.warn('No skills found in master. Add some first.');
      const addNew = await p.confirm({
        message: 'Install from skills.sh?',
        active: 'Yes',
        inactive: 'No',
        initialValue: true,
      });
      if (p.isCancel(addNew)) return;
      if (!addNew) {
        p.outro('Done.');
        return;
      }
      const installedNames = await promptInstallFromSkillsSh(masterPath);
      if (installedNames.length === 0) {
        p.outro('Nothing installed.');
        return;
      }
      // Re-read skills after install
      const updatedSkills = getAllSkills(masterPath);
      selectedSkills = updatedSkills.filter((s) =>
        installedNames.includes(s.name),
      );
    } else {
      const picked = await p.multiselect({
        message: 'Select skills to install and link:',
        options,
        required: false,
      });
      if (p.isCancel(picked)) return;

      if (picked.includes('__INSTALL_NEW__')) {
        const installedNames = await promptInstallFromSkillsSh(masterPath);
        // Add those to selection
        const updatedSkills = getAllSkills(masterPath);
        const newlyInstalled = updatedSkills.filter((s) =>
          installedNames.includes(s.name),
        );
        selectedSkills = allSkills
          .filter((s) => (picked as string[]).includes(s.name))
          .concat(newlyInstalled);
      } else {
        selectedSkills = allSkills.filter((s) =>
          (picked as string[]).includes(s.name),
        );
      }
    }
  }

  if (selectedSkills.length === 0) {
    p.log.warn('No skills selected.');
    p.outro('Done.');
    return;
  }

  // 4. Process each skill
  const targetProject = process.cwd();
  const results: { name: string; ok: boolean; msg: string }[] = [];

  for (const skill of selectedSkills) {
    const s = p.spinner();
    s.start(`Processing ${skill.name}...`);

    try {
      let sourcePath: string;

      if (skill.type === 'own') {
        sourcePath = join(masterPath, 'skills', skill.name);
      } else {
        // skills.sh
        const skillsShDir = join(masterPath, '.agents', 'skills', skill.name);
        if (!existsSync(skillsShDir)) {
          s.stop(`Downloading ${skill.name}...`);
          // Lazy sync
          const lockfile = readLockfile(masterPath);
          const entry = lockfile?.skills[skill.name];
          if (entry) {
            installFromSkillsSh(masterPath, entry.source, [skill.name]);
          } else {
            results.push({ name: skill.name, ok: false, msg: 'Source not found in lockfile' });
            s.stop('Failed');
            continue;
          }
        }
        sourcePath = skillsShDir;
      }

      // Symlink
      const targetPath = join(targetProject, '.agents', 'skills', skill.name);
      createSymlink(targetPath, sourcePath);

      // Git exclude — depends on config
      const gitExclude = config.gitExclude ?? 'auto-ignore';
      if (gitExclude === 'auto-ignore') {
        addToGitExclude(targetProject, `.agents/skills/${skill.name}`);
      } else if (gitExclude === 'ask') {
        const exclude = await confirmContinue(
          `Ignore ${skill.name} symlink in git? (won't be committed)`,
          true,
        );
        if (exclude) {
          addToGitExclude(targetProject, `.agents/skills/${skill.name}`);
        }
      }
      // gitExclude === 'never' → skip entirely

      // Track
      addLink(masterPath, skill.name, targetProject, skill.type);

      s.stop('Done');
      results.push({ name: skill.name, ok: true, msg: 'Installed and linked' });
    } catch (err) {
      s.stop('Error');
      results.push({ name: skill.name, ok: false, msg: String(err) });
    }
  }

  // 5. Report
  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  p.log.success(`${ok} skill(s) installed.${fail > 0 ? ` ${fail} failed.` : ''}`);

  for (const r of results) {
    if (r.ok) {
      p.log.success(`  ✓ ${r.name}: ${r.msg}`);
    } else {
      p.log.error(`  ✗ ${r.name}: ${r.msg}`);
    }
  }

  p.outro('Install complete.');
}
