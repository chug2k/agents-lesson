#!/bin/bash
# Prints the env vars to paste into claude.ai/code -> environment settings
# (cloud icon -> your environment -> settings -> "Environment variables" field).
# Output is .env format, one KEY=value per line, ready to paste as-is.
#
# SECRETS ARE PRINTED TO YOUR TERMINAL IN THE CLEAR. Run it yourself, paste,
# then clear your terminal. Do not commit this output or pipe it anywhere.
set -euo pipefail

ENV_FILE="$(cd "$(dirname "$0")" && pwd)/.env"

grep -E '^LITELLM_' "$ENV_FILE"
echo "GITHUB_TOKEN=$(gh auth token)"
