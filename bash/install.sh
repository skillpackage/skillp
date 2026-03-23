#!/bin/bash
set -euo pipefail

# skillp installer — ensures bun is available, then forwards all args to bunx skillp.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/skillpackage/skillp/main/bash/install.sh | bash -s -- add git@github.com:owner/repo.git --skill my-skill
#   wget -qO- https://raw.githubusercontent.com/skillpackage/skillp/main/bash/install.sh | bash -s -- add git@github.com:owner/repo.git --skill my-skill

if ! command -v bun &> /dev/null; then
    echo "bun not found, installing..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
    export PATH="$BUN_INSTALL/bin:$PATH"

    if ! command -v bun &> /dev/null; then
        echo "ERROR: Failed to install bun. Please install manually: https://bun.sh"
        exit 1
    fi
    echo "bun installed successfully."
fi

if [ -t 0 ]; then
    exec bunx skillp "$@"
else
    exec bunx skillp "$@" < /dev/tty
fi
