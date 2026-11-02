#!/bin/sh
# Mirrors this project into a backup folder on the Desktop. It is safe to run any time:
# it only copies files out of the project, and it skips downloaded or generated folders that
# can be recreated (node_modules, dist, test output). The .git folder IS copied, so the backup
# also keeps the full change history.
set -eu
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${CAMPUSOS_BACKUP_DIR:-$HOME/Desktop/CampusOS_Backup}"
mkdir -p "$DEST"
rsync -a --delete \
  --exclude 'node_modules/' --exclude 'dist/' --exclude 'test-results/' \
  --exclude 'playwright-report/' --exclude '.DS_Store' --exclude '.vercel/' \
  "$SRC/" "$DEST/"
date '+Last backup: %Y-%m-%d %H:%M:%S' > "$DEST/BACKUP_INFO.txt"
echo "Backed up to $DEST"
