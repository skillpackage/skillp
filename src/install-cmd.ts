/**
 * `skillp install` command.
 *
 * Restores symlinks for all agents declared in skills.json.
 * No network required — works entirely from the local vendored files in .agents/skills/.
 */

import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync } from 'fs';
import { join } from 'path';
import { readdir, lstat, rm, mkdir, symlink, readlink } from 'fs/promises';
import { dirname, relative, resolve, basename } from 'path';
import { platform } from 'os';
import { readSkillsJson, AGENT_DIR_MAP } from './skills-json.ts';
import { UNIVERSAL_SKILLS_DIR } from './constants.ts';

/**
 * Ensure a symlink from linkPath -> target exists.
 * Creates parent directories as needed.
 */
async function ensureSymlink(target: string, linkPath: string): Promise<boolean> {
  const resolvedTarget = resolve(target);
  const resolvedLink = resolve(linkPath);

  try {
    const stats = await lstat(linkPath);
    if (stats.isSymbolicLink()) {
      const existing = await readlink(linkPath);
      const existingResolved = resolve(dirname(resolvedLink), existing);
      if (existingResolved === resolvedTarget) {
        return true; // already correct
      }
      await rm(linkPath);
    } else {
      await rm(linkPath, { recursive: true });
    }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ELOOP') {
      await rm(linkPath, { force: true }).catch(() => {});
    }
    // ENOENT is fine — link doesn't exist yet
  }

  await mkdir(dirname(linkPath), { recursive: true });

  const linkDir = dirname(resolvedLink);
  const rel = relative(linkDir, resolvedTarget);
  const symlinkType = platform() === 'win32' ? 'junction' : undefined;

  try {
    await symlink(rel, linkPath, symlinkType);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create symlinks from agent directories to .agents/skills/* for all
 * agents declared in skills.json.
 *
 * Exported so `add` command can call it after installing new skills.
 */
export async function createSymlinksForAgents(cwd?: string): Promise<{
  created: number;
  skipped: number;
  failed: number;
  missing: string[];
}> {
  const projectDir = cwd || process.cwd();
  const skillsJson = await readSkillsJson(projectDir);
  const agentNames = skillsJson?.agents ?? ['cursor', 'codebuddy', 'claude-code'];

  const canonicalDir = join(projectDir, UNIVERSAL_SKILLS_DIR);
  let created = 0;
  let skipped = 0;
  let failed = 0;
  const missing: string[] = [];

  // List all installed skills in .agents/skills/
  let skillDirs: string[] = [];
  try {
    const entries = await readdir(canonicalDir, { withFileTypes: true });
    skillDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    // .agents/skills/ doesn't exist — nothing to symlink
    return { created, skipped, failed, missing };
  }

  // Also check which skills are declared in skills.json but missing from disk
  if (skillsJson) {
    for (const skillName of Object.keys(skillsJson.skills)) {
      if (!skillDirs.includes(skillName)) {
        missing.push(skillName);
      }
    }
  }

  for (const agentName of agentNames) {
    const agentDir = AGENT_DIR_MAP[agentName];
    if (!agentDir) continue;

    for (const skillDir of skillDirs) {
      const target = join(projectDir, UNIVERSAL_SKILLS_DIR, skillDir);
      const linkPath = join(projectDir, agentDir, skillDir);

      const ok = await ensureSymlink(target, linkPath);
      if (ok) {
        created++;
      } else {
        failed++;
      }
    }
  }

  return { created, skipped, failed, missing };
}

export interface InstallOptions {
  yes?: boolean;
}

export async function runInstall(options: InstallOptions = {}): Promise<void> {
  console.log();
  p.intro(pc.bgCyan(pc.black(' skills install ')));

  const cwd = process.cwd();
  const spinner = p.spinner();

  const skillsJson = await readSkillsJson(cwd);
  const agentNames = skillsJson?.agents ?? ['cursor', 'codebuddy', 'claude-code'];

  const canonicalDir = join(cwd, UNIVERSAL_SKILLS_DIR);
  if (!existsSync(canonicalDir)) {
    p.log.warn('No skills installed yet (.agents/skills/ not found).');
    p.log.info(`Run ${pc.cyan('skillp add <source>')} to add skills first.`);
    p.outro(pc.dim('Nothing to do.'));
    return;
  }

  spinner.start('Creating symlinks...');

  const result = await createSymlinksForAgents(cwd);

  spinner.stop('Symlinks created');

  if (result.created > 0) {
    p.log.success(
      `Created ${pc.green(String(result.created))} symlink${result.created !== 1 ? 's' : ''} for agents: ${agentNames.map((a) => pc.cyan(a)).join(', ')}`
    );
  }

  if (result.failed > 0) {
    p.log.warn(
      pc.yellow(
        `${result.failed} symlink${result.failed !== 1 ? 's' : ''} failed to create`
      )
    );
  }

  if (result.missing.length > 0) {
    p.log.warn(
      pc.yellow(
        `Missing skills (declared in skills.json but not in .agents/skills/):`
      )
    );
    for (const name of result.missing) {
      p.log.message(`  ${pc.red('!')} ${name}`);
    }
    p.log.info(
      `Run ${pc.cyan('skillp update --all')} to fetch missing skills from their sources.`
    );
  }

  console.log();
  p.outro(pc.green('Done!'));
}
