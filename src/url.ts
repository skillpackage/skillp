/**
 * URL normalization utilities for skillp.
 *
 * Parses SSH, HTTPS, and preview-link formats into a canonical {host, owner, repo}
 * structure, then constructs SSH or HTTPS URLs as needed.
 */

export interface NormalizedUrl {
  host: string;
  owner: string;
  repo: string;
}

export type SourceType = 'git.woa' | 'github' | 'gitlab' | 'other';

/**
 * Parse any git source URL into a normalized {host, owner, repo} structure.
 *
 * Supported formats:
 *   git@git.woa.com:chong/chong-skills.git
 *   https://git.woa.com/chong/chong-skills.git
 *   https://git.woa.com/chong/chong-skills       (preview link, no .git)
 *   https://github.com/owner/repo
 *   git@github.com:owner/repo.git
 *
 * Returns null if the URL cannot be parsed.
 */
export function normalizeUrl(input: string): NormalizedUrl | null {
  // SSH format: git@host:owner/repo.git
  const sshMatch = input.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (sshMatch) {
    const host = sshMatch[1]!;
    const path = sshMatch[2]!;
    const parts = path.split('/');
    if (parts.length >= 2) {
      const repo = parts.pop()!;
      const owner = parts.join('/');
      return { host, owner, repo };
    }
    return null;
  }

  // HTTPS format: https://host/owner/repo[.git]
  if (input.startsWith('http://') || input.startsWith('https://')) {
    try {
      const url = new URL(input);
      let path = url.pathname.slice(1); // remove leading /
      path = path.replace(/\.git$/, '');
      path = path.replace(/\/$/, ''); // trailing slash

      const parts = path.split('/');
      if (parts.length >= 2) {
        const repo = parts.pop()!;
        const owner = parts.join('/');
        return { host: url.hostname, owner, repo };
      }
    } catch {
      // invalid URL
    }
    return null;
  }

  return null;
}

/**
 * Construct an SSH URL from a normalized URL.
 * e.g. git@git.woa.com:chong/chong-skills.git
 */
export function toSshUrl(n: NormalizedUrl): string {
  return `git@${n.host}:${n.owner}/${n.repo}.git`;
}

/**
 * Construct an HTTPS URL from a normalized URL.
 * e.g. https://git.woa.com/chong/chong-skills.git
 */
export function toHttpsUrl(n: NormalizedUrl): string {
  return `https://${n.host}/${n.owner}/${n.repo}.git`;
}

/**
 * Detect the source platform type from a hostname.
 */
export function detectSourceType(host: string): SourceType {
  if (host === 'git.woa.com') return 'git.woa';
  if (host === 'github.com') return 'github';
  if (host.includes('gitlab')) return 'gitlab';
  return 'other';
}
