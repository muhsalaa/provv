import { describe, it, expect } from 'vitest';

/**
 * Tests for npx command parsing regex pattern used in install.ts.
 * The regex is duplicated here to test the pattern contract.
 */
const NPX_CMD_RE = /npx\s+skills(?:@[\w.]+)?\s+add\s+(https?:\/\/[^\s]+|[\w.-]+\/[\w.-]+)(?:\s+--skill(?:=|\s+)([\w,-]+))?/;

describe('npx command regex', () => {
  it('parses shorthand repo with skill', () => {
    const m = 'npx skills add user/repo --skill caveman'.match(NPX_CMD_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('user/repo');
    expect(m![2]).toBe('caveman');
  });

  it('parses full URL with skill', () => {
    const m = 'npx skills add https://github.com/user/repo --skill caveman'.match(NPX_CMD_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('https://github.com/user/repo');
    expect(m![2]).toBe('caveman');
  });

  it('handles --skill=name with equals sign', () => {
    const m = 'npx skills add user/repo --skill=caveman'.match(NPX_CMD_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('user/repo');
    expect(m![2]).toBe('caveman');
  });

  it('handles .git suffix in URL', () => {
    const m = 'npx skills add https://github.com/user/repo.git --skill caveman'.match(NPX_CMD_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('https://github.com/user/repo.git');
  });

  // Use regex here
  it('handles query params in URL', () => {
    const url = 'https://github.com/user/repo?branch=main&foo=bar';
    const m = `npx skills add ${url} --skill caveman`.match(NPX_CMD_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe(url);
  });

  it('handles version-pinned npx command', () => {
    const m = 'npx skills@latest add user/repo --skill caveman'.match(NPX_CMD_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('user/repo');
    expect(m![2]).toBe('caveman');
  });

  it('handles dotted repo names (org.repo)', () => {
    const m = 'npx skills add microsoft/azure-skills --skill azure-ai'.match(NPX_CMD_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('microsoft/azure-skills');
  });

  it('handles comma-separated skill names', () => {
    const m = 'npx skills add user/repo --skill alpha,beta'.match(NPX_CMD_RE);
    expect(m).not.toBeNull();
    expect(m![2]).toBe('alpha,beta');
  });

  it('handles comma-separated with equals sign', () => {
    const m = 'npx skills add user/repo --skill=alpha,beta'.match(NPX_CMD_RE);
    expect(m).not.toBeNull();
    expect(m![2]).toBe('alpha,beta');
  });

  it('handles beta version tag', () => {
    const m = 'npx skills@beta add user/repo --skill caveman'.match(NPX_CMD_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('user/repo');
  });

  it('returns null for non-npx command', () => {
    const m = 'git clone https://github.com/user/repo'.match(NPX_CMD_RE);
    expect(m).toBeNull();
  });

  it('parses bare URL (no --skill)', () => {
    const m = 'npx skills add user/repo'.match(NPX_CMD_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('user/repo');
    expect(m![2]).toBeUndefined();
  });
});

describe('skill name splitting', () => {
  // This mirrors the split logic in install.ts:
  // skillNames = cmdMatch[2].split(/[\s,]+/).filter(Boolean);
  function parseSkillNames(raw: string | undefined): string[] {
    if (!raw) return [];
    return raw.split(/[\s,]+/).filter(Boolean);
  }

  it('splits comma-separated names', () => {
    expect(parseSkillNames('alpha,beta')).toEqual(['alpha', 'beta']);
  });

  it('splits space-separated names', () => {
    expect(parseSkillNames('alpha beta')).toEqual(['alpha', 'beta']);
  });

  it('splits mixed separators', () => {
    expect(parseSkillNames('alpha, beta, gamma')).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('filters empty entries', () => {
    expect(parseSkillNames('alpha,,beta,')).toEqual(['alpha', 'beta']);
  });

  it('returns empty array for undefined', () => {
    expect(parseSkillNames(undefined)).toEqual([]);
  });
});

describe('URL candidate detection', () => {
  // Mirrors the isCommand logic in install.ts:
  function looksLikeCommandOrUrl(arg: string): boolean {
    return arg === 'npx' || arg.startsWith('http') || /^[\w.-]+\/[\w.-]+$/.test(arg);
  }

  it('detects npx command', () => {
    expect(looksLikeCommandOrUrl('npx')).toBe(true);
  });

  it('detects http URL', () => {
    expect(looksLikeCommandOrUrl('https://github.com/user/repo')).toBe(true);
  });

  it('detects shorthand repo', () => {
    expect(looksLikeCommandOrUrl('user/repo')).toBe(true);
  });

  it('detects dotted shorthand repo', () => {
    expect(looksLikeCommandOrUrl('microsoft/azure-skills')).toBe(true);
  });

  it('rejects skill name only', () => {
    expect(looksLikeCommandOrUrl('caveman')).toBe(false);
  });

  it('rejects absolute path to file', () => {
    expect(looksLikeCommandOrUrl('/usr/local/bin/skills')).toBe(false);
  });
});
