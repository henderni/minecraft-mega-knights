---
name: harness
description: >
  Manage the autonomous coding harness — initialize tasks, check progress, or generate a feature list for long-running work.
user-invocable: true
argument-hint: "[init|status|add <description>]"
---

# Harness Management

You manage the autonomous coding harness for Mega Knights. The harness enables Claude Code to work across multiple sessions on a prioritized task list.

## File Locations

- **Feature list**: `.claude/feature_list.json` — source of truth for all tasks
- **Progress log**: `.claude/progress.txt` — append-only session history
- **Session IDs**: `.claude/session_ids.txt` — captured session IDs for resume
- **Prompts**: `.claude/prompts/initializer_prompt.md`, `.claude/prompts/coding_prompt.md`
- **Harness script**: `harness.sh` — multi-session orchestrator

## Commands

### `/harness init`

Analyze the codebase and generate (or regenerate) `.claude/feature_list.json`:

1. Read CLAUDE.md, explore src/, check test coverage, review entity JSONs
2. Identify gaps: missing tests, performance issues, incomplete features, polish items
3. Generate feature_list.json with prioritized tasks
4. Initialize progress.txt

### `/harness status`

Show current progress:

1. Read `.claude/feature_list.json` and count completed vs remaining
2. Show breakdown by category and priority
3. Show last 5 entries from `.claude/progress.txt`
4. Report any blocked or skipped tasks

### `/harness add <description>`

Add a new task to feature_list.json:

1. Parse the description from the argument
2. Ask user for category (functional/test/performance/content/polish) and priority
3. Generate verification steps
4. Append to feature_list.json with `"passes": false`

## feature_list.json Format

```json
[
  {
    "id": 1,
    "category": "functional",
    "priority": "high",
    "description": "What needs to be done",
    "verification": ["How to verify it's done"],
    "passes": false
  }
]
```

## Running the Harness

The harness runs Claude Code headlessly in a loop:

```bash
# Default: 10 sessions, opus model
./harness.sh

# Initialize first, then run 5 sessions
./harness.sh --init --sessions 5

# Use sonnet for faster/cheaper iteration
./harness.sh --model sonnet --sessions 20

# Continue the last session
./harness.sh --continue
```

## Rules

- **NEVER** remove tasks from feature_list.json
- **NEVER** edit task descriptions to make them easier
- Only change `"passes"` from `false` to `true` after ALL verification steps pass
- New tasks can be added at any time
- Progress.txt is append-only
