import * as p from '@clack/prompts';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readConfig, writeConfig } from '../core/config.js';
import { isMaster } from '../core/master.js';

export async function masterCommand(action?: string, pathArg?: string): Promise<void> {
  const config = readConfig();

  if (!action || action === 'path') {
    if (config?.masterPath) {
      p.log.success(`Master path: ${config.masterPath}`);
      if (!existsSync(config.masterPath)) {
        p.log.warn('⚠ Master path does not exist on disk.');
      }
    } else {
      p.log.warn('No master configured.');
    }
    return;
  }

  if (action === 'set') {
    if (!pathArg) {
      p.log.error('Usage: prov master set <path>');
      return;
    }

    const resolved = pathArg.startsWith('/')
      ? pathArg
      : join(process.cwd(), pathArg);

    if (!existsSync(resolved)) {
      p.log.error(`Path does not exist: ${resolved}`);
      return;
    }

    if (!isMaster(resolved)) {
      const force = await p.confirm({
        message:
          'Path does not look like a master (no skills-lock.json or skills/). Set anyway?',
        active: 'Yes',
        inactive: 'No',
        initialValue: false,
      });
      if (p.isCancel(force)) return;
      if (!force) {
        p.outro('Master not set.');
        return;
      }
    }

    writeConfig({ masterPath: resolved });
    p.log.success(`Master set to: ${resolved}`);
    return;
  }

  p.log.error('Usage: prov master [path|set <path>]');
}
