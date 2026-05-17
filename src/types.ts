export interface Config {
  masterPath: string;
}

export type SkillType = 'own' | 'skills.sh';

export interface TrackingEntry {
  type: SkillType;
  linkedTo: string[];
}

export interface TrackingFile {
  version: 1;
  skills: Record<string, TrackingEntry>;
}

export interface SkillsLockSkill {
  source: string;
  sourceType: string;
  skillPath?: string;
  computedHash: string;
}

export interface SkillsLockFile {
  version: 1;
  skills: Record<string, SkillsLockSkill>;
}

export interface ProjectInfo {
  isProject: boolean;
  reason: string;
  cwd: string;
}

export interface SkillOption {
  name: string;
  type: SkillType;
  synced: boolean;
}
