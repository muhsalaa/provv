import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectInfo } from '../types.js';

const INDICATORS = ['.git', '.agents', 'CLAUDE.md', 'AGENTS.md'];

export function detectProject(cwd: string): ProjectInfo {
  const found: string[] = [];

  for (const indicator of INDICATORS) {
    if (existsSync(join(cwd, indicator))) {
      found.push(indicator);
    }
  }

  return {
    cwd,
    isProject: found.length > 0,
    reason: found.length > 0 ? found.join(', ') : 'no project indicators found',
  };
}
