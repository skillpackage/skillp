/**
 * `skilladd remove <name>` command.
 *
 * Removes an installed skill:
 *  1. Delete .agents/skills/<name>/
 *  2. Delete symlinks from each agent directory
 *  3. Remove entry from skills.json
 *  4. Remove entry from skills-lock.json
 */

import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync } from 'fs';
import { join } from 'path';
import { rm, lstat, readlink } from 'fs/promises';
import { resolve, dirname } from 'path';
import { readSkillsJson, removeSkillFromSkillsJson, AGENT_DIR_MAP } from './skills-json.ts';
import { removeSkillFromLocalLock } from './local-lock.ts';
import { UNIVERSAL_SKILLS_DIR } from './constants.ts';

export interface RemoveOptions {
  yes?: boolean;
}

export async function runRemove(names: string[], options: RemoveOptions = {}): Promise<void> {
  console.log();
  p.intro(pc.bgCyan(pc.black(' skills remove ')));

  if (names.length === 0) {
    p.log.error('Specify at least one skill name to remove.');
    p.log.info(`Usage: ${pc.cyan('skilladd remove <name>')}`);
    process.exit(1);
  }

  const cwd = process.cwd();

  for (const name of names) {
    const canonicalDir = join(cwd, UNIVERSAL_SKILLS_DIR, name);

    if (!existsSync(canonicalDir)) {
      p.log.warn(`Skill "${name}" not found in .agents/skills/`);
      continue;
    }

    if (!options.yes) {
      const confirmed = await p.confirm({
        message: `Remove skill ${pc.cyan(name)}? This will delete files and symlinks.`,
      });
      if (p.isCancel(confirmed) || !confirmed) {
        p.log.info(`Skipped ${name}`);
        continue;
      }
    }

    // 1. Delete .agents/skills/<name>/
    try {
      await rm(canonicalDir, { recursive: true, force: true });
      p.log.info(`Deleted ${pc.dim(`.agents/skills/${name}/`)}`);
    } catch (err) {
      p.log.error(`Failed to delete .agents/skills/${name}/: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2. Delete symlinks from each agent directory
    const skillsJson = await readSkillsJson(cwd);
    const agentNames = skillsJson?.agents ?? ['cursor', 'codebuddy', 'claude-code'];

    for (const agentName of agentNames) {
      const agentDir = AGENT_DIR_MAP[agentName];
      if (!agentDir) continue;

      const linkPath = join(cwd, agentDir, name);
      try {
        const stats = await lstat(linkPath);
        if (stats.isSymbolicLink() || stats.isDirectory()) {
          await rm(linkPath, { recursive: true, force: true });
          p.log.info(`Removed ${pc.dim(`${agentDir}/${name}`)}`);
        }
      } catch {
        // Link doesn't exist, that's fine
      }
    }

    // 3. Remove from skills.json
    try {
      const removed = await removeSkillFromSkillsJson(name, cwd);
      if (removed) {
        p.log.info(`Removed from ${pc.dim('skills.json')}`);
      }
    } catch {
      // Non-fatal
    }

    // 4. Remove from skills-lock.json
    try {
      const removed = await removeSkillFromLocalLock(name, cwd);
      if (removed) {
        p.log.info(`Removed from ${pc.dim('skills-lock.json')}`);
      }
    } catch {
      // Non-fatal
    }

    p.log.success(`${pc.green('Removed')} ${pc.cyan(name)}`);
  }

  console.log();
  p.outro(pc.green('Done!'));
}
