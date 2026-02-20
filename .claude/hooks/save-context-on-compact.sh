#!/bin/bash

# Auto-save context summary before compaction
# Triggered by PreCompact hook — saves a lightweight breadcrumb

MEMORY_DIR="$HOME/.claude/projects/-Users-nick-Repos-minecraft-mega-knights/memory/contexts"
mkdir -p "$MEMORY_DIR"

TIMESTAMP=$(date +"%Y-%m-%d-%H%M")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
LAST_COMMIT=$(git log --oneline -1 2>/dev/null || echo "unknown")
CHANGED_FILES=$(git diff --name-only 2>/dev/null | head -20)

cat > "$MEMORY_DIR/${TIMESTAMP}-auto-compact.md" << EOF
# Auto-saved Context (Pre-Compaction)
**Saved:** $(date)
**Branch:** $BRANCH
**Last commit:** $LAST_COMMIT

## Files with uncommitted changes
$CHANGED_FILES

## Note
This was auto-saved before context compaction. Use \`/load-context\` to review.
For full session history, check the conversation transcript.
EOF

# Keep only the 10 most recent auto-compact files
ls -t "$MEMORY_DIR"/*auto-compact.md 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null

exit 0
