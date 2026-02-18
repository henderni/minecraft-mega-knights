# Mega Knights — Bedrock Add-on

## Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TS → MegaKnights_BP/scripts/
npm run watch        # Watch mode
npm run deploy       # Build + rsync to BDS (requires $BDS_DIR env var)
```

## Architecture

TypeScript source in `src/` compiles to `MegaKnights_BP/scripts/`. Never edit compiled JS directly.

```
src/
  main.ts              # Entry point — wires all systems together
  systems/             # 6 core systems (each manages one mechanic)
  data/                # Config: ArmorTiers, CastleBlueprints, MilestoneEvents, WaveDefinitions
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

## Key Conventions

**Namespace**: All custom entities/items use `mk:` prefix (e.g. `mk:mk_ally_knight`)

**Entity tags**:
- `mk_army` — identifies player-owned allied units
- `mk_owner_[playername]` — tracks unit ownership
- `mk_siege_mob` — marks active siege enemies

**Dynamic properties** (persistent storage):
- World: `mk:current_day`, `mk:day_tick_counter`, `mk:quest_active`
- Player: `mk:kills`, `mk:army_size`, `mk:current_tier`, `mk:army_bonus`, `mk:has_started`, `mk:tier_unlocked_*`

**Logging**: Uses `console.warn()` (not `console.log`) — intentional, captures to stderr in BDS.

## Debug Commands (in-game)

```
/scriptevent mk:setday <0-100>   # Jump to day
/scriptevent mk:start            # Start quest
/scriptevent mk:reset            # Reset all progress
/scriptevent mk:siege            # Trigger siege immediately
/scriptevent mk:army <count>     # Spawn debug allies
```

## Gotchas

- **Structure placement**: `world.structureManager.place()` is primary; falls back to fill/setblock commands if `.mcstructure` files missing.
- **Deleted utils**: `src/utils/` (EntityUtils, MessageUtils, PlayerData) was removed — logic now lives in each system.
- **Tick rate**: 20 ticks/sec. Day counter ticks every 20 ticks. HUD updates every 2 ticks.
- **Army capacity**: Base 20 units + castle bonuses (+5/+10/+15 per structure type).
- **Minecraft API versions**: Requires engine `[1, 21, 50]`; uses `@minecraft/server@2.3.0`.

## Bedrock Dev Patterns

- **Defer world mutations in event handlers**: Wrap entity spawns/modifications inside `system.run(() => { ... })` to avoid mutating during event processing.
- **Guard entity access with try-catch**: Entities can be in unloaded chunks or despawned between ticks — always wrap `.dimension`, `.location`, `.getComponent()` calls.
- **Keep dynamic properties flat**: Prefer primitive values over serialized JSON. JSON strings have size limits and are fragile to parse errors.
- **Stagger bulk spawns**: Spawning 15+ entities in one tick causes frame drops (especially mobile). Spread across ticks with `system.runInterval` or `system.runJob`.
- **Use `system.runJob()` for heavy block ops**: Castle structure placement should use generator functions to spread work across ticks instead of freezing the game.
- **Bump manifest `version` on every deploy**: Minecraft caches packs by UUID+version. Unchanged versions → stale content on clients.
- **Localize player-facing strings**: Use `texts/en_US.lang` instead of hardcoded strings in scripts.
- **Test multiplayer**: Player-scoped vs world-scoped dynamic properties behave differently with multiple players. Army ownership and HUD updates need multi-player testing.
- **Prefer JSON behaviors over script**: Component groups, timers, and sensors are cheaper than script-driven AI. Reserve scripting for logic that can't be expressed in entity JSON.
- **Set despawn distances for allies**: Allied units that despawn when the player walks away is a bad experience — use large or no despawn distance.

## BDS Deployment

```bash
export BDS_DIR=/path/to/macOS-Bedrock-Server/server
npm run deploy
```

Rsyncs both packs to the server's `development_behavior_packs/` and `development_resource_packs/`.
