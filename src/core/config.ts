import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Config } from '../types.js';

const CONFIG_DIR = join(homedir(), '.config', 'provv');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

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
    return JSON.parse(raw) as Config;
  } catch {
    return null;
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
