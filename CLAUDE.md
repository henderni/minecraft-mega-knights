# Mega Knights — Bedrock Add-on

## Performance Target

**Primary goal: smooth 30 FPS on Nintendo Switch and low-end Bedrock devices.**

The Switch has a Tegra X1 (ARM), 4 GB shared RAM, and a Maxwell GPU. Every code and content change must be evaluated against these constraints:

- **Entity budget**: Keep total custom entities under 40 during normal play, under 60 during siege. Switch pathfinding degrades severely above ~40 custom AI entities.
- **Pathfinding cost**: `follow_range` and `nearest_attackable_target.max_dist` are the biggest CPU costs. Keep values as low as gameplay allows (16 for basic mobs, 24 max for elites).
- **Script hot paths**: Anything in `runInterval` callbacks (HUD, tick, army recount) must minimize allocations, dynamic property reads, and `getAllPlayers()`/`getEntities()` calls. Cache aggressively.
- **GPU budget**: Avoid alpha-test materials when opaque works. Minimize always-visible nametags. No `should_darken_sky` during high entity count scenes.
- **Spawn density**: All spawn rules must have `minecraft:density_limit`. Keep combined spawn weights low to avoid crowding the monster pool.

## Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TS → MegaKnights_BP/scripts/
npm run watch        # Watch mode
npm run deploy       # Build + rsync to BDS (requires $BDS_DIR env var)
npm run test:run     # Run vitest test suite (41 test files)
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run format:check # Prettier check
```

## Architecture

TypeScript source in `src/` compiles to `MegaKnights_BP/scripts/`. Never edit compiled JS directly.

```
src/
  main.ts              # Entry point — wires all systems together
  systems/             # 9 core systems (each manages one mechanic)
  data/                # Config: ArmorTiers, BestiaryDefinitions, CampDefinitions,
                       #   CastleBlueprints, FactionDefinitions, MilestoneEvents,
                       #   Strings, WaveDefinitions (includes ENEMY_SPAWN_DAY)
  __tests__/           # 41 vitest test files (source-as-text pattern — no @minecraft/server imports)
MegaKnights_BP/        # Behavior pack (entities, items, loot, recipes, scripts/)
MegaKnights_RP/        # Resource pack (textures, models, animations)
tools/build.sh         # BDS deploy script
```

## Systems

| System | Responsibility |
|--------|---------------|
| DayCounterSystem | 100-day quest timer, milestone event firing, HUD |
| ArmorTierSystem | Page → Squire → Knight → Champion → Mega Knight progression |
| ArmySystem | Allied unit tracking, capacity management |
| CombatSystem | Death event handler, 30% enemy recruitment chance |
| CastleSystem | Blueprint item usage → structure placement |
| SiegeSystem | Day-100 final wave event, 5 waves + boss |
| BestiarySystem | Kill-count tracking per enemy type, passive buff rewards at milestones |
| EnemyCampSystem | Enemy camp spawning on non-milestone off-days, compass direction hints |
| MerchantSystem | Standard Bearer scroll usage, merchant unit spawning |

## Key Conventions

**Namespace**: All custom entities/items use `mk:` prefix (e.g. `mk:mk_ally_knight`)

**Entity tags**:
- `mk_army` — identifies player-owned allied units
- `mk_owner_[playername]` — tracks unit ownership
- `mk_siege_mob` — marks active siege enemies
- `mk_camp_guard` — marks enemies spawned as camp guards

**Dynamic properties** (persistent storage):
- World: `mk:current_day`, `mk:day_tick_counter`, `mk:quest_active`
- Player: `mk:kills`, `mk:army_size`, `mk:current_tier`, `mk:army_bonus`, `mk:has_started`, `mk:tier_unlocked_*`
- Entity (ally): `mk:owner_name` — tracks which player owns the unit
- Entity (ally): `mk:stance` — current stance index (0=Follow, 1=Guard, 2=Hold)
- Player (bestiary): `mk:bestiary_kills_<type>` — per-enemy kill count for bestiary milestones

**Key data exports**:
- `ENEMY_SPAWN_DAY` (WaveDefinitions.ts) — minimum quest day before each enemy type spawns naturally
- `MERCHANT_DAYS` (MerchantSystem.ts) — days the Wandering Merchant appears (15, 30, 55, 75, 95)
- `MILESTONE_DAYS` (MilestoneEvents.ts) — days with milestone events (camps and merchants avoid these)

**Logging**: Uses `console.warn()` (not `console.log`) — intentional, captures to stderr in BDS.

## Debug Commands (in-game)

```
/scriptevent mk:setday <0-100>   # Jump to day
/scriptevent mk:start            # Start quest
/scriptevent mk:reset            # Reset all progress
/scriptevent mk:siege            # Trigger siege immediately
/scriptevent mk:army <count>     # Spawn debug allies
/scriptevent mk:camp             # Spawn enemy camp near player
```

## Testing & Performance Validation

**Switch is the primary performance target.** Every change must be tested on Switch hardware (or simulated as closely as possible).

### Performance Testing Checklist

- Test siege waves on Switch — the siege is the peak load scenario
- Profile with `/scriptevent mk:siege` and count entities during each wave transition
- Watch for: pathfinding stalls (entities standing still), frame drops below 20 FPS, input lag
- Run `/scriptevent mk:army 30` before siege to simulate realistic ally counts
- Entity count targets: **<40 normal play, <60 during siege, never exceed 80**
- Test with `should_darken_sky: false` on boss to measure GPU impact
- After texture art is finalized, verify materials are `entity` (opaque) not `entity_alphatest` unless needed

### Development Iteration

- `npm run watch` + `/reload` in-game for fast script iteration (no server restart)
- BDS auto-deploy: `export BDS_DIR=... && npm run deploy` to skip manual pack copying
- Check BDS stderr for `console.warn()` logs — grep for `mk:` prefix to filter noise

## Gotchas

- **Structure placement**: `world.structureManager.place()` is primary; falls back to fill/setblock commands if `.mcstructure` files missing.
- **Deleted utils**: `src/utils/` (EntityUtils, MessageUtils, PlayerData) was removed — logic now lives in each system.
- **Tick rate**: 20 ticks/sec. Day counter ticks every 20 ticks. HUD updates every 10 ticks. Army recount every 200 ticks.
- **Army capacity**: Base 15 units + castle bonuses (+5 tower, +7 gatehouse, +8 great hall) = 35 max singleplayer. `GLOBAL_ARMY_CAP=35` is intentional — 35 allies + 25 siege mobs = 60, the Switch entity budget ceiling.
- **Minecraft API versions**: Requires engine `[1, 21, 50]`; uses `@minecraft/server@^2.5.0`.

## Bedrock Dev Patterns

- **Defer world mutations in event handlers**: Wrap entity spawns/modifications inside `system.run(() => { ... })` to avoid mutating during event processing.
- **Guard entity access with try-catch**: Entities can be in unloaded chunks or despawned between ticks — always wrap `.dimension`, `.location`, `.getComponent()` calls.
- **Keep dynamic properties flat**: Prefer primitive values over serialized JSON. JSON strings have size limits and are fragile to parse errors.
- **Cache dynamic property reads**: Read `world.getDynamicProperty()` once on load/reset, store in instance fields. Never read dynamic properties in hot paths (tick, HUD) when a cached value exists.
- **Stagger bulk spawns**: Max 1-2 entities per tick on Switch. Spread across ticks with `system.runJob`. Never spawn synchronously in a loop.
- **Use `system.runJob()` for heavy block ops**: Castle structure placement should use generator functions to spread work across ticks instead of freezing the game.
- **Minimize `getAllPlayers()` and `getEntities()` calls**: These are expensive bridge calls. Cache results, pass references, and avoid calling inside generator loops. `getEntities()` scans the entire dimension.
- **Cache HUD strings**: Compare with previous value before calling `setActionBar()`. Skip the native bridge call when nothing changed.
- **Set `scan_interval` on target scanning**: `nearest_attackable_target` without `scan_interval` scans every few ticks. Always set `"scan_interval": 10` (half-second) minimum.
- **Keep `follow_range` low**: Pathfinding cost is roughly cubic with distance. Use 16 for basic mobs, 20-24 for elites, 32 only for bosses.
- **Set despawn distances for allies**: Use large despawn distance (96-128 blocks) instead of `minecraft:persistent` where possible, to prevent unbounded memory growth.

## Adding New Content

**New item checklist** (all required):
1. `MegaKnights_BP/items/tools/<name>.json` — identifier `mk:mk_<name>`
2. `MegaKnights_RP/textures/items/<name>.png` — texture PNG
3. Entry in `MegaKnights_RP/textures/item_texture.json` — key matches part after `mk:` (e.g. `mk_standard_bearer_scroll`)
4. Lang key `item.mk:mk_<name>.name=...` in BOTH `MegaKnights_BP/texts/en_US.lang` AND `MegaKnights_RP/texts/en_US.lang`

**New entity checklist** (all required):
1. `MegaKnights_BP/entities/<name>.se.json` — identifier `mk:mk_<name>`
2. `MegaKnights_RP/entity/<name>.ce.json` — client entity definition
3. `MegaKnights_RP/textures/entity/<name>.png` — texture PNG
4. Lang key `entity.mk:mk_<name>.name=...` in BOTH lang files

## Compaction Instructions

When context is compacted, ALWAYS preserve:
- The full list of files modified in this session with their absolute paths
- Current task list state (in-progress tasks, next steps, blockers)
- Key architectural decisions made during this session and their rationale
- Any test commands run and their pass/fail results
- Error patterns encountered and their solutions
- The current feature/bug being worked on and what remains to be done
- Any entity budget or performance findings from this session

Do NOT stop work early due to context budget concerns. Save progress to task state and memory files, then continue. Be as persistent and autonomous as possible.

## Autonomous Harness

For long-running autonomous work across multiple sessions:

```bash
./harness.sh                        # Default: 10 sessions, opus model
./harness.sh --init                 # Generate feature_list.json from codebase analysis
./harness.sh --sessions 20          # Run up to 20 sessions
./harness.sh --model sonnet         # Faster/cheaper model
./harness.sh --continue             # Continue last session
```

**Files:**
- `.claude/feature_list.json` — prioritized task list (only `passes` field is mutable)
- `.claude/progress.txt` — append-only session log
- `.claude/prompts/initializer_prompt.md` — first-session prompt (generates feature list)
- `.claude/prompts/coding_prompt.md` — continuation prompt (works through tasks)

**How it works:** The harness runs `claude -p` in a loop. Each session reads progress.txt and feature_list.json, works on the next incomplete task, verifies it, marks it done, commits, and moves on. The Stop hook saves progress and nudges Claude to keep working if tasks remain. Sessions chain automatically — each fresh context picks up where the last left off via the progress file.

**In-session usage:** Use `/harness init` to generate a feature list, `/harness status` to check progress, or `/harness add <description>` to add tasks.

## BDS Deployment

```bash
export BDS_DIR=/path/to/macOS-Bedrock-Server/server
npm run deploy
```

Rsyncs both packs to the server's `development_behavior_packs/` and `development_resource_packs/`.
