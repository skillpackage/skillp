#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runAdd, parseAddOptions, initTelemetry } from './add.ts';
import { runInstall } from './install-cmd.ts';
import { runUpdate } from './update-cmd.ts';
import { runRemove } from './remove-cmd.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

const VERSION = getVersion();
initTelemetry(VERSION);

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[38;5;102m';
const TEXT = '\x1b[38;5;145m';

const LOGO_LINES = [
  '███████╗██╗  ██╗██╗██╗     ██╗     ███████╗',
  '██╔════╝██║ ██╔╝██║██║     ██║     ██╔════╝',
  '███████╗█████╔╝ ██║██║     ██║     ███████╗',
  '╚════██║██╔═██╗ ██║██║     ██║     ╚════██║',
  '███████║██║  ██╗██║███████╗███████╗███████║',
  '╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚══════╝',
];

const GRAYS = [
  '\x1b[38;5;250m',
  '\x1b[38;5;248m',
  '\x1b[38;5;245m',
  '\x1b[38;5;243m',
  '\x1b[38;5;240m',
  '\x1b[38;5;238m',
];

function showLogo(): void {
  console.log();
  LOGO_LINES.forEach((line, i) => {
    console.log(`${GRAYS[i]}${line}${RESET}`);
  });
}

function showBanner(): void {
  showLogo();
  console.log();
  console.log(`${DIM}Agent skill package manager${RESET}`);
  console.log();
  console.log(
    `  ${DIM}$${RESET} ${TEXT}skilladd add ${DIM}<source>${RESET}        ${DIM}Add a skill from a git repo${RESET}`
  );
  console.log(
    `  ${DIM}$${RESET} ${TEXT}skilladd install${RESET}             ${DIM}Restore symlinks from skills.json${RESET}`
  );
  console.log(
    `  ${DIM}$${RESET} ${TEXT}skilladd update ${DIM}[name]${RESET}          ${DIM}Update skills to latest (default: all)${RESET}`
  );
  console.log(
    `  ${DIM}$${RESET} ${TEXT}skilladd remove ${DIM}<name>${RESET}       ${DIM}Remove an installed skill${RESET}`
  );
  console.log();
  console.log(`${DIM}try:${RESET} skilladd add git@git.woa.com:chong/chong-skills.git --skill iwiki-ultra -y`);
  console.log();
}

function showHelp(): void {
  console.log(`
${BOLD}Usage:${RESET} skilladd <command> [options]

${BOLD}Commands:${RESET}
  add <source>           Add a skill from a git repo or URL
  install                Restore symlinks from skills.json (no network)
  update [name]          Update installed skills to latest (default: all)
  remove <name>          Remove an installed skill

${BOLD}Add Options:${RESET}
  -g, --global           Install skill globally (user-level) instead of project-level
  -a, --agent <agents>   Specify agents to install to (use '*' for all agents)
  -s, --skill <skills>   Specify skill names to install (use '*' for all skills)
  -l, --list             List available skills in the repository without installing
  -y, --yes              Skip confirmation prompts
  --copy                 Copy files instead of symlinking to agent directories
  --all                  Shorthand for --skill '*' --agent '*' -y
  --full-depth           Search all subdirectories even when a root SKILL.md exists

${BOLD}Update Options:${RESET}
  --all                  Update all skills
  -y, --yes              Skip confirmation prompts

${BOLD}Supported Agents:${RESET}
  cursor, claude-code, codebuddy, codex

${BOLD}Options:${RESET}
  --help, -h        Show this help message
  --version, -v     Show version number

${BOLD}Examples:${RESET}
  ${DIM}$${RESET} skilladd add git@git.woa.com:chong/chong-skills.git --skill iwiki-ultra -y
  ${DIM}$${RESET} skilladd install
  ${DIM}$${RESET} skilladd update --all -y
  ${DIM}$${RESET} skilladd remove iwiki-ultra
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showBanner();
    return;
  }

  const command = args[0];
  const restArgs = args.slice(1);

  switch (command) {
    case 'a':
    case 'add': {
      showLogo();
      const { source: addSource, options: addOpts } = parseAddOptions(restArgs);
      await runAdd(addSource, addOpts);
      break;
    }
    case 'i':
    case 'install': {
      showLogo();
      const installYes = restArgs.includes('-y') || restArgs.includes('--yes');
      await runInstall({ yes: installYes });
      break;
    }
    case 'update':
    case 'up': {
      showLogo();
      const updateYes = restArgs.includes('-y') || restArgs.includes('--yes');
      const updateNames = restArgs.filter((a) => !a.startsWith('-'));
      const updateAll = restArgs.includes('--all') || updateNames.length === 0;
      await runUpdate(updateNames, { all: updateAll, yes: updateYes });
      break;
    }
    case 'remove':
    case 'rm': {
      showLogo();
      const removeYes = restArgs.includes('-y') || restArgs.includes('--yes');
      const removeNames = restArgs.filter((a) => !a.startsWith('-'));
      await runRemove(removeNames, { yes: removeYes });
      break;
    }
    case '--help':
    case '-h':
      showHelp();
      break;
    case '--version':
    case '-v':
      console.log(VERSION);
      break;
    default:
      console.log(`Unknown command: ${command}`);
      console.log(`Run ${BOLD}skilladd --help${RESET} for usage.`);
  }
}

main();
