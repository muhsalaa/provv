import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { TrackingFile, TrackingEntry, SkillType } from '../types.js';

const TRACKING_NAME = 'provv-links.json';

export function getTrackingPath(masterPath: string): string {
  return join(masterPath, TRACKING_NAME);
}

export function readTracking(masterPath: string): TrackingFile {
  const path = getTrackingPath(masterPath);
  try {
    if (!existsSync(path)) return { version: 1, skills: {} };
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw) as TrackingFile;
  } catch {
    return { version: 1, skills: {} };
  }
}

function writeTracking(masterPath: string, data: TrackingFile): void {
  const path = getTrackingPath(masterPath);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

export function addLink(
  masterPath: string,
  skillName: string,
  targetPath: string,
  type: SkillType,
): void {
  const tracking = readTracking(masterPath);
  if (!tracking.skills[skillName]) {
    tracking.skills[skillName] = { type, linkedTo: [] };
  }
  if (!tracking.skills[skillName].linkedTo.includes(targetPath)) {
    tracking.skills[skillName].linkedTo.push(targetPath);
  }
  writeTracking(masterPath, tracking);
}

export function removeLink(
  masterPath: string,
  skillName: string,
  targetPath: string,
): boolean {
  const tracking = readTracking(masterPath);
  const entry = tracking.skills[skillName];
  if (!entry) return false;

  const idx = entry.linkedTo.indexOf(targetPath);
  if (idx === -1) return false;

  entry.linkedTo.splice(idx, 1);
  if (entry.linkedTo.length === 0) {
    delete tracking.skills[skillName];
  }
  writeTracking(masterPath, tracking);
  return true;
}

export function removeAllLinks(masterPath: string, skillName: string): string[] {
  const tracking = readTracking(masterPath);
  const entry = tracking.skills[skillName];
  if (!entry) return [];

  const targets = [...entry.linkedTo];
  delete tracking.skills[skillName];
  writeTracking(masterPath, tracking);
  return targets;
}

export function getLinkedTargets(masterPath: string, skillName: string): string[] {
  const tracking = readTracking(masterPath);
  return tracking.skills[skillName]?.linkedTo ?? [];
}

export function getSkillType(masterPath: string, skillName: string): SkillType | null {
  const tracking = readTracking(masterPath);
  return tracking.skills[skillName]?.type ?? null;
}
