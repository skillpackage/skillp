/**
 * `skillp update <name>` command.
 *
 * Updates installed skills to the latest version from their source.
 * Reads skills.json + skills-lock.json, clones the latest, compares commits,
 * and overwrites .agents/skills/<name>/ if there are changes.
 *
 * Skills are grouped by source URL so each repo is cloned at most once.
 */

import * as p from '@clack/prompts';
import pc from 'picocolors';
import { join } from 'path';
import { rm, mkdir } from 'fs/promises';
import { readSkillsJson, type SkillsJsonEntry } from './skills-json.ts';
import { readLocalLock, addSkillToLocalLock, type LocalSkillLockEntry } from './local-lock.ts';
import { normalizeUrl, toSshUrl, detectSourceType, type NormalizedUrl } from './url.ts';
import {
  cloneWithFallback,
  cleanupTempDir,
  getCommitInfo,
  getRemoteCommit,
  GitCloneError,
} from './git.ts';
import { discoverSkills } from './skills.ts';
import { UNIVERSAL_SKILLS_DIR } from './constants.ts';
import { createSymlinksForAgents } from './install-cmd.ts';
import { copyDirectory } from './installer.ts';

export interface UpdateOptions {
  all?: boolean;
  yes?: boolean;
}

type SkillInfo = {
  name: string;
  entry: SkillsJsonEntry;
  lockEntry?: LocalSkillLockEntry;
  currentCommit: string;
};

export async function runUpdate(names: string[], options: UpdateOptions = {}): Promise<void> {
  console.log();
  p.intro(pc.bgCyan(pc.black(' skills update ')));

  const cwd = process.cwd();
  const spinner = p.spinner();

  const skillsJson = await readSkillsJson(cwd);
  if (!skillsJson || Object.keys(skillsJson.skills).length === 0) {
    p.log.warn('No skills.json found or no skills declared.');
    p.log.info(`Run ${pc.cyan('skillp add <source>')} to add skills first.`);
    p.outro(pc.dim('Nothing to update.'));
    return;
  }

  const lock = await readLocalLock(cwd);

  let skillsToUpdate: Array<{ name: string; entry: SkillsJsonEntry }>;

  if (options.all || names.length === 0) {
    skillsToUpdate = Object.entries(skillsJson.skills).map(([name, entry]) => ({
      name,
      entry,
    }));
  } else {
    skillsToUpdate = [];
    for (const name of names) {
      const entry = skillsJson.skills[name];
      if (!entry) {
        p.log.error(`Skill "${name}" not found in skills.json`);
        p.log.info('Available skills: ' + Object.keys(skillsJson.skills).join(', '));
        process.exit(1);
      }
      skillsToUpdate.push({ name, entry });
    }
  }

  let updatedCount = 0;
  let upToDateCount = 0;
  let failedCount = 0;

  // Group skills by normalized source URL to clone each repo only once
  const sourceGroups = new Map<
    string,
    { normalized: NormalizedUrl; sshUrl: string; skills: SkillInfo[] }
  >();

  for (const { name, entry } of skillsToUpdate) {
    const lockEntry = lock.skills[name];

    if (entry.version?.startsWith('commit:')) {
      p.log.info(`${pc.cyan(name)} is locked to a specific commit, skipping.`);
      upToDateCount++;
      continue;
    }

    const normalized = normalizeUrl(entry.source);
    if (!normalized) {
      p.log.warn(pc.yellow(`Cannot parse source URL for ${name}: ${entry.source}`));
      failedCount++;
      continue;
    }

    const sshUrl = toSshUrl(normalized);
    if (!sourceGroups.has(sshUrl)) {
      sourceGroups.set(sshUrl, { normalized, sshUrl, skills: [] });
    }
    sourceGroups.get(sshUrl)!.skills.push({
      name,
      entry,
      lockEntry,
      currentCommit: lockEntry?.commit || '',
    });
  }

  for (const { normalized, sshUrl, skills: groupSkills } of sourceGroups.values()) {
    const skillNames = groupSkills.map((s) => s.name);
    spinner.start(`Checking ${skillNames.map((n) => pc.cyan(n)).join(', ')}...`);

    // Single remote commit check per source
    const remoteCommit = await getRemoteCommit(sshUrl);

    const upToDate: SkillInfo[] = [];
    const needsUpdate: SkillInfo[] = [];

    for (const skill of groupSkills) {
      if (skill.currentCommit && remoteCommit && remoteCommit === skill.currentCommit) {
        upToDate.push(skill);
      } else {
        needsUpdate.push(skill);
      }
    }

    if (needsUpdate.length === 0) {
      spinner.stop(
        upToDate.map((s) => `${pc.cyan(s.name)} — ${pc.green('Already up to date')}`).join(', ')
      );
      upToDateCount += upToDate.length;
      continue;
    }

    // Some skills need updating
    spinner.stop(
      upToDate.length > 0
        ? `${upToDate.length} up to date, ${needsUpdate.length} to update`
        : `${needsUpdate.length} to update`
    );

    for (const skill of upToDate) {
      p.log.info(`${pc.cyan(skill.name)} — ${pc.green('Already up to date')}`);
    }
    upToDateCount += upToDate.length;

    // Clone this source once for all skills that need updating
    spinner.start(`Cloning ${pc.dim(sshUrl.replace(/^git@[^:]+:/, ''))}...`);

    let tempDir: string | null = null;
    try {
      const cloneResult = await cloneWithFallback(normalized);
      tempDir = cloneResult.tempDir;

      const newCommitInfo = await getCommitInfo(tempDir);
      spinner.stop(`Cloned latest (${newCommitInfo.commit.slice(0, 7)})`);

      for (const skill of needsUpdate) {
        const { name, entry, lockEntry, currentCommit } = skill;

        if (currentCommit && newCommitInfo.commit === currentCommit) {
          p.log.info(`${pc.cyan(name)} — ${pc.green('Already up to date')}`);
          upToDateCount++;
          continue;
        }

        try {
          const subpath = entry.path;
          const discoveredSkills = await discoverSkills(tempDir, subpath, {
            includeInternal: true,
          });
          const matchedSkill = discoveredSkills.find(
            (s) => s.name === name || s.name.toLowerCase() === name.toLowerCase()
          );

          if (!matchedSkill) {
            p.log.warn(pc.yellow(`Skill "${name}" not found in source repo`));
            failedCount++;
            continue;
          }

          const oldVersion = lockEntry?.resolvedVersion || 'unknown';
          const newVersion = (matchedSkill.metadata?.version as string) || 'latest';
          const shortOldCommit = currentCommit ? currentCommit.slice(0, 7) : 'none';
          const shortNewCommit = newCommitInfo.commit.slice(0, 7);

          p.log.info(`${pc.cyan(name)} — update available`);
          p.log.info(`  ${pc.dim('version:')} ${oldVersion} → ${pc.green(newVersion)}`);
          p.log.info(`  ${pc.dim('commit:')}  ${shortOldCommit} → ${pc.green(shortNewCommit)}`);

          if (!options.yes) {
            const confirmed = await p.confirm({ message: `Update ${name}?` });
            if (p.isCancel(confirmed) || !confirmed) {
              p.log.info(`Skipped ${name}`);
              continue;
            }
          }

          const targetDir = join(cwd, UNIVERSAL_SKILLS_DIR, name);
          await rm(targetDir, { recursive: true, force: true });
          await mkdir(targetDir, { recursive: true });
          await copyDirectory(matchedSkill.path, targetDir);

          const sourceType = detectSourceType(normalized.host);
          const resolvedVersion = (matchedSkill.metadata?.version as string) || 'latest';

          await addSkillToLocalLock(
            name,
            {
              source: sshUrl,
              sourceType,
              path: entry.path,
              resolvedVersion,
              commit: newCommitInfo.commit,
              commitAt: newCommitInfo.commitAt,
            },
            cwd
          );

          p.log.success(`${pc.green('Updated')} ${pc.cyan(name)} (${shortNewCommit})`);
          updatedCount++;
        } catch (skillError) {
          p.log.error(
            `Failed to update ${pc.cyan(name)}: ${skillError instanceof Error ? skillError.message : 'Unknown error'}`
          );
          failedCount++;
        }
      }

      await cleanupTempDir(tempDir);
    } catch (error) {
      if (tempDir) {
        await cleanupTempDir(tempDir).catch(() => {});
      }

      if (error instanceof GitCloneError) {
        spinner.stop(pc.red(`Failed to clone ${sshUrl.replace(/^git@[^:]+:/, '')}`));
        p.log.error(pc.dim(error.message));
      } else {
        spinner.stop(pc.red(`Failed to clone ${sshUrl.replace(/^git@[^:]+:/, '')}`));
        p.log.error(error instanceof Error ? error.message : 'Unknown error');
      }
      failedCount += needsUpdate.length;
    }
  }

  // Recreate symlinks after updates
  if (updatedCount > 0) {
    try {
      await createSymlinksForAgents(cwd);
    } catch {
      // Non-fatal
    }
  }

  // Summary
  console.log();
  const parts: string[] = [];
  if (updatedCount > 0) parts.push(pc.green(`${updatedCount} updated`));
  if (upToDateCount > 0) parts.push(pc.dim(`${upToDateCount} up to date`));
  if (failedCount > 0) parts.push(pc.red(`${failedCount} failed`));

  p.outro(parts.join(', ') || pc.green('Done!'));
}

