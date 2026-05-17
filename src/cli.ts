#!/usr/bin/env node

import * as p from '@clack/prompts';
import { Command } from 'commander';
import { readConfig, writeConfig } from './core/config.js';
import { initMaster } from './commands/init.js';
import { installCommand } from './commands/install.js';
import { unlinkCommand } from './commands/unlink.js';
import { deleteCommand } from './commands/delete.js';
import { updateCommand } from './commands/update.js';
import { listCommand } from './commands/list.js';
import { masterCommand } from './commands/master-command.js';
import { isMaster } from './core/master.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { confirmContinue } from './utils/prompts.js';

// --- Interactive main menu ---
async function showMainMenu(): Promise<void> {
  p.intro('Prov — Agent Skills Manager');

  const config = readConfig();
  const masterOk = config?.masterPath && existsSync(config.masterPath);

  if (!masterOk) {
    p.log.warn('No master folder configured.');
    const setup = await p.select({
      message: 'First-time setup:',
      options: [
        { value: 'init', label: 'Init new master (current dir becomes master)' },
        { value: 'set', label: 'Point to existing master folder' },
        { value: 'exit', label: 'Exit' },
      ],
    });
    if (p.isCancel(setup)) return;

    if (setup === 'init') {
      await initMaster(process.cwd());
    } else if (setup === 'set') {
      const pathResult = await p.text({
        message: 'Path to master folder:',
        placeholder: '/home/user/my-skills',
      });
      if (p.isCancel(pathResult)) return;
      if (pathResult) {
        const resolved = pathResult.startsWith('/')
          ? pathResult
          : join(process.cwd(), pathResult);
        if (!isMaster(resolved)) {
          p.log.warn('Path does not look like a master (no skills-lock.json or skills/). Setting anyway.');
        }
        writeConfig({ masterPath: resolved });
        p.log.success(`Master set to: ${resolved}`);
      }
    } else {
      return;
    }
  }

  // Main action selection
  const action = await p.select({
    message: 'What would you like to do?',
    options: [
      { value: 'install', label: 'Install skill' },
      { value: 'unlink', label: 'Unlink skill from current project' },
      { value: 'update', label: 'Update skills.sh skills' },
      { value: 'delete', label: 'Delete skill from master' },
      { value: 'list', label: 'List all skills' },
      { value: 'master', label: 'Show/change master config' },
      { value: 'exit', label: 'Exit' },
    ],
  });
  if (p.isCancel(action)) return;

  switch (action) {
    case 'install':
      await installCommand([]);
      break;
    case 'unlink':
      await unlinkCommand([]);
      break;
    case 'update':
      await updateCommand([]);
      break;
    case 'delete':
      await deleteCommand([]);
      break;
    case 'list':
      await listCommand();
      break;
    case 'master':
      await masterCommand();
      break;
    case 'exit':
      p.outro('Bye!');
      break;
  }
}

// --- CLI Setup ---
const program = new Command()
  .name('provv')
  .description('Agent skills provision manager — install, link, and manage AI agent skills')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize current folder as master')
  .action(() => initMaster(process.cwd()));

program
  .command('install [skills...]')
  .description('Install skill(s) to master and link to current project')
  .usage('[skill...] | npx skills add <url> --skill <name>')
  .allowUnknownOption()
  .action(async (skills: string[]) => {
    // Recover full args from process.argv when npx command is passed
    // (allowUnknownOption consumes --flags, so we reconstruct from argv)
    let fullArgs = skills ?? [];
    if (fullArgs[0] === 'npx') {
      const idx = process.argv.indexOf('install');
      if (idx !== -1) {
        fullArgs = process.argv.slice(idx + 1);
      }
    }
    await installCommand(fullArgs);
  });

program
  .command('unlink [skills...]')
  .description('Remove skill symlink(s) from current project')
  .action(async (skills: string[]) => {
    await unlinkCommand(skills ?? []);
  });

program
  .command('delete [skills...]')
  .description('Delete skill from master (removes all linked symlinks)')
  .action(async (skills: string[]) => {
    await deleteCommand(skills ?? []);
  });

program
  .command('update [skills...]')
  .description('Update skills.sh skills in master')
  .action(async (skills: string[]) => {
    await updateCommand(skills ?? []);
  });

program
  .command('list')
  .description('List all skills and links')
  .action(() => listCommand());

program
  .command('master')
  .description('Show or set master path')
  .argument('[action]', 'path or set', 'path')
  .argument('[path]', 'Path when using set')
  .action(async (action?: string, pathArg?: string) => {
    await masterCommand(action, pathArg);
  });

// --- Entry ---
// If no args, show interactive menu. Otherwise parse commands.
if (process.argv.length <= 2) {
  showMainMenu().catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
} else {
  program.parse();
}
