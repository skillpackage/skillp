#!/bin/bash
set -euo pipefail

# skilladd installer — ensures bun is available, then forwards all args to bunx skilladd.
#
# Usage:
#   wget -qO- https://skills.example.com/install.sh | bash -s -- add git@git.woa.com:chong/chong-skills.git --skill iwiki-ultra
#   curl -fsSL https://skills.example.com/install.sh | bash -s -- add git@git.woa.com:chong/chong-skills.git --skill iwiki-ultra

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

exec bunx skilladd "$@"
