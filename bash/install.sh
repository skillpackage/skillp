#!/bin/bash
set -euo pipefail

# skillp installer — ensures Node.js 22+ is available, then forwards all args to npx skillp.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/skillpackage/skillp/main/bash/install.sh | bash -s -- add git@github.com:owner/repo.git --skill my-skill
#   wget -qO- https://raw.githubusercontent.com/skillpackage/skillp/main/bash/install.sh | bash -s -- add git@github.com:owner/repo.git --skill my-skill

MIN_NODE_VERSION=22

get_node_major() {
    node --version 2>/dev/null | sed 's/^v//' | cut -d. -f1
}

if command -v node &> /dev/null; then
    NODE_MAJOR=$(get_node_major)
    if [ "$NODE_MAJOR" -ge "$MIN_NODE_VERSION" ]; then
        echo "Node.js v$(node --version | sed 's/^v//') detected."
    else
        echo "Node.js v$(node --version | sed 's/^v//') detected, but v${MIN_NODE_VERSION}+ is required."
        NEED_INSTALL=1
    fi
else
    echo "Node.js not found."
    NEED_INSTALL=1
fi

if [ "${NEED_INSTALL:-}" = "1" ]; then
    if command -v nvm &> /dev/null || [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
        echo "nvm found, installing Node.js ${MIN_NODE_VERSION}..."
        export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
        . "$NVM_DIR/nvm.sh"
    else
        echo "Installing nvm..."
        curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
        export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
        . "$NVM_DIR/nvm.sh"
    fi

    nvm install "$MIN_NODE_VERSION"
    nvm use "$MIN_NODE_VERSION"

    NODE_MAJOR=$(get_node_major)
    if [ "$NODE_MAJOR" -lt "$MIN_NODE_VERSION" ]; then
        echo "ERROR: Failed to install Node.js ${MIN_NODE_VERSION}+. Please install manually: https://nodejs.org"
        exit 1
    fi
    echo "Node.js v$(node --version | sed 's/^v//') ready."
fi

if [ -t 0 ]; then
    exec npx --yes skillp "$@"
else
    exec npx --yes skillp "$@" -y
fi
