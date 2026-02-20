#!/bin/bash

# Re-inject context after compaction
# Triggered by SessionStart hook with "compact" matcher
# Outputs context to stdout — Claude receives it as system context

MEMORY_DIR="$HOME/.claude/projects/-Users-nick-Repos-minecraft-mega-knights/memory/contexts"
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." && pwd )"

cd "$PROJECT_DIR" 2>/dev/null

echo "=== POST-COMPACTION CONTEXT RECOVERY ==="
echo ""

# 1. Current git state
echo "## Git State"
echo "Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
echo "Last 3 commits:"
git log --oneline -3 2>/dev/null || echo "  (unable to read git log)"
echo ""

# 2. Uncommitted changes
DIFF_STAT=$(git diff --stat 2>/dev/null)
STAGED_STAT=$(git diff --cached --stat 2>/dev/null)
if [ -n "$DIFF_STAT" ] || [ -n "$STAGED_STAT" ]; then
  echo "## Uncommitted Changes"
  if [ -n "$STAGED_STAT" ]; then
    echo "Staged:"
    echo "$STAGED_STAT"
  fi
  if [ -n "$DIFF_STAT" ]; then
    echo "Unstaged:"
    echo "$DIFF_STAT"
  fi
  echo ""
fi

# 3. Latest auto-compact backup (if exists)
LATEST_BACKUP=$(ls -t "$MEMORY_DIR"/*auto-compact.md 2>/dev/null | head -1)
if [ -n "$LATEST_BACKUP" ]; then
  echo "## Latest Context Backup"
  cat "$LATEST_BACKUP"
  echo ""
fi

# 4. Task list reminder
echo "## Reminders"
echo "- Run TaskList to check for in-progress tasks from before compaction"
echo "- Key project files: src/systems/, src/data/, MegaKnights_BP/entities/"
echo "- Build: npm run build | Test: npm run test:run | Lint: npm run lint"
echo "=== END CONTEXT RECOVERY ==="
