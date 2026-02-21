# QA Agent Memory

## Suite Baseline (as of 2026-02-21)
- 76 test files, 2942 tests, all passing.

## Test File Status
- `src/__tests__/quest-journal.test.ts` — 32 tests, all pass. Source-as-text for QuestJournalSystem.ts + Strings.ts.
- `src/__tests__/difficulty-system.test.ts` — 19 tests, all pass. Source-as-text for DifficultySystem.ts.
- `src/__tests__/friendly-fire.test.ts` — 13 tests, all pass. Source-as-text for main.ts friendly fire block.
- `src/__tests__/camp-cleared-guard.test.ts` — 9 tests, all pass. Source-as-text for EnemyCampSystem.ts.
- `src/__tests__/siege-cleanup.test.ts` — 12 tests, all pass. Source-as-text for SiegeSystem.ts.
- `src/__tests__/tier-names-shared.test.ts` — 9 tests, all pass. Direct import of TIER_NAMES + source-as-text for system files.
- `src/__tests__/reset-entity-cleanup.test.ts` — 27 tests, all pass. Verifies mk:reset handler clears game state (siege, difficulty, camps, entities by tag, player properties).
- `src/__tests__/boss-phase-consistency.test.ts` — 47 tests, all pass. JSON validation for mk_boss_siege_lord.se.json: phase escalation (damage/speed/range), scan_interval, must_see, persistence, phase event wiring, GPU budget (should_darken_sky: false).
- `src/__tests__/recipe-uniqueness.test.ts` — 91 tests, all pass. JSON validation for MegaKnights_BP/recipes/: valid JSON, format_version, no duplicate shapeless ingredient fingerprints, regression guards for gatehouse=cobblestone and small_tower=stone differentiation, knight_token=iron_ingot identity.
- `src/__tests__/siege-system.test.ts` — 87 tests, all pass. Source-as-text for SiegeSystem.ts: Switch-safety constants, interval constants, WAVE_DEFINITIONS data, checkBossPhase HP thresholds and guards, staggeredSpawn generator pattern + siegeActive guard inside generator body, victory/defeat message ordering, endless mode message paths, lifecycle guards.
- `src/__tests__/entity-validation.test.ts` — 291 tests, all pass. Added hurt_by_target entity_types tests: ally entities restrict retaliation to mk_enemy, enemy/boss entities restrict to player+mk_ally, boss-specific priority=1 check.

## Bugs Found and Fixed
- `quest-journal.test.ts` line 97 had `for (let i = 0; i <= 5)` — missing `i++` increment. Fix: `for (let i = 0; i <= 5; i++)`.
- `mk_blueprint_small_tower.json` and `mk_blueprint_gatehouse.json` both had 3x cobblestone + paper (Bedrock shadowing bug). Fixed by changing small_tower to use 3x `minecraft:stone` instead. The progression is now: small_tower=stone, gatehouse=cobblestone, great_hall=gold_ingot.

## Source-as-Text Patterns That Work Well

### Counting method calls
```typescript
const buttonMatches = src.match(/\.button\(/g);
expect(buttonMatches!.length).toBe(6);
```

### Checking for-of loops
```typescript
expect(src).toMatch(/for\s*\(\s*const\s+entry\s+of\s+BESTIARY\s*\)/);
```

### Checking constructor signatures with multiline regex
```typescript
expect(src).toMatch(/constructor\s*\(\s*dayCounter.*difficulty/s);  // 's' flag = dotall
```

### Checking cache guard pattern
```typescript
expect(src).toMatch(/if\s*\(\s*this\.cachedDifficulty\s*!==\s*null/);
```

### Extracting numeric values from a block
```typescript
const block = src.match(/RECRUIT_CHANCES[^}]+}/s);
const values = block![0].match(/:\s*(0\.\d+)/g);
// then parseFloat each to validate range
```

## Pitfall: Comment Text Shadows Call Site in indexOf Ordering Tests
When a comment says "// ... uses system.runJob" and the actual call `system.runJob(` comes later, `indexOf("system.runJob")` finds the comment first. Always search for the call site with its trailing `(`:
```typescript
const runJobIdx = block.indexOf("system.runJob("); // not "system.runJob"
```

## Pitfall: Regex Block Extraction for Ordering Tests
When checking that statement A appears before statement B within a method, DO NOT try to extract the method body with a regex (nested braces break simple regex). Instead use `String.indexOf()` on the full source:
```typescript
const callPos = SRC.indexOf("this.cleanupSiegeMobs()");
const branchPos = SRC.indexOf("if (wasEndless)");
expect(callPos).toBeLessThan(branchPos);
```
This works when the method appears before other methods that share similar tokens.

## Key Facts About Systems Tested

### QuestJournalSystem.ts
- Constructor: `(dayCounter: DayCounterSystem, difficulty: DifficultySystem)`
- Uses `this.dayCounter.getCurrentDay()` — never reads `mk:current_day` directly
- Uses `this.difficulty.getRecruitChance()` and multiplies by 100 for `pct`
- 5 base TOC buttons + 1 conditional endless button = 6 total `.button()` calls
- Switch has cases 0-5; case 5 is guarded by `if (endless)`
- `JOURNAL_OVERVIEW_BODY` and `JOURNAL_ARMY_BODY` are functions taking `recruitPct: number`
- Iterates `BESTIARY` via `for (const entry of BESTIARY)`
- Reads kill count via `player.getDynamicProperty(entry.killKey)`

### DifficultySystem.ts
- `DIFFICULTY_NORMAL = 0`, `DIFFICULTY_HARD = 1` (both exported)
- `RECRUIT_CHANCES`: normal=0.3, hard=0.2
- `ENEMY_MULTIPLIERS`: normal=1.0, hard=1.5
- Dynamic property key: `"mk:difficulty"` (via `private static readonly KEY`)
- Cache field: `private cachedDifficulty: number | null = null`
- `reset()` sets `cachedDifficulty = null` and calls `setDynamicProperty(KEY, undefined)`
- Public API: `getDifficulty()`, `getRecruitChance()`, `getEnemyMultiplier()`, `getDifficultyName()`, `showDifficultySelect()`
