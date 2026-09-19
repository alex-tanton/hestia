#!/usr/bin/env bash
# Called by .github/workflows/deploy.yml on the self-hosted runner. The real deploy
# (build, backup, migrate, health-gated restart with rollback) is written in a later unit;
# until then this refuses, so nothing can deploy by accident.
set -euo pipefail
echo "scripts/deploy.sh: not implemented" >&2
exit 1
