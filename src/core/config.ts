import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Config, GitExcludeMode } from '../types.js';

const CONFIG_DIR = join(homedir(), '.config', 'provv');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

const VALID_FIELDS = new Set(['masterPath', 'gitExclude']);
const VALID_GIT_EXCLUDE: GitExcludeMode[] = ['auto-ignore', 'never', 'ask'];

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function readConfig(): Config | null {
  try {
    if (!existsSync(CONFIG_PATH)) return null;
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    validateParsedConfig(parsed);
    return parsed as Config;
  } catch {
    return null;
  }
}

export function readConfigWithDefaults(): Config {
  const config = readConfig();
  return {
    masterPath: config?.masterPath ?? '',
    gitExclude: config?.gitExclude ?? 'auto-ignore',
  };
}

function validateParsedConfig(parsed: Record<string, unknown>): void {
  // Check for unknown fields
  for (const key of Object.keys(parsed)) {
    if (!VALID_FIELDS.has(key)) {
      console.error(
        `⚠ provv config: unknown field "${key}" in ${CONFIG_PATH} — ignoring`,
      );
    }
  }

  // Validate gitExclude value
  if (parsed.gitExclude !== undefined && parsed.gitExclude !== null) {
    if (!VALID_GIT_EXCLUDE.includes(parsed.gitExclude as GitExcludeMode)) {
      console.error(
        `⚠ provv config: invalid gitExclude "${String(parsed.gitExclude)}" — expected one of: ${VALID_GIT_EXCLUDE.join(', ')}. Falling back to "auto-ignore".`,
      );
    }
  }
}

export function writeConfig(config: Config): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}
