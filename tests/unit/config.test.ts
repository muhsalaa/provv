import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanConfig } from '../helpers.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Use inline string in mock factory to avoid vi.mock hoisting issues with const refs
vi.mock('node:os', () => ({
  homedir: () => '/tmp/provv-test-home-config',
  tmpdir: () => '/tmp',
}));

beforeEach(() => cleanConfig('/tmp/provv-test-home-config'));
afterEach(() => cleanConfig('/tmp/provv-test-home-config'));

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
    mkdirSync('/tmp/provv-test-home-config/.config/provv', { recursive: true });
    writeFileSync(getConfigPath(), 'not valid json');
    const { readConfig } = await import('../../src/core/config.js');
    expect(readConfig()).toBeNull();
  });

  it('warns on unknown config fields', async () => {
    const { getConfigPath } = await import('../../src/core/config.js');
    mkdirSync('/tmp/provv-test-home-config/.config/provv', { recursive: true });
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
    mkdirSync('/tmp/provv-test-home-config/.config/provv', { recursive: true });
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
