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

- **Feature list**: `.claude/feature_list.json` — source of truth for all tasks (v2 schema)
- **Progress log**: `.claude/progress.txt` — append-only session history
- **Session IDs**: `.claude/session_ids.txt` — captured session IDs for resume
- **Prompts**: `.claude/prompts/initializer_prompt.md`, `.claude/prompts/coding_prompt.md`
- **Analytics**: `.claude/analyze-harness.py` — post-run metrics and recommendations
- **Harness script**: `harness.sh` — multi-session orchestrator

## Commands

### `/harness init`

Analyze the codebase and generate (or regenerate) `.claude/feature_list.json`:

1. Read CLAUDE.md, explore src/, check test coverage, review entity JSONs
2. Identify gaps: missing tests, performance issues, incomplete features, polish items
3. Generate feature_list.json with v2 schema (see below)
4. Initialize progress.txt

### `/harness status`

Show current progress:

1. Read `.claude/feature_list.json` and count completed vs remaining
2. Show breakdown by category, priority, and complexity
3. Show related task clusters (groups connected by `related_to`)
4. Show last 5 entries from `.claude/progress.txt`
5. Report any blocked or skipped tasks
6. Estimate remaining sessions based on complexity (S=0.3, M=0.5, L=1.0 sessions each)

### `/harness add <description>`

Add a new task to feature_list.json:

1. Parse the description from the argument
2. Ask user for category, priority, and complexity
3. Identify `target_files` by exploring the codebase
4. Set `test_file` if applicable
5. Find `related_to` IDs by checking for shared target_files with existing tasks
6. Generate typed verification steps
7. Append to feature_list.json with `"passes": false`

### `/harness analyze`

Run post-run analytics on the most recent harness sessions:

```bash
python3 .claude/analyze-harness.py
```

Or for a specific date: `python3 .claude/analyze-harness.py --date YYYY-MM-DD`

## feature_list.json Schema (v2)

```json
[
  {
    "id": 1,
    "category": "functional",
    "priority": "high",
    "complexity": "M",
    "description": "What needs to be done",
    "target_files": ["src/systems/Foo.ts", "src/data/Bar.ts"],
    "test_file": "src/__tests__/foo.test.ts",
    "related_to": [2, 3],
    "verification": [
      { "type": "source_contains", "file": "src/data/Bar.ts", "pattern": "EXPECTED" },
      { "type": "build_passes" },
      { "type": "all_tests_pass" }
    ],
    "passes": false
  }
]
```

### V2 Fields

| Field | Description |
|-------|-------------|
| `complexity` | `S` (1-2 files, <30min), `M` (2-5 files, 30-90min), `L` (5+ files, 90+min) |
| `target_files` | Key files to read before starting work (1-5 files) |
| `test_file` | Expected test file path, or null |
| `related_to` | IDs of tasks sharing files/features — batched in same session |

### Verification Types

| Type | Fields | Checks |
|------|--------|--------|
| `source_contains` | `file`, `pattern` | File contains pattern |
| `source_not_contains` | `file`, `pattern` | File does NOT contain pattern |
| `test_file_exists` | `file` | Test file exists |
| `test_passes` | `file` | Specific test file passes |
| `build_passes` | — | `npm run build` succeeds |
| `all_tests_pass` | — | `npm run test:run` passes |

## Running the Harness

The harness runs Claude Code headlessly in a loop:

```bash
# Default: 10 sessions, opus model
./harness.sh

# Initialize first, then run 5 sessions
./harness.sh --init --sessions 5

# Use sonnet for faster/cheaper iteration on S-complexity tasks
./harness.sh --model sonnet --sessions 20

# Continue the last session
./harness.sh --continue
```

After a run completes, analyze efficiency:

```bash
python3 .claude/analyze-harness.py --save
```

## Rules

- **NEVER** remove tasks from feature_list.json
- **NEVER** edit task descriptions to make them easier
- Only change `"passes"` from `false` to `true` after ALL verification steps pass
- New tasks must use v2 schema (all fields required)
- Progress.txt is append-only
