import simpleGit from 'simple-git';
import { join, normalize, resolve, sep } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { type NormalizedUrl, toSshUrl, toHttpsUrl } from './url.ts';

const CLONE_TIMEOUT_MS = 60000; // 60 seconds

export class GitCloneError extends Error {
  readonly url: string;
  readonly isTimeout: boolean;
  readonly isAuthError: boolean;

  constructor(message: string, url: string, isTimeout = false, isAuthError = false) {
    super(message);
    this.name = 'GitCloneError';
    this.url = url;
    this.isTimeout = isTimeout;
    this.isAuthError = isAuthError;
  }
}

function newGit(baseDir?: string) {
  // GIT_TERMINAL_PROMPT=0 prevents git from prompting for credentials
  process.env.GIT_TERMINAL_PROMPT = '0';
  const opts = baseDir
    ? { baseDir, timeout: { block: CLONE_TIMEOUT_MS } }
    : { timeout: { block: CLONE_TIMEOUT_MS } };
  return simpleGit(opts);
}

function classifyError(errorMessage: string): { isTimeout: boolean; isAuthError: boolean } {
  const isTimeout =
    errorMessage.includes('block timeout') || errorMessage.includes('timed out');
  const isAuthError =
    errorMessage.includes('Authentication failed') ||
    errorMessage.includes('could not read Username') ||
    errorMessage.includes('Permission denied') ||
    errorMessage.includes('Repository not found');
  return { isTimeout, isAuthError };
}

export async function cloneRepo(url: string, ref?: string): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'skills-'));
  const git = newGit();
  const cloneOptions = ref ? ['--depth', '1', '--branch', ref] : ['--depth', '1'];

  try {
    await git.clone(url, tempDir, cloneOptions);
    return tempDir;
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});

    const errorMessage = error instanceof Error ? error.message : String(error);
    const { isTimeout, isAuthError } = classifyError(errorMessage);

    if (isTimeout) {
      throw new GitCloneError(
        `Clone timed out after 60s. This often happens with private repos that require authentication.\n` +
          `  Ensure you have access and your SSH keys or credentials are configured:\n` +
          `  - For SSH: ssh-add -l (to check loaded keys)\n` +
          `  - For HTTPS: gh auth status (if using GitHub CLI)`,
        url,
        true,
        false
      );
    }

    if (isAuthError) {
      throw new GitCloneError(
        `Authentication failed for ${url}.\n` +
          `  - For private repos, ensure you have access\n` +
          `  - For SSH: Check your keys with 'ssh -T git@github.com'\n` +
          `  - For HTTPS: Run 'gh auth login' or configure git credentials`,
        url,
        false,
        true
      );
    }

    throw new GitCloneError(`Failed to clone ${url}: ${errorMessage}`, url, false, false);
  }
}

/**
 * Clone with SSH-first, HTTPS-fallback strategy.
 * Returns { tempDir, usedUrl } so caller knows which URL succeeded.
 */
export async function cloneWithFallback(
  normalized: NormalizedUrl,
  ref?: string
): Promise<{ tempDir: string; usedUrl: string }> {
  const sshUrl = toSshUrl(normalized);
  try {
    const tempDir = await cloneRepo(sshUrl, ref);
    return { tempDir, usedUrl: sshUrl };
  } catch (sshError) {
    // Only fallback for auth/connectivity errors, not timeouts
    if (sshError instanceof GitCloneError && sshError.isTimeout) {
      throw sshError;
    }

    const httpsUrl = toHttpsUrl(normalized);
    try {
      const tempDir = await cloneRepo(httpsUrl, ref);
      console.warn(`  warn: SSH clone failed, using HTTPS fallback`);
      return { tempDir, usedUrl: httpsUrl };
    } catch {
      // Both failed — throw the original SSH error for better diagnostics
      throw sshError;
    }
  }
}

export interface CommitInfo {
  /** Full 40-char commit hash */
  commit: string;
  /** ISO 8601 timestamp of the commit */
  commitAt: string;
}

/**
 * Extract the HEAD commit hash and author date from a cloned repo directory.
 */
export async function getCommitInfo(repoDir: string): Promise<CommitInfo> {
  const git = newGit(repoDir);
  const log = await git.log({ maxCount: 1, format: { hash: '%H', date: '%aI' } });
  const latest = log.latest;
  if (!latest) {
    throw new Error('No commits found in repository');
  }
  return {
    commit: latest.hash,
    commitAt: (latest as unknown as { date: string }).date,
  };
}

/**
 * Get the latest remote commit hash for a ref (default HEAD) without cloning.
 */
export async function getRemoteCommit(
  url: string,
  ref: string = 'HEAD'
): Promise<string | null> {
  const git = newGit();
  try {
    const result = await git.listRemote([url, ref]);
    const match = result.trim().match(/^([0-9a-f]{40})/);
    return match ? match[1]! : null;
  } catch {
    return null;
  }
}

/**
 * Get remote tags matching a pattern. Returns array of {tag, commit}.
 */
export async function getRemoteTags(
  url: string
): Promise<Array<{ tag: string; commit: string }>> {
  const git = newGit();
  try {
    const result = await git.listRemote(['--tags', '--refs', url]);
    const tags: Array<{ tag: string; commit: string }> = [];
    for (const line of result.trim().split('\n')) {
      if (!line) continue;
      const match = line.match(/^([0-9a-f]+)\s+refs\/tags\/(.+)$/);
      if (match) {
        tags.push({ commit: match[1]!, tag: match[2]! });
      }
    }
    return tags;
  } catch {
    return [];
  }
}

export async function cleanupTempDir(dir: string): Promise<void> {
  const normalizedDir = normalize(resolve(dir));
  const normalizedTmpDir = normalize(resolve(tmpdir()));

  if (!normalizedDir.startsWith(normalizedTmpDir + sep) && normalizedDir !== normalizedTmpDir) {
    throw new Error('Attempted to clean up directory outside of temp directory');
  }

  await rm(dir, { recursive: true, force: true });
}
