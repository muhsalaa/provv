import * as p from '@clack/prompts';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { readConfigWithDefaults, writeConfig } from '../core/config.js';
import { getAllSkills } from '../core/master.js';
import { addLink, removeLink } from '../core/tracking.js';
import { readLockfile } from '../core/lockfile.js';
import { createSymlink, removeSymlink, addToGitExclude, removeFromGitExclude } from '../core/symlink.js';
import { installFromSkillsSh } from '../core/skill-installer.js';
import { detectProject } from '../utils/project.js';
import { handleCancel, confirmContinue } from '../utils/prompts.js';
import type { SkillOption } from '../types.js';
import { initMaster } from './init.js';

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
    p.log.warn('No master folder configured.');
    const setup = await p.select({
      message: 'First time using provv? Set up your master:',
      options: [
        { value: 'init', label: 'Create master in current directory' },
        { value: 'set', label: 'Point to existing master folder' },
        { value: 'exit', label: 'Cancel' },
      ],
    });
    if (p.isCancel(setup) || setup === 'exit') {
      p.outro('Install cancelled.');
      return;
    }
    if (setup === 'init') {
      await initMaster(process.cwd());
    } else {
      const pathResult = await p.text({
        message: 'Path to existing master folder:',
        placeholder: '/home/user/my-skills',
      });
      if (p.isCancel(pathResult)) {
        p.outro('Install cancelled.');
        return;
      }
      const resolved = (pathResult as string).startsWith('/')
        ? (pathResult as string)
        : join(process.cwd(), pathResult as string);
      writeConfig({ masterPath: resolved });
      p.log.success(`Master set to: ${resolved}`);
    }
  }

  // Re-read config after potential setup
  const updatedConfig = readConfigWithDefaults();
  const masterPath = updatedConfig.masterPath;
  if (!masterPath || !existsSync(masterPath)) {
    p.log.error('Master folder not found or not configured.');
    p.outro('Install cancelled.');
    return;
  }

  // Guard: warn if in master, but allow with confirmation
  if (process.cwd() === masterPath) {
    const proceed = await confirmContinue(
      'You are in the master folder. Skills will be downloaded to master/.agents/skills/ but NOT symlinked locally. Proceed?',
      false,
    );
    if (!proceed) {
      p.outro('Install cancelled.');
      return;
    }
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
      // Match: npx skills add <repo>, npx skills@latest add <repo>, npx skills@<version> add <repo>
      const cmdMatch = fullCmd.match(
        /npx\s+skills(?:@[\w.]+)?\s+add\s+(https?:\/\/[\w./-]+|[\w-]+\/[\w.-]+)(?:\s+--skill\s+([\w,-]+))?/,
      );

      let repoUrl: string;
      let skillNames: string[] = [];

      if (cmdMatch) {
        repoUrl = cmdMatch[1].trim();
        if (cmdMatch[2]) {
          skillNames = cmdMatch[2].split(/[\s,]+/).filter(Boolean);
        }
      } else {
        // Treat as raw URL or repo — find the actual repo string in args
        const urlCandidate = skillArgs.find(
          (a) => a.startsWith('http') || /^[\w.-]+\/[\w.-]+$/.test(a),
        );
        if (urlCandidate) {
          repoUrl = urlCandidate;
          const skillIdx = skillArgs.indexOf('--skill');
          if (skillIdx !== -1 && skillArgs[skillIdx + 1]) {
            skillNames = [skillArgs[skillIdx + 1]];
          }
        } else {
          p.log.error(`Could not parse repo URL from: ${fullCmd}`);
          p.outro('Install cancelled.');
          return;
        }
      }

      if (skillNames.length === 0) {
        // No --skill specified → show available skills and let user pick
        p.log.info(`Available skills in ${repoUrl}:`);
        try {
          const { execSync } = await import('node:child_process');
          execSync(`npx skills add "${repoUrl}" --list -y 2>&1`, {
            cwd: masterPath,
            stdio: 'inherit',
          });
        } catch {
          // --list exits with non-zero, that's fine
        }
        const picked = await p.text({
          message: 'Skill name(s) to install (comma-separated):',
          placeholder: 'e.g., caveman, grill-me',
        });
        if (p.isCancel(picked)) return;
        if (picked && typeof picked === 'string') {
          skillNames = picked.split(/[\s,]+/).filter(Boolean);
        }
        if (skillNames.length === 0) {
          p.log.warn('No skills selected.');
          p.outro('Done.');
          return;
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
  // Track committed skills so we can roll them back on any failure
  const committed: { name: string; undo: () => void }[] = [];

  for (const skill of selectedSkills) {
    const s = p.spinner();
    s.start(`Processing ${skill.name}...`);

    // Per-skill rollback stack — completed operations to undo if this skill fails
    const perSkillRollback: (() => void)[] = [];

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
            const ok = installFromSkillsSh(masterPath, entry.source, [skill.name]);
            if (!ok) {
              results.push({ name: skill.name, ok: false, msg: 'Download failed' });
              s.stop('Failed');
              // Rollback already-committed skills
              for (const c of committed.slice().reverse()) {
                try { c.undo(); } catch { /* best-effort */ }
              }
              break;
            }
          } else {
            results.push({ name: skill.name, ok: false, msg: 'Source not found in lockfile' });
            s.stop('Failed');
            // Rollback already-committed skills
            for (const c of committed.slice().reverse()) {
              try { c.undo(); } catch { /* best-effort */ }
            }
            break;
          }
        }
        sourcePath = skillsShDir;
      }

      // When in master: download only, no self-symlink
      const inMaster = targetProject === masterPath;

      if (!inMaster) {
        // Symlink
        const targetPath = join(targetProject, '.agents', 'skills', skill.name);
        createSymlink(targetPath, sourcePath);
        perSkillRollback.push(() => { try { removeSymlink(targetPath); } catch { /* best-effort */ } });

        // Git exclude — depends on config
        const gitExclude = config.gitExclude ?? 'auto-ignore';
        if (gitExclude === 'auto-ignore') {
          addToGitExclude(targetProject, `.agents/skills/${skill.name}`);
          perSkillRollback.push(() => { try { removeFromGitExclude(targetProject, `.agents/skills/${skill.name}`); } catch { /* best-effort */ } });
        } else if (gitExclude === 'ask') {
          const exclude = await confirmContinue(
            `Ignore ${skill.name} symlink in git? (won't be committed)`,
            true,
          );
          if (exclude) {
            addToGitExclude(targetProject, `.agents/skills/${skill.name}`);
            perSkillRollback.push(() => { try { removeFromGitExclude(targetProject, `.agents/skills/${skill.name}`); } catch { /* best-effort */ } });
          }
        }

        // Track
        addLink(masterPath, skill.name, targetProject, skill.type);
        perSkillRollback.push(() => removeLink(masterPath, skill.name, targetProject));

        // Commit — if any later skill fails, rollback all committed skills
        committed.push({
          name: skill.name,
          undo: () => { for (const fn of perSkillRollback.slice().reverse()) { try { fn(); } catch { /* best-effort */ } } },
        });

        s.stop('Done');
        results.push({ name: skill.name, ok: true, msg: 'Installed and linked' });
      } else {
        s.stop('Done');
        results.push({ name: skill.name, ok: true, msg: 'Downloaded to master' });
      }
    } catch (err) {
      // Rollback current skill's partial progress
      for (const fn of perSkillRollback.slice().reverse()) {
        try { fn(); } catch { /* best-effort */ }
      }
      // Rollback all previously committed skills
      for (const c of committed.slice().reverse()) {
        try { c.undo(); } catch { /* best-effort */ }
      }
      s.stop('Error');
      results.push({ name: skill.name, ok: false, msg: String(err) });
      break; // Stop — state is clean, user can retry
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
