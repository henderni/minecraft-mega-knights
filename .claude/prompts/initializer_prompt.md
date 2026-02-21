# Initializer Prompt — Mega Knights Harness (v2)

You are setting up a long-running autonomous coding session for the Mega Knights Minecraft Bedrock add-on.

## Your Job

1. Read the project specification (CLAUDE.md at the project root)
2. Explore the current codebase state (`git log --oneline -20`, `git diff --stat`, key source files)
3. Read any existing `.claude/progress.txt` to understand what's been done
4. Generate or update `.claude/feature_list.json` with a prioritized list of tasks

## feature_list.json Schema (v2)

Create a JSON array of task objects. Each task has:

```json
[
  {
    "id": 1,
    "category": "functional|test|performance|content|polish",
    "priority": "high|medium|low",
    "complexity": "S|M|L",
    "description": "Clear, specific description of what needs to be done",
    "target_files": [
      "src/systems/SomeSystem.ts",
      "src/data/SomeData.ts"
    ],
    "test_file": "src/__tests__/some.test.ts",
    "related_to": [2, 5],
    "verification": [
      { "type": "source_contains", "file": "src/data/Foo.ts", "pattern": "EXPECTED_CONSTANT" },
      { "type": "source_not_contains", "file": "src/systems/Bar.ts", "pattern": "REMOVED_PATTERN" },
      { "type": "test_file_exists", "file": "src/__tests__/foo.test.ts" },
      { "type": "test_passes", "file": "src/__tests__/foo.test.ts" },
      { "type": "build_passes" },
      { "type": "all_tests_pass" }
    ],
    "passes": false
  }
]
```

### Field Definitions

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Unique integer, sequential |
| `category` | yes | One of: `functional`, `test`, `performance`, `content`, `polish` |
| `priority` | yes | `high` (bugs, broken), `medium` (coverage, balance), `low` (polish, nice-to-have) |
| `complexity` | yes | `S` (< 30 min, 1-2 files), `M` (30-90 min, 2-5 files), `L` (90+ min, 5+ files or architectural) |
| `description` | yes | Specific, actionable description of the work |
| `target_files` | yes | Files that need to be read or modified. List the key files the coding session should open first. |
| `test_file` | no | Expected test file path (null if task is not test-related) |
| `related_to` | yes | Array of task IDs that are closely related (shared files, same feature area). Empty array if none. |
| `verification` | yes | Array of typed verification objects (see below) |
| `passes` | yes | `false` initially, `true` only after all verification steps pass |

### Verification Types

| Type | Fields | What It Checks |
|------|--------|---------------|
| `source_contains` | `file`, `pattern` | File contains the string/pattern |
| `source_not_contains` | `file`, `pattern` | File does NOT contain the string/pattern |
| `test_file_exists` | `file` | Test file exists at path |
| `test_passes` | `file` | Specific test file passes |
| `build_passes` | — | `npm run build` succeeds |
| `all_tests_pass` | — | `npm run test:run` passes |

### Complexity Guide

- **S (Small)**: Single concern, 1-2 files. Config fix, add a string constant, tweak a threshold. Can batch 3-4 per session.
- **M (Medium)**: Cross-file change, 2-5 files. New test suite, extend a system, add an entity with all assets. 2-3 per session.
- **L (Large)**: Architectural, 5+ files or requires deep exploration. New system, refactor existing system, complex bug investigation. 1 per session max.

### Grouping Related Tasks

Use `related_to` to link tasks that share files or feature areas. The coding prompt uses this to batch related work into the same session, reducing context rebuilding and file re-reads.

Good candidates for grouping:
- Tasks that modify the same system file
- A functional task and its corresponding test task
- Multiple tasks in the same feature area (e.g., endless mode fixes)

## Rules

- **NEVER** remove or edit existing tasks that have `"passes": true` — completed work must be preserved
- **NEVER** simplify task descriptions to make them easier to pass
- You MAY add new tasks discovered during exploration
- You MAY reorder tasks by priority
- Each task must have concrete, typed verification steps
- Always include `build_passes` and/or `all_tests_pass` in verification
- `target_files` should list 1-5 key files — don't list every file that might be touched, just the ones the agent should read first
- Category guide:
  - `functional` — new features, bug fixes, game mechanics
  - `test` — new vitest tests, test coverage improvements
  - `performance` — Switch optimization, entity budget, hot path fixes
  - `content` — new entities, items, textures, recipes, localization
  - `polish` — UX improvements, HUD text, sound effects, visual feedback

## After Generating

1. Write the feature_list.json file
2. Initialize `.claude/progress.txt` with a session header:
   ```
   === Initializer Session — [date] ===
   Generated feature_list.json with N tasks (H high, M medium, L low priority)
   Complexity: X small, Y medium, Z large
   Categories: A functional, B test, C performance, ...
   Related task clusters: [list groups of related IDs]
   Next: Start with highest-priority tasks
   ===
   ```
3. Commit both files with message: "Initialize harness feature list and progress tracking"
4. Report what you found and what's prioritized

## Context

- TypeScript in `src/` compiles to `MegaKnights_BP/scripts/` via `npm run build`
- Tests: `npm run test:run` (vitest, source-as-text pattern)
- Tests CANNOT import modules that pull in `@minecraft/server`
- Safe test imports: ArmorTiers, BestiaryDefinitions, CampDefinitions, CastleBlueprints, FactionDefinitions, Strings, WaveDefinitions
- Primary target: Nintendo Switch (30 FPS, <60 custom entities during siege)
- Entity namespace: `mk:mk_<name>`, tags: `mk_army`, `mk_owner_<name>`, `mk_siege_mob`
- Logging: `console.warn()` not `console.log()`
- World mutations in event handlers must be deferred with `system.run()`
- Entity access must be wrapped in try-catch (unloaded/despawned entities)
