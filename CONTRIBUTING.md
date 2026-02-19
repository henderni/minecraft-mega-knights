# Development Guide – Mega Knights

This guide covers setting up your development environment, running the add-on locally, and debugging on target hardware.

## Prerequisites

- **Node.js 20** (use `nvm use 20` or check `.nvmrc`)
- **npm 10+**
- **macOS/Linux** (for BDS; Windows users can use WSL)
- **Minecraft Bedrock** (for testing)
- **Optional**: Bedrock Dedicated Server (BDS) for advanced testing

## Initial Setup

### 1. Clone & Install

```bash
git clone https://github.com/henderni/minecraft-mega-knights.git
cd minecraft-mega-knights

# Check Node version
node --version  # should be v20.x

# Install dependencies
npm install
```

### 2. Build TypeScript

```bash
# One-time build
npm run build

# Watch mode (recompile on save)
npm run watch
```

You should see output like:
```
✓ Compiled src/main.ts → MegaKnights_BP/scripts/main.js
```

## Testing Locally

### Option A: Manual Pack Import (Quickest)

1. **Find your com.mojang folder:**
   - **Windows**: `%localappdata%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\`
   - **macOS**: `~/Library/Application Support/minecraft/`
   - **Linux**: `~/.minecraft/`

2. **Copy packs:**
   ```bash
   cp -r MegaKnights_BP ~/Library/Application\ Support/minecraft/development_behavior_packs/
   cp -r MegaKnights_RP ~/Library/Application\ Support/minecraft/development_resource_packs/
   ```

3. **In Minecraft:**
   - Create new world
   - Activate both packs in **Behavior Packs** and **Resource Packs** tabs
   - Enable **Beta APIs** in Experiments
   - Start world

4. **Iterate:**
   - Edit TypeScript in `src/`
   - Run `npm run build` (or use `npm run watch`)
   - In game: `/reload` to hot-reload scripts
   - No need to restart Minecraft

### Option B: Bedrock Dedicated Server (BDS)

For realistic testing environment (closer to production):

#### macOS/Linux Setup

1. **Download BDS:**
   ```bash
   # Get latest BDS from https://www.minecraft.net/en-us/download/server/bedrock/
   # Extract to ~/BDS/
   ```

2. **Set environment variable:**
   ```bash
   export BDS_DIR=~/BDS/server
   ```

3. **Deploy packs:**
   ```bash
   npm run deploy
   # This runs: bash tools/build.sh
   # Compiles TS + rsyncs to BDS development packs
   ```

4. **Start BDS:**
   ```bash
   cd ~/BDS/server
   ./start.sh  # or .bat on Windows
   ```

5. **Connect client:**
   - Open Minecraft
   - Click "Play" → "Servers"
   - Add server: `localhost:19132`
   - Join world

6. **Development workflow:**
   ```bash
   # Terminal 1: Watch TypeScript
   npm run watch

   # Terminal 2: Re-deploy on changes
   watch 'npm run deploy' src/
   ```

#### Check BDS Logs

BDS logs go to `server_log.txt`. Filter for your addon:

```bash
tail -f ~/BDS/server/latest_log.txt | grep "mk:"
```

Your `console.warn()` messages appear here.

## Testing on Nintendo Switch

This is **the primary performance target**. Test here before shipping.

### Before Testing

1. **Pack your add-on:**
   ```bash
   npm run package
   # Creates MegaKnights.mcaddon
   ```

2. **Transfer to Switch:**
   - Email `.mcaddon` to yourself or transfer via USB
   - Open file on Switch → Minecraft installs it

### During Testing

**Focus areas:**
- Siege waves (highest entity load)
- Army recruiting during combat
- 100-day progression smooth?
- No frame drops below 20 FPS
- No input lag

**Debug commands (useful on Switch too):**
```
/scriptevent mk:start           # Start quest
/scriptevent mk:setday 50       # Jump to day 50
/scriptevent mk:setday 100      # Jump to day 100
/scriptevent mk:siege           # Trigger siege
/scriptevent mk:army 30         # Spawn 30 allies
/scriptevent mk:reset           # Reset all progress
```

**Performance profiling:**
1. Run `/scriptevent mk:siege`
2. Watch entity count in chat (if implemented)
3. Count entities at each wave
4. Note FPS during wave transitions
5. Check for pathfinding stalls (units standing still)

**If performance issues:**
- Reduce `follow_range` in entity JSON
- Check for `getAllPlayers()` in runInterval callbacks
- Ensure dynamic properties are cached
- Verify spawn rules have `density_limit`

## Testing on Mobile

Same `.mcaddon` distribution works for iOS/Android.

**Known differences from Switch:**
- Variable GPU performance (depends on device age)
- Touch controls (confirm command input works)
- Battery impact

Test on older devices to catch performance regressions.

## Code Quality

### Linting

Check for code issues before committing:

```bash
npm run lint              # Report issues
npm run lint:fix         # Auto-fix where possible
```

**Common issues fixed:**
- `console.log` → `console.warn`
- Missing `const` declarations
- Unused imports
- Type errors

### Formatting

Auto-format code:

```bash
npm run format           # Format all files
npm run format:check    # Check without modifying
```

**Before committing:**
```bash
npm run lint:fix && npm run format && npm run build
```

## Debugging

### TypeScript Errors

These show up in `npm run build`:

```bash
npm run build
# Error: TS2339: Property 'doesNotExist' does not exist on type 'Player'
```

Fix the error and rebuild. ESLint can auto-fix many issues:

```bash
npm run lint:fix
```

### Console Output

On BDS, your addon logs appear in `latest_log.txt`:

```bash
tail -f ~/BDS/server/latest_log.txt | grep "mk:"
```

Example logs:
```
[Scripting] mk: DayCounterSystem initialized
[Scripting] mk: Milestone reached: Day 20
[Scripting] mk: Army recruited: 5 new units
```

Use `console.warn()` for important messages:
```typescript
console.warn("mk: Critical event happened");
```

### Entity Issues

**Entities not spawning?**
- Check `spawn_rules/` JSON is valid (`npm run build` validates)
- Ensure spawn location is accessible (not in ceiling)
- Check entity budget (under 40 normally)
- Review entity JSON for syntax errors

**Entities despawning too early?**
- Check `minecraft:despawn` component in entity JSON
- `max_distance: 54, min_distance: 32` should match vanilla
- Allies need larger despawn distance (96-128) to persist

**Pathfinding broken?**
- Check `follow_range` (should be ≤16 for basic mobs)
- If range is high, pathfinding cost is cubic
- Reduce range or increase tick updates

### Dynamic Property Issues

**Progress not saving?**
- Check if `world.setDynamicProperty()` is being called
- Verify key format (no special characters)
- Values must be primitives (numbers, strings, booleans), not objects

**Wrong player data loading?**
- Use `entity.getDynamicProperty()` for player-scoped data
- Use `world.getDynamicProperty()` for world-scoped data
- Ensure scope matches intent

## Common Issues & Fixes

### Issue: "Pack not showing in Minecraft"
**Solution:**
- Ensure you copied to `development_behavior_packs/` and `development_resource_packs/`
- Check folder name matches manifest UUID (or just use folder names)
- Restart Minecraft completely
- On Switch: restart the app

### Issue: "Script errors after `/reload`"
**Solution:**
- Check `latest_log.txt` for the actual error
- Might be missing entity that the script expects
- Try full world restart instead of `/reload`

### Issue: "Entities freeze/don't attack"
**Solution:**
- Check `follow_range` isn't too high
- Ensure `nearest_attackable_target` has `scan_interval: 10`
- Verify target selector syntax in entity JSON
- Look for pathfinding issues (check build log)

### Issue: "Performance terrible on Switch"
**Solution:**
1. Run `/scriptedit mk:siege` and count entities
2. If > 60: reduce enemy spawn rates or wave sizes
3. Check for `getAllPlayers()` or `getEntities()` in loops
4. Verify no unintended `runInterval` callbacks
5. Profile with lower entity counts

### Issue: "npm run deploy fails"
**Solution:**
- Check `BDS_DIR` environment variable is set: `echo $BDS_DIR`
- Verify `MegaKnights_BP/scripts/main.js` exists (run `npm run build` first)
- Check BDS server isn't running during deploy
- Check rsync is installed: `which rsync`

## Project Structure

```
src/
  ├── main.ts                 # Entry point
  ├── systems/                # Core game logic (6 files)
  │   ├── DayCounterSystem.ts
  │   ├── ArmorTierSystem.ts
  │   ├── ArmySystem.ts
  │   ├── CombatSystem.ts
  │   ├── CastleSystem.ts
  │   └── SiegeSystem.ts
  └── data/                   # Configuration
      ├── ArmorTiers.ts
      ├── CastleBlueprints.ts
      ├── MilestoneEvents.ts
      ├── WaveDefinitions.ts
      └── Strings.ts
MegaKnights_BP/
  ├── entities/               # Entity JSON definitions
  ├── items/                  # Armor, tools, tokens
  ├── recipes/                # Crafting recipes
  ├── loot_tables/
  ├── spawn_rules/            # Enemy spawn points
  ├── scripts/                # Compiled JS (generated)
  └── texts/en_US.lang        # Localization
MegaKnights_RP/
  ├── entity/                 # Entity models/animations
  ├── textures/               # 2D textures
  ├── attachables/            # Armor rendering
  └── models/                 # 3D models
tools/
  ├── build.sh                # BDS deploy script
  ├── package.sh              # Create .mcaddon
  └── generate_textures.py    # (Optional) texture gen
```

## Useful Commands

```bash
# Build only
npm run build

# Watch + auto-rebuild
npm run watch

# Deploy to BDS
npm run deploy

# Package for distribution
npm run package

# Lint code
npm run lint
npm run lint:fix

# Format code
npm run format

# Run TypeScript type check
tsc --noEmit

# Full pre-commit check
npm run lint:fix && npm run format && npm run build
```

## Performance Profiling Checklist

Before submitting to Marketplace:

- [ ] Test siege on Switch hardware
- [ ] Entity count < 40 (normal), < 60 (siege), < 80 (max)
- [ ] FPS > 20 during peak load
- [ ] No pathfinding stalls
- [ ] Army recruiting works smoothly
- [ ] No console errors in BDS log
- [ ] Dynamic properties persist across world reloads
- [ ] All armor tiers unlock correctly
- [ ] Castle structures place without lag

## Resources

- [Microsoft Bedrock Creator Docs](https://learn.microsoft.com/en-us/minecraft/creator/)
- [Script API Reference](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/)
- [@minecraft/server API](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/)
- [Bedrock JSON Documentation](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/)

## Getting Help

**For technical issues:**
- Check BDS logs: `tail -f ~/BDS/server/latest_log.txt`
- Run linter: `npm run lint`
- Check `.claude/settings.json` for performance review hooks

**For design questions:**
- See CLAUDE.md for architecture & patterns
- See README.md for gameplay overview

---

**Last Updated**: February 18, 2026
