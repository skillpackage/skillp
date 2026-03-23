import { readFile, writeFile, readdir } from 'fs/promises';
import { join, relative } from 'path';
import { createHash } from 'crypto';
import type { SourceType } from './url.ts';

const LOCAL_LOCK_FILE = 'skills-lock.json';
const CURRENT_VERSION = 2;

/**
 * V2 lock entry — tracks the exact commit from the source repo.
 *
 * In vendored mode, the project's own git history is the integrity guarantee,
 * so we no longer need computedHash.
 */
export interface LocalSkillLockEntry {
  /** Source repo URL (SSH format) */
  source: string;
  /** Platform type */
  sourceType: SourceType;
  /** Path of the skill inside the source repo */
  path?: string;
  /** Resolved version (from SKILL.md frontmatter `version`, or "latest") */
  resolvedVersion: string;
  /** Full 40-char commit hash */
  commit: string;
  /** Commit timestamp (ISO 8601) — deterministic across machines */
  commitAt: string;
}

/** V1 entry shape for backward-compatible reading */
interface LocalSkillLockEntryV1 {
  source: string;
  sourceType: string;
  computedHash: string;
}

export interface LocalSkillLockFile {
  version: number;
  skills: Record<string, LocalSkillLockEntry>;
}

export function getLocalLockPath(cwd?: string): string {
  return join(cwd || process.cwd(), LOCAL_LOCK_FILE);
}

/**
 * Read the local lock file. Handles v1 -> v2 migration transparently.
 */
export async function readLocalLock(cwd?: string): Promise<LocalSkillLockFile> {
  const lockPath = getLocalLockPath(cwd);

  try {
    const content = await readFile(lockPath, 'utf-8');
    const parsed = JSON.parse(content);

    if (typeof parsed.version !== 'number' || !parsed.skills) {
      return createEmptyLocalLock();
    }

    // Already v2
    if (parsed.version >= CURRENT_VERSION) {
      return parsed as LocalSkillLockFile;
    }

    // Migrate v1 entries: preserve source/sourceType, fill missing fields
    if (parsed.version === 1) {
      const migrated: Record<string, LocalSkillLockEntry> = {};
      for (const [name, v1Entry] of Object.entries(parsed.skills)) {
        const old = v1Entry as LocalSkillLockEntryV1;
        migrated[name] = {
          source: old.source,
          sourceType: (old.sourceType as SourceType) || 'other',
          resolvedVersion: 'latest',
          commit: '',
          commitAt: '',
        };
      }
      return { version: CURRENT_VERSION, skills: migrated };
    }

    return createEmptyLocalLock();
  } catch {
    return createEmptyLocalLock();
  }
}

export async function writeLocalLock(lock: LocalSkillLockFile, cwd?: string): Promise<void> {
  const lockPath = getLocalLockPath(cwd);

  const sortedSkills: Record<string, LocalSkillLockEntry> = {};
  for (const key of Object.keys(lock.skills).sort()) {
    sortedSkills[key] = lock.skills[key]!;
  }

  const sorted: LocalSkillLockFile = { version: CURRENT_VERSION, skills: sortedSkills };
  const content = JSON.stringify(sorted, null, 2) + '\n';
  await writeFile(lockPath, content, 'utf-8');
}

/**
 * Compute a SHA-256 hash from all files in a skill directory.
 * Kept for backward compatibility with existing callers.
 */
export async function computeSkillFolderHash(skillDir: string): Promise<string> {
  const files: Array<{ relativePath: string; content: Buffer }> = [];
  await collectFiles(skillDir, skillDir, files);

  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file.relativePath);
    hash.update(file.content);
  }

  return hash.digest('hex');
}

async function collectFiles(
  baseDir: string,
  currentDir: string,
  results: Array<{ relativePath: string; content: Buffer }>
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules') return;
        await collectFiles(baseDir, fullPath, results);
      } else if (entry.isFile()) {
        const content = await readFile(fullPath);
        const relativePath = relative(baseDir, fullPath).split('\\').join('/');
        results.push({ relativePath, content });
      }
    })
  );
}

export async function addSkillToLocalLock(
  skillName: string,
  entry: LocalSkillLockEntry,
  cwd?: string
): Promise<void> {
  const lock = await readLocalLock(cwd);
  lock.skills[skillName] = entry;
  await writeLocalLock(lock, cwd);
}

export async function removeSkillFromLocalLock(skillName: string, cwd?: string): Promise<boolean> {
  const lock = await readLocalLock(cwd);

  if (!(skillName in lock.skills)) {
    return false;
  }

  delete lock.skills[skillName];
  await writeLocalLock(lock, cwd);
  return true;
}

function createEmptyLocalLock(): LocalSkillLockFile {
  return {
    version: CURRENT_VERSION,
    skills: {},
  };
}
