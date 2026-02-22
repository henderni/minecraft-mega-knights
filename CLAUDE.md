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
npm run deploy       # Build + rsync to BDS (set $BDS_DIR first, e.g. /path/to/server)
npm run package      # Package add-on for distribution
npm run test:run     # Run vitest test suite
npm run test:coverage # Run tests with coverage report
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run format:check # Prettier check

# BDS Docker commands
npm run bds:start    # Start BDS container (port 19132/udp)
npm run bds:stop     # Stop BDS container
npm run bds:restart  # Restart BDS container
npm run bds:logs     # Tail BDS logs
npm run bds:setup    # Enable packs on BDS
npm run bds:console  # Attach to BDS console
npm run bds:ip       # Show LAN IP for iPad connection
```

## Architecture

TypeScript source in `src/` compiles to `MegaKnights_BP/scripts/`. Never edit compiled JS directly.

```
src/
  main.ts              # Entry point — wires all systems together
  systems/             # Core systems (each manages one mechanic)
  data/                # Config: AllyNames, ArmorTiers, BestiaryDefinitions, CampDefinitions,
                       #   CastleBlueprints, FactionDefinitions, MilestoneEvents,
                       #   Strings, WaveDefinitions (includes ENEMY_SPAWN_DAY)
  utils/               # Shared helpers (LRUTickCache, numProp)
  __tests__/           # vitest test files (source-as-text pattern — no @minecraft/server imports)
MegaKnights_BP/        # Behavior pack (entities, items, loot, recipes, scripts/)
MegaKnights_RP/        # Resource pack (textures, models, animations)
tools/
  build.sh             # BDS deploy script (rsync packs to server)
  package.sh           # Package add-on for distribution
  bds-enable-packs.sh  # Enable packs on BDS server
  generate_textures.py # Texture generation (Python)
  generate-textures.js # Texture generation (Node)
```

## Systems

| System | Responsibility |
|--------|---------------|
| DayCounterSystem | 100-day quest timer, milestone event firing, HUD |
| ArmorTierSystem | Page → Squire → Knight → Champion → Mega Knight progression |
| ArmySystem | Allied unit tracking, capacity management |
| CombatSystem | Death event handler, difficulty-dependent enemy recruitment |
| CastleSystem | Blueprint item usage → structure placement |
| SiegeSystem | Day-100 final wave event, 5 waves + boss |
| BestiarySystem | Kill-count tracking per enemy type, passive buff rewards at milestones |
| EnemyCampSystem | Enemy camp spawning on non-milestone off-days, compass direction hints |
| MerchantSystem | Standard Bearer scroll usage, merchant unit spawning |
| DifficultySystem | Normal/Hard difficulty toggle, recruit chance and enemy multiplier |
| QuestJournalSystem | In-game quest journal UI with bestiary, milestones, and progress |

## Key Conventions

**Namespace**: All custom entities/items use `mk:` prefix (e.g. `mk:mk_ally_knight`)

**Entity tags**:
- `mk_army` — identifies player-owned allied units
- `mk_owner_[playername]` — tracks unit ownership
- `mk_siege_mob` — marks active siege enemies
- `mk_camp_guard` — marks enemies spawned as camp guards

**Dynamic properties** (persistent storage):
- World: `mk:current_day`, `mk:day_tick_counter`, `mk:quest_active`, `mk:endless_mode`
- Player: `mk:kills`, `mk:army_size`, `mk:current_tier`, `mk:army_bonus`, `mk:has_started`, `mk:tier_unlocked_*`, `mk:difficulty`
- Entity (ally): `mk:owner_name` — tracks which player owns the unit
- Entity (ally): `mk:stance` — current stance index (0=Follow, 1=Guard, 2=Hold)
- Entity (ally): `mk:ally_name` — named ally display name
- Player (bestiary): `mk:kills_<type>` — per-enemy kill count for bestiary milestones (e.g. `mk:kills_knight`, `mk:kills_archer`)

**Key data exports**:
- `ENEMY_SPAWN_DAY` (WaveDefinitions.ts) — minimum quest day before each enemy type spawns naturally
- `MERCHANT_DAYS` (MerchantSystem.ts) — days the Wandering Merchant appears (15, 30, 55, 75, 95; also every 25 days past 100 in endless mode)
- `MILESTONE_DAYS` (MilestoneEvents.ts) — days with milestone events (camps and merchants avoid these)

**Logging**: Uses `console.warn()` (not `console.log`) — intentional, captures to stderr in BDS.

## Debug Commands (in-game)

```
/scriptevent mk:setday <N>       # Jump to day (0-100 normal, up to 999 endless)
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
- **Utils directory**: `src/utils/` was gutted (EntityUtils, MessageUtils, PlayerData removed — logic lives in each system) but now contains `LRUTickCache` (tick-aware cache) and `numProp` (numeric dynamic property helper).
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

On compaction, preserve: modified files list, task state, architectural decisions, test results, error patterns, current WIP. Do not stop early — save state and continue.

## Autonomous Harness

`./harness.sh [--init] [--sessions N] [--model sonnet] [--continue]` — long-running multi-session work. Use `/harness` skill in-session. Files: `.claude/feature_list.json`, `.claude/progress.txt`.

