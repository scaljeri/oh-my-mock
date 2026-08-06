#!/usr/bin/env bash
set -euo pipefail

echo "It is time to publish!!!"

echo -n "Are migrations up2date? "
read -r migration

# Quoted, because an empty answer (plain Enter) otherwise expands to
# `[ != "yes" ]` — a syntax error, not a "no".
if [ "$migration" != "yes" ]; then
    exit 0
fi

# npm, not yarn: the lockfile is package-lock.json, so a yarn invocation here
# ran with whatever yarn happened to resolve — not what CI installs.
npm run bundle:zip
