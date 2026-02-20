#!/bin/bash
# harness.sh — Mega Knights autonomous coding harness
#
# Runs Claude Code in headless mode across multiple sessions,
# tracking progress via feature_list.json and progress.txt.
#
# Usage:
#   ./harness.sh                    # Run with defaults (10 sessions, $5/session)
#   ./harness.sh --sessions 20      # Up to 20 sessions
#   ./harness.sh --budget 10        # $10 per session cap
#   ./harness.sh --init             # Run initializer first (generates feature_list.json)
#   ./harness.sh --model opus       # Use specific model (opus, sonnet, haiku)
#   ./harness.sh --continue         # Continue last session instead of starting fresh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FEATURE_FILE="$PROJECT_DIR/.claude/feature_list.json"
PROGRESS_FILE="$PROJECT_DIR/.claude/progress.txt"
SESSION_LOG="$PROJECT_DIR/.claude/session_ids.txt"
PROMPTS_DIR="$PROJECT_DIR/.claude/prompts"

# Defaults
MAX_SESSIONS=10
BUDGET_PER_SESSION=5
MODEL="opus"
FORCE_INIT=false
CONTINUE_LAST=false
MAX_TURNS=80

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --sessions) MAX_SESSIONS="$2"; shift 2 ;;
        --budget)   BUDGET_PER_SESSION="$2"; shift 2 ;;
        --model)    MODEL="$2"; shift 2 ;;
        --init)     FORCE_INIT=true; shift ;;
        --continue) CONTINUE_LAST=true; shift ;;
        --turns)    MAX_TURNS="$2"; shift 2 ;;
        --help|-h)
            echo "Usage: ./harness.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --sessions N    Max sessions to run (default: 10)"
            echo "  --budget N      USD budget per session (default: 5)"
            echo "  --model NAME    Model: opus, sonnet, haiku (default: opus)"
            echo "  --init          Force run initializer (regenerate feature_list.json)"
            echo "  --continue      Continue last session instead of starting fresh"
            echo "  --turns N       Max agentic turns per session (default: 80)"
            echo "  -h, --help      Show this help"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[harness]${NC} $1"; }
success() { echo -e "${GREEN}[harness]${NC} $1"; }
warn() { echo -e "${YELLOW}[harness]${NC} $1"; }
error() { echo -e "${RED}[harness]${NC} $1"; }

# Ensure we're in the project directory
cd "$PROJECT_DIR"

# Check claude is available
if ! command -v claude &> /dev/null; then
    error "claude CLI not found. Install it first: https://code.claude.com"
    exit 1
fi

# Allowed tools for headless mode
ALLOWED_TOOLS=(
    "Bash(npm *)"
    "Bash(npx *)"
    "Bash(git add *)"
    "Bash(git commit *)"
    "Bash(git log *)"
    "Bash(git diff *)"
    "Bash(git status *)"
    "Bash(cat *)"
    "Bash(ls *)"
    "Bash(mkdir *)"
    "Read"
    "Edit"
    "Write"
    "Glob"
    "Grep"
    "Task"
)

# Build --allowedTools arguments
TOOLS_ARGS=()
for tool in "${ALLOWED_TOOLS[@]}"; do
    TOOLS_ARGS+=(--allowedTools "$tool")
done

# Determine if we need to initialize
NEED_INIT=false
if [ "$FORCE_INIT" = true ] || [ ! -f "$FEATURE_FILE" ]; then
    NEED_INIT=true
fi

# Initialize if needed
if [ "$NEED_INIT" = true ]; then
    log "Running initializer session..."
    log "This will analyze the project and generate feature_list.json"
    echo ""

    INIT_PROMPT=$(cat "$PROMPTS_DIR/initializer_prompt.md")

    INIT_OUTPUT=$(claude -p "$INIT_PROMPT" \
        "${TOOLS_ARGS[@]}" \
        --model "$MODEL" \
        --max-turns "$MAX_TURNS" \
        --output-format json 2>&1) || true

    INIT_SESSION=$(echo "$INIT_OUTPUT" | jq -r '.session_id // empty' 2>/dev/null || echo "unknown")
    echo "init:$INIT_SESSION:$(date -Iseconds)" >> "$SESSION_LOG"

    if [ ! -f "$FEATURE_FILE" ]; then
        error "Initializer did not create feature_list.json. Check session output."
        exit 1
    fi

    TOTAL=$(jq length "$FEATURE_FILE")
    success "Initializer complete. Created $TOTAL tasks."
    echo ""
fi

# Continue last session if requested
if [ "$CONTINUE_LAST" = true ]; then
    log "Continuing last session..."
    CONTINUE_OUTPUT=$(claude --continue -p "$(cat "$PROMPTS_DIR/coding_prompt.md")" \
        "${TOOLS_ARGS[@]}" \
        --model "$MODEL" \
        --max-turns "$MAX_TURNS" \
        --output-format json 2>&1) || true

    SESSION_ID=$(echo "$CONTINUE_OUTPUT" | jq -r '.session_id // empty' 2>/dev/null || echo "unknown")
    echo "continue:$SESSION_ID:$(date -Iseconds)" >> "$SESSION_LOG"
    success "Continue session complete: $SESSION_ID"
    exit 0
fi

# Main coding loop
for i in $(seq 1 "$MAX_SESSIONS"); do
    echo ""
    log "━━━ Session $i of $MAX_SESSIONS ━━━"

    # Show current progress
    if [ -f "$FEATURE_FILE" ]; then
        TOTAL=$(jq length "$FEATURE_FILE")
        DONE=$(jq '[.[] | select(.passes == true)] | length' "$FEATURE_FILE")
        REMAINING=$((TOTAL - DONE))
        log "Progress: $DONE/$TOTAL complete ($REMAINING remaining)"

        if [ "$REMAINING" -eq 0 ]; then
            success "All tasks complete!"
            break
        fi
    fi

    # Run coding session
    CODING_PROMPT=$(cat "$PROMPTS_DIR/coding_prompt.md")

    SESSION_OUTPUT=$(claude -p "$CODING_PROMPT" \
        "${TOOLS_ARGS[@]}" \
        --model "$MODEL" \
        --max-turns "$MAX_TURNS" \
        --output-format json 2>&1) || true

    SESSION_ID=$(echo "$SESSION_OUTPUT" | jq -r '.session_id // empty' 2>/dev/null || echo "unknown")
    echo "coding:$SESSION_ID:$(date -Iseconds)" >> "$SESSION_LOG"

    # Post-session status
    if [ -f "$FEATURE_FILE" ]; then
        NEW_DONE=$(jq '[.[] | select(.passes == true)] | length' "$FEATURE_FILE")
        NEW_TOTAL=$(jq length "$FEATURE_FILE")
        NEW_REMAINING=$((NEW_TOTAL - NEW_DONE))

        if [ "${DONE:-0}" -ne "$NEW_DONE" ]; then
            COMPLETED_THIS=$((NEW_DONE - ${DONE:-0}))
            success "Session $i completed $COMPLETED_THIS task(s). Progress: $NEW_DONE/$NEW_TOTAL"
        else
            warn "Session $i made no task completions. Check progress.txt for details."
        fi

        if [ "$NEW_REMAINING" -eq 0 ]; then
            success "All tasks complete!"
            break
        fi
    fi

    # Brief pause between sessions
    if [ "$i" -lt "$MAX_SESSIONS" ]; then
        log "Next session in 5 seconds... (Ctrl+C to stop)"
        sleep 5
    fi
done

echo ""
log "━━━ Harness Complete ━━━"
if [ -f "$FEATURE_FILE" ]; then
    FINAL_DONE=$(jq '[.[] | select(.passes == true)] | length' "$FEATURE_FILE")
    FINAL_TOTAL=$(jq length "$FEATURE_FILE")
    log "Final progress: $FINAL_DONE/$FINAL_TOTAL tasks complete"
fi
log "Session log: $SESSION_LOG"
log "Progress log: $PROGRESS_FILE"
