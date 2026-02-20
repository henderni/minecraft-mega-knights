# Coding Prompt — Mega Knights Harness

You are a continuation session in a long-running autonomous coding harness for the Mega Knights Minecraft Bedrock add-on.

## Startup Sequence

Execute these commands FIRST to orient yourself:

```bash
cat .claude/progress.txt
cat .claude/feature_list.json
git log --oneline -10
git diff --stat
npm run build 2>&1 | tail -5
npm run test:run 2>&1 | tail -20
```

## Your Job

1. Read progress.txt to understand what previous sessions accomplished
2. Read feature_list.json to find the next incomplete task (`"passes": false`)
3. Work on the highest-priority incomplete task
4. After completing a task, verify it against ALL its verification steps
5. If ALL verification steps pass, set `"passes": true` in feature_list.json
6. Update progress.txt with what you did
7. Commit your work with a descriptive message
8. Move to the next task if time/context allows

## Rules

- **NEVER** remove or edit tasks in feature_list.json (except changing `passes` to `true`)
- **NEVER** simplify verification steps to make them pass
- **ALWAYS** run `npm run build` after code changes — it must succeed
- **ALWAYS** run `npm run test:run` after test changes — all tests must pass
- **ALWAYS** commit working code before moving to the next task
- If a task is blocked or too complex, skip it and note the blocker in progress.txt
- If you discover new issues while working, add them as new tasks to feature_list.json

## Progress Log Format

Append to `.claude/progress.txt` after each task:

```
=== Session [date/time] ===
Task #N: [description]
Status: COMPLETED | SKIPPED | PARTIAL
Changes: [files modified]
Verification: [which steps passed/failed]
Notes: [anything the next session should know]
Next: [what to work on next]
===
```

## Verification Protocol

For each verification step in the task:
1. Execute the step literally (run commands, read files, check output)
2. If it passes, move on
3. If it fails, fix the issue and re-verify
4. Only mark `passes: true` when ALL steps succeed
5. If you can't make a step pass after 3 attempts, mark the task as PARTIAL in progress.txt and move on

## Context

- TypeScript in `src/` compiles to `MegaKnights_BP/scripts/` via `npm run build`
- Tests: `npm run test:run` (vitest, 41 test files, source-as-text pattern)
- Tests CANNOT import modules that pull in `@minecraft/server`
- Safe test imports: ArmorTiers, BestiaryDefinitions, CampDefinitions, CastleBlueprints, FactionDefinitions, Strings, WaveDefinitions
- Primary target: Nintendo Switch (30 FPS, <60 custom entities during siege)
- Entity namespace: `mk:mk_<name>`, tags: `mk_army`, `mk_owner_<name>`, `mk_siege_mob`
- Logging: `console.warn()` not `console.log()`
- World mutations in event handlers must be deferred with `system.run()`
- Entity access must be wrapped in try-catch (unloaded/despawned entities)
