# Initializer Prompt — Mega Knights Harness

You are setting up a long-running autonomous coding session for the Mega Knights Minecraft Bedrock add-on.

## Your Job

1. Read the project specification (CLAUDE.md at the project root)
2. Explore the current codebase state (`git log --oneline -20`, `git diff --stat`, key source files)
3. Read any existing `.claude/progress.txt` to understand what's been done
4. Generate or update `.claude/feature_list.json` with a prioritized list of tasks

## feature_list.json Format

Create a JSON array of task objects. Each task has:

```json
[
  {
    "id": 1,
    "category": "functional|test|performance|content|polish",
    "priority": "high|medium|low",
    "description": "Clear, specific description of what needs to be done",
    "verification": [
      "Step 1: How to verify this is complete",
      "Step 2: Additional verification",
      "npm run build succeeds",
      "npm run test:run passes"
    ],
    "passes": false
  }
]
```

## Rules

- **NEVER** remove or edit existing tasks that have `"passes": true` — completed work must be preserved
- **NEVER** simplify task descriptions to make them easier to pass
- You MAY add new tasks discovered during exploration
- You MAY reorder tasks by priority
- Each task must have concrete, verifiable completion criteria
- Include `npm run build` and/or `npm run test:run` in verification steps where applicable
- Category guide:
  - `functional` — new features, bug fixes, game mechanics
  - `test` — new vitest tests, test coverage improvements
  - `performance` — Switch optimization, entity budget, hot path fixes
  - `content` — new entities, items, textures, recipes, localization
  - `polish` — UX improvements, HUD text, sound effects, visual feedback

## Priority Guide

- **high** — Bugs, missing core functionality, broken builds/tests
- **medium** — Test coverage gaps, performance improvements, balance tuning
- **low** — Polish, nice-to-have features, documentation

## After Generating

1. Write the feature_list.json file
2. Initialize `.claude/progress.txt` with a session header:
   ```
   === Initializer Session — [date] ===
   Generated feature_list.json with N tasks (H high, M medium, L low priority)
   Categories: X functional, Y test, Z performance, ...
   Next: Start with highest-priority tasks
   ===
   ```
3. Commit both files with message: "Initialize harness feature list and progress tracking"
4. Report what you found and what's prioritized

## Context

- TypeScript in `src/` compiles to `MegaKnights_BP/scripts/` via `npm run build`
- Tests: `npm run test:run` (vitest, source-as-text pattern — cannot import @minecraft/server)
- Primary target: Nintendo Switch (30 FPS, <60 custom entities during siege)
- Entity namespace: `mk:mk_<name>`, tags: `mk_army`, `mk_owner_<name>`, `mk_siege_mob`
