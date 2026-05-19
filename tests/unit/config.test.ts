import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { cleanConfig } from '../helpers.js';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Unique temp home per test run — no external refs so vi.mock hoisting is safe
const TEST_HOME = `/tmp/provv-test-${Math.random().toString(36).slice(2, 10)}`;

vi.mock('node:os', () => ({
  homedir: () => TEST_HOME,
  tmpdir: () => '/tmp',
}));

afterAll(() => { try { rmSync(TEST_HOME, { recursive: true, force: true }); } catch {} });
beforeEach(() => cleanConfig(TEST_HOME));
afterEach(() => cleanConfig(TEST_HOME));

describe('config', () => {
  it('returns null when no config exists', async () => {
    const { readConfig } = await import('../../src/core/config.js');
    expect(readConfig()).toBeNull();
  });

  it('returns defaults when no config exists', async () => {
    const { readConfigWithDefaults } = await import('../../src/core/config.js');
    const cfg = readConfigWithDefaults();
    expect(cfg.masterPath).toBe('');
    expect(cfg.gitExclude).toBe('auto-ignore');
  });

  it('writes and reads config', async () => {
    const { writeConfig, readConfig } = await import('../../src/core/config.js');
    writeConfig({ masterPath: '/tmp/master', gitExclude: 'never' });
    const cfg = readConfig();
    expect(cfg?.masterPath).toBe('/tmp/master');
    expect(cfg?.gitExclude).toBe('never');
  });

  it('returns null for malformed JSON', async () => {
    const { getConfigPath } = await import('../../src/core/config.js');
    mkdirSync(join(TEST_HOME, '.config', 'provv'), { recursive: true });
    writeFileSync(getConfigPath(), 'not valid json');
    const { readConfig } = await import('../../src/core/config.js');
    expect(readConfig()).toBeNull();
  });

  it('warns on unknown config fields', async () => {
    const { getConfigPath } = await import('../../src/core/config.js');
    mkdirSync(join(TEST_HOME, '.config', 'provv'), { recursive: true });
    writeFileSync(getConfigPath(), JSON.stringify({
      masterPath: '/tmp/master',
      unknownField: 'blah',
    }));

    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { readConfig } = await import('../../src/core/config.js');
    readConfig();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unknown field "unknownField"'),
    );
    warnSpy.mockRestore();
  });

  it('warns on invalid gitExclude value', async () => {
    const { getConfigPath } = await import('../../src/core/config.js');
    mkdirSync(join(TEST_HOME, '.config', 'provv'), { recursive: true });
    writeFileSync(getConfigPath(), JSON.stringify({
      masterPath: '/tmp/master',
      gitExclude: 'never-never',
    }));

    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { readConfig } = await import('../../src/core/config.js');
    readConfig();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('invalid gitExclude "never-never"'),
    );
    warnSpy.mockRestore();
  });

  it('provides gitExclude default when field is missing', async () => {
    const { writeConfig, readConfigWithDefaults } = await import('../../src/core/config.js');
    writeConfig({ masterPath: '/tmp/master' });
    const cfg = readConfigWithDefaults();
    expect(cfg.gitExclude).toBe('auto-ignore');
  });
});
