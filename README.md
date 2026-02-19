# Mega Knights

A 100-day knight progression add-on for Minecraft Bedrock Edition. Rise from Page to Mega Knight, build your army, construct a castle, and survive the final siege.

**Requires Minecraft Bedrock 1.21.50+** (including Switch, mobile, Windows, Xbox, and PlayStation).

## Gameplay

You have 100 in-game days to prepare for a massive siege. Along the way you'll:

- **Rank up** through 5 armor tiers: Page → Squire → Knight → Champion → Mega Knight
- **Recruit an army** of knights, archers, wizards, and dark knights (30% chance to recruit defeated enemies)
- **Build castle structures** — small tower, gatehouse, and great hall — each expanding your troop capacity
- **Survive milestone raids** that test your strength at regular intervals
- **Face the Day-100 Siege** — 5 waves of enemies culminating in a boss fight against the Siege Lord

### Milestones

| Day | Event |
|-----|-------|
| 5 | Small Tower blueprint |
| 10 | Enemy scouts appear |
| 20 | Squire armor unlock |
| 25 | Raiding party |
| 35 | Gatehouse blueprint |
| 40 | Knight armor unlock |
| 50 | Dark wizards + Great Hall blueprint |
| 60 | Champion armor unlock |
| 85 | Mega Knight armor unlock |
| 90 | Vanguard arrives |
| 100 | **Final Siege** |

### Armor Tiers

| Tier | Unlock Day | Protection (H/C/L/B) | Repair Material |
|------|-----------|----------------------|-----------------|
| Page | 0 | 2 / 3 / 2 / 1 | Leather |
| Squire | 20 | 3 / 5 / 4 / 2 | Iron Ingot |
| Knight | 40 | 4 / 7 / 5 / 3 | Iron Ingot |
| Champion | 60 | 5 / 8 / 6 / 4 | Diamond |
| Mega Knight | 85 | 6 / 10 / 8 / 5 | Netherite Ingot |

### Army & Castles

- Base troop capacity: **15 units**
- Small Tower: **+5** capacity
- Gatehouse: **+7** capacity
- Great Hall: **+8** capacity
- Maximum capacity: **35 units** (singleplayer)

> **Multiplayer note:** In multiplayer the per-player cap scales with `floor(35 / playerCount)` to keep the total entity budget within Switch hardware limits (35 allies + 25 siege mobs = 60 entities max).

## Installation

1. Download or clone this repository
2. Copy `MegaKnights_BP` into your `behavior_packs` folder
3. Copy `MegaKnights_RP` into your `resource_packs` folder
4. Create a new world and activate both packs
5. Enable **Beta APIs** in the world's Experiments settings

Pack locations by platform:

| Platform | Path |
|----------|------|
| Windows | `%localappdata%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\` |
| Android | `/storage/emulated/0/Android/data/com.mojang.minecraftpe/files/games/com.mojang/` |
| iOS | `Minecraft/games/com.mojang/` (via Files app) |

## In-Game Commands

Start the quest by running:

```
/scriptevent mk:start
```

### Debug Commands

```
/scriptevent mk:setday <0-100>   # Jump to a specific day
/scriptevent mk:start            # Start the quest
/scriptevent mk:reset            # Reset all progress
/scriptevent mk:siege            # Trigger the siege immediately
/scriptevent mk:army <count>     # Spawn debug allies
```

## Development

### Prerequisites

- Node.js 18+
- TypeScript 5.x (`npm install` handles this)

### Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript → MegaKnights_BP/scripts/
npm run watch        # Watch mode (recompile on save)
npm run deploy       # Build + deploy to Bedrock Dedicated Server
```

For BDS deployment, set the `BDS_DIR` environment variable:

```bash
export BDS_DIR=/path/to/bedrock-server
npm run deploy
```

### Project Structure

```
src/
├── main.ts                    # Entry point — wires all systems together
├── systems/
│   ├── DayCounterSystem.ts    # 100-day timer, milestones, HUD
│   ├── ArmorTierSystem.ts     # Armor progression & unlock tokens
│   ├── ArmySystem.ts          # Troop recruitment & capacity
│   ├── CombatSystem.ts        # Death handler, enemy recruitment
│   ├── CastleSystem.ts        # Blueprint placement & structure building
│   └── SiegeSystem.ts         # 5-wave siege event & boss fight
└── data/                      # Config tables (tiers, blueprints, waves, milestones)

MegaKnights_BP/                # Behavior pack (entities, items, loot, recipes, scripts)
MegaKnights_RP/                # Resource pack (textures, models, animations)
tools/build.sh                 # Version bump + compile + BDS deploy
```

### Performance Notes

This add-on is optimized for Nintendo Switch and other low-end Bedrock devices:

- Entity budget kept under 40 (normal play) / 60 (siege)
- Pathfinding ranges minimized (16 blocks for standard mobs)
- Dynamic properties cached — no reads in hot paths
- HUD updates skip when content hasn't changed
- Spawns staggered at 1–2 entities per tick via `system.runJob()`
- `getAllPlayers()` and `getEntities()` calls throttled and cached

## Distribution

### Create .mcaddon Package

Package the add-on for distribution:

```bash
npm run package
```

This creates `MegaKnights.mcaddon` containing both the behavior pack and resource pack.

### Installation from .mcaddon

Users can install the `.mcaddon` file by:
1. Downloading `MegaKnights.mcaddon`
2. Opening it with Minecraft (double-click or "Open with")
3. Confirming the pack activation
4. Enabling **Beta APIs** in world settings

### Microsoft Marketplace Submission

To publish on the official Minecraft Marketplace:

1. **Register** as a Minecraft Creator through [Microsoft Creator Portal](https://www.microsoft.com/en-us/minecraft/creator/)
2. **Prepare submission**:
   - Create the `.mcaddon` package (`npm run package`)
   - Write detailed description and include screenshots
   - Ensure all manifests have correct metadata
   - Test thoroughly on multiple platforms (Windows, Switch, mobile)
3. **Submit** via Creator Portal for review
4. **Wait for approval** (typically 1-2 weeks)

**Note**: Marketplace availability varies by region. Direct distribution via `.mcaddon` download is always available and requires no approval.

## License

All rights reserved.
