/**
 * Manages the project-level skills.json dependency declaration file.
 *
 * skills.json declares which skills a project depends on and which
 * agent directories should receive symlinks.
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const SKILLS_JSON_FILE = 'skills.json';

export interface SkillsJsonEntry {
  /** Git repository URL (stored as SSH format) */
  source: string;
  /** Path within the source repo (monorepo support) */
  path?: string;
  /** Version constraint: "latest", "1.0.0", "^1.0.0", "~1.0.0", "commit:<hash>" */
  version?: string;
}

export interface SkillsJsonFile {
  skills: Record<string, SkillsJsonEntry>;
  /** Agent names that should get symlinks: "cursor", "codebuddy", "claude-code", "codex" */
  agents: string[];
}

/**
 * Agent name in skills.json -> directory path mapping.
 */
export const AGENT_DIR_MAP: Record<string, string> = {
  cursor: '.cursor/skills',
  codebuddy: '.codebuddy/skills',
  'claude-code': '.claude/skills',
  codex: '.codex/skills',
};

export function getSkillsJsonPath(cwd?: string): string {
  return join(cwd || process.cwd(), SKILLS_JSON_FILE);
}

export async function readSkillsJson(cwd?: string): Promise<SkillsJsonFile | null> {
  const filePath = getSkillsJsonPath(cwd);
  try {
    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content) as SkillsJsonFile;
    if (!parsed.skills || typeof parsed.skills !== 'object') {
      return null;
    }
    if (!Array.isArray(parsed.agents)) {
      parsed.agents = [];
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writeSkillsJson(
  data: SkillsJsonFile,
  cwd?: string
): Promise<void> {
  const filePath = getSkillsJsonPath(cwd);

  // Sort skills alphabetically for deterministic output
  const sortedSkills: Record<string, SkillsJsonEntry> = {};
  for (const key of Object.keys(data.skills).sort()) {
    sortedSkills[key] = data.skills[key]!;
  }

  const sorted: SkillsJsonFile = {
    skills: sortedSkills,
    agents: data.agents,
  };

  const content = JSON.stringify(sorted, null, 2) + '\n';
  await writeFile(filePath, content, 'utf-8');
}

/**
 * Add or update a skill entry in skills.json. Creates the file if missing.
 */
export async function addSkillToSkillsJson(
  skillName: string,
  entry: SkillsJsonEntry,
  cwd?: string
): Promise<void> {
  let data = await readSkillsJson(cwd);
  if (!data) {
    data = createDefaultSkillsJson();
  }
  data.skills[skillName] = entry;
  await writeSkillsJson(data, cwd);
}

/**
 * Remove a skill entry from skills.json.
 * Returns true if the skill was found and removed.
 */
export async function removeSkillFromSkillsJson(
  skillName: string,
  cwd?: string
): Promise<boolean> {
  const data = await readSkillsJson(cwd);
  if (!data || !(skillName in data.skills)) {
    return false;
  }
  delete data.skills[skillName];
  await writeSkillsJson(data, cwd);
  return true;
}

/**
 * Ensure skills.json exists, creating with defaults if missing.
 */
export async function ensureSkillsJson(cwd?: string): Promise<SkillsJsonFile> {
  const existing = await readSkillsJson(cwd);
  if (existing) return existing;

  const data = createDefaultSkillsJson();
  await writeSkillsJson(data, cwd);
  return data;
}

function createDefaultSkillsJson(): SkillsJsonFile {
  return {
    skills: {},
    agents: ['cursor', 'codebuddy', 'claude-code'],
  };
}
