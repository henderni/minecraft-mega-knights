# Coding Prompt — Mega Knights Harness (v2)

You are a continuation session in a long-running autonomous coding harness for the Mega Knights Minecraft Bedrock add-on.

## Startup Sequence

Execute these steps FIRST to orient yourself:

1. Read `.claude/progress.txt` — understand what previous sessions accomplished
2. Read `.claude/feature_list.json` — find incomplete tasks (`"passes": false`)
3. Run quick health checks:
```bash
git log --oneline -5
git diff --stat
npm run build 2>&1 | tail -5
npm run test:run 2>&1 | tail -20
```

## Task Selection

Pick your next task using this priority order:

1. **Priority first**: `high` before `medium` before `low`
2. **Related tasks together**: If the task you're about to start has `related_to` IDs that are also incomplete, consider doing them in the same session — they share files and context
3. **Complexity budget**: Aim for a session workload of roughly:
   - 3-4 `S` tasks, OR
   - 2-3 `M` tasks, OR
   - 1 `L` task (possibly with 1 `S` task)
   - Mixed: e.g., 1 `M` + 2 `S`, or 2 `M` + 1 `S`
4. **Don't overcommit**: If you've completed your complexity budget, commit and stop cleanly rather than starting a task you can't finish

## Working on a Task

For each task:

1. **Pre-read target files**: Read every file in the task's `target_files` array before making changes. This gives you the full context upfront and avoids wasted exploration.
2. **If `test_file` is set**: Read that test file too (it may already exist with patterns to follow, or you need to create it).
3. **Do the work**: Implement the change described in `description`.
4. **Verify**: Run the typed verification steps (see Verification Protocol below).
5. **Mark complete**: Set `"passes": true` in feature_list.json.
6. **Log progress**: Append to progress.txt.
7. **Commit**: Commit working code before moving to the next task.

## Verification Protocol

Each task has typed verification objects. Execute them as follows:

| Type | How to verify |
|------|--------------|
| `source_contains` | Read `file`, confirm it contains `pattern` |
| `source_not_contains` | Read `file`, confirm it does NOT contain `pattern` |
| `test_file_exists` | Confirm `file` exists (use Glob or Read) |
| `test_passes` | Run `npx vitest run <file>` and confirm it passes |
| `build_passes` | Run `npm run build` and confirm clean output |
| `all_tests_pass` | Run `npm run test:run` and confirm all tests pass |

**Verification rules:**
- Execute every verification step in the task's array
- If a step fails, fix the issue and re-verify
- Only mark `passes: true` when ALL steps succeed
- If you can't make a step pass after 3 attempts, mark the task as PARTIAL in progress.txt and move on

## Rules

- **NEVER** remove or edit tasks in feature_list.json (except changing `passes` to `true`)
- **NEVER** simplify verification steps to make them pass
- **ALWAYS** run `npm run build` after code changes — it must succeed
- **ALWAYS** run `npm run test:run` after test changes — all tests must pass
- **ALWAYS** commit working code before moving to the next task
- If a task is blocked or too complex, skip it and note the blocker in progress.txt
- If you discover new issues while working, add them as new tasks to feature_list.json (using the v2 schema with all fields)

## Progress Log Format

Append to `.claude/progress.txt` after each task:

```
=== Session [date/time] ===
Task #N: [short description]
Complexity: S|M|L
Status: COMPLETED | SKIPPED | PARTIAL
Changes: [files modified]
Verification: [pass/fail for each typed step]
Notes: [anything the next session should know]
Next: [what to work on next, including related_to suggestions]
===
```

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
