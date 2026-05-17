import { existsSync, mkdirSync, readFileSync, lstatSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

function getGitExcludePath(projectPath: string): string | null {
  const gitExclude = join(projectPath, '.git', 'info', 'exclude');
  if (existsSync(gitExclude)) return gitExclude;
  return null;
}

export function createSymlink(target: string, source: string): void {
  const targetDir = target.substring(0, target.lastIndexOf('/'));
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // Use lstat to detect symlinks without following target
  try {
    const stat = lstatSync(target);
    if (stat.isSymbolicLink()) {
      execSync(`unlink "${target}"`);
    } else {
      throw new Error(`Target ${target} exists and is not a symlink`);
    }
  } catch (err: unknown) {
    // ENOENT means path doesn't exist — fine, proceed
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }

  execSync(`ln -sf "${source}" "${target}"`);
}

export function removeSymlink(path: string): boolean {
  try {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
      execSync(`unlink "${path}"`);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function addToGitExclude(projectPath: string, pattern: string): boolean {
  const excludePath = getGitExcludePath(projectPath);
  if (!excludePath) return false;

  let content = '';
  try {
    content = readFileSync(excludePath, 'utf-8');
  } catch {
    content = '';
  }

  const lines = content.split('\n').map((l) => l.trim());
  if (lines.includes(pattern)) return false;

  content += `\n${pattern}\n`;
  writeFileSync(excludePath, content);
  return true;
}

export function removeFromGitExclude(projectPath: string, pattern: string): boolean {
  const excludePath = getGitExcludePath(projectPath);
  if (!excludePath) return false;

  try {
    let content = readFileSync(excludePath, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim() !== pattern);
    const newContent = lines.join('\n');
    if (newContent !== content) {
      writeFileSync(excludePath, newContent);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
