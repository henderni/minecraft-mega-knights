#!/bin/bash
# .claude/hooks/progress-save.sh
# Stop hook: saves session progress and optionally forces continuation
# when feature_list.json has remaining tasks.
#
# Reads JSON from stdin with session_id, stop_hook_active, last_assistant_message.
# Outputs JSON to stdout to control stop/continue behavior.

set -euo pipefail

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
CWD=$(echo "$INPUT" | jq -r '.cwd // "."')

FEATURE_FILE="$CWD/.claude/feature_list.json"
PROGRESS_FILE="$CWD/.claude/progress.txt"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Always save a progress checkpoint
{
    echo ""
    echo "--- checkpoint $SESSION_ID @ $TIMESTAMP ---"
    if [ -f "$FEATURE_FILE" ]; then
        TOTAL=$(jq 'length' "$FEATURE_FILE" 2>/dev/null || echo "?")
        DONE=$(jq '[.[] | select(.passes == true)] | length' "$FEATURE_FILE" 2>/dev/null || echo "?")
        echo "Progress: $DONE/$TOTAL tasks complete"
    fi
    echo "---"
} >> "$PROGRESS_FILE" 2>/dev/null || true

# If no feature file, allow stop (not in harness mode)
if [ ! -f "$FEATURE_FILE" ]; then
    exit 0
fi

# Count remaining tasks
REMAINING=$(jq '[.[] | select(.passes == false)] | length' "$FEATURE_FILE" 2>/dev/null || echo "0")
TOTAL=$(jq 'length' "$FEATURE_FILE" 2>/dev/null || echo "0")
DONE=$((TOTAL - REMAINING))

# If already in a stop-hook continuation, don't force another one
# (prevents infinite loops)
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
    exit 0
fi

# If there are remaining tasks, nudge Claude to keep going
if [ "$REMAINING" -gt 0 ]; then
    # Find the next highest-priority incomplete task
    NEXT_TASK=$(jq -r '[.[] | select(.passes == false)] | sort_by(
        if .priority == "high" then 0
        elif .priority == "medium" then 1
        else 2 end
    ) | .[0].description // "next incomplete task"' "$FEATURE_FILE" 2>/dev/null || echo "next task")

    jq -n \
        --arg reason "Progress: $DONE/$TOTAL tasks complete. $REMAINING tasks remaining. Next: $NEXT_TASK. Keep working — read .claude/feature_list.json for the full list." \
        '{"decision": "block", "reason": $reason}'
    exit 0
fi

# All tasks complete — allow stop
exit 0
