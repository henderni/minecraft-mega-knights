/**
 * error-handling.test.ts
 *
 * Static source-code analysis tests for error handling quality.
 *
 * What happens when things go wrong:
 * - Entity spawns in unloaded chunks → try-catch, some log via console.warn
 * - Player disconnects mid-loop → try-catch, silently skipped
 * - Invalid dynamic properties → clamped to safe defaults
 * - Bad blueprint / raycast fail → explicit early-return with user message
 * - Debug commands with bad input → validated in main.ts before dispatching
 *
 * Errors are NOT recoverable at the Bedrock script layer (no retry, no queue).
 * Diagnostic output routes through console.warn → BDS stderr log.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_DIR = path.join(__dirname, "..");
const SYSTEMS_DIR = path.join(SRC_DIR, "systems");
const DATA_DIR = path.join(SRC_DIR, "data");

function readSystem(filename: string): string {
  return fs.readFileSync(path.join(SYSTEMS_DIR, filename), "utf-8");
}

function readData(filename: string): string {
  return fs.readFileSync(path.join(DATA_DIR, filename), "utf-8");
}

function readMain(): string {
  return fs.readFileSync(path.join(SRC_DIR, "main.ts"), "utf-8");
}

const ALL_SYSTEM_FILES = fs
  .readdirSync(SYSTEMS_DIR)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => ({ name: f, src: readSystem(f) }));

// ---------------------------------------------------------------------------

describe("Logging Standards", () => {
  it("no system file uses console.log (must use console.warn for BDS stderr)", () => {
    for (const { name, src } of ALL_SYSTEM_FILES) {
      const logCalls = src.match(/console\.log\s*\(/g);
      expect(logCalls, `${name} contains console.log — use console.warn`).toBeNull();
    }
  });

  it("main.ts uses console.warn not console.log", () => {
    const src = readMain();
    expect(src).not.toMatch(/console\.log\s*\(/);
    expect(src).toContain("console.warn");
  });

  it("startup log has [MegaKnights] prefix", () => {
    const src = readMain();
    expect(src).toContain("[MegaKnights]");
  });

  it("ArmySystem logs ally spawn failures with context", () => {
    const src = readSystem("ArmySystem.ts");
    expect(src).toContain("[MegaKnights] Failed to spawn ally:");
  });

  it("ArmySystem logs debug ally spawn failures", () => {
    const src = readSystem("ArmySystem.ts");
    expect(src).toContain("[MegaKnights] Failed to spawn debug ally:");
  });

  it("CastleSystem logs build command failures with error details", () => {
    const src = readSystem("CastleSystem.ts");
    expect(src).toContain("[MegaKnights] Build command failed:");
  });

  it("SiegeSystem does not log spawn failures (silently skipped — expected)", () => {
    // Siege spawn failures are OK to swallow: wave spawning is fire-and-forget
    const src = readSystem("SiegeSystem.ts");
    // No console.warn in SiegeSystem — silent skip is intentional
    expect(src).not.toContain("console.warn");
  });
});

// ---------------------------------------------------------------------------

describe("Try-Catch Coverage on Entity Operations", () => {
  it("ArmySystem.recruitAlly wraps spawnEntity in try-catch", () => {
    const src = readSystem("ArmySystem.ts");
    expect(src).toContain("Failed to spawn ally:");
    // Verify try block exists for spawn
    expect(src).toMatch(/try\s*\{[\s\S]*?spawnEntity[\s\S]*?\}\s*catch/);
  });

  it("ArmySystem.tick wraps dimension.getEntities in try-catch", () => {
    const src = readSystem("ArmySystem.ts");
    // Dimension query may fail during player teleport
    expect(src).toMatch(/try\s*\{[\s\S]*?getEntities[\s\S]*?\}\s*catch/);
  });

  it("ArmySystem.onPlayerInteract wraps getComponent in try-catch", () => {
    const src = readSystem("ArmySystem.ts");
    expect(src).toMatch(/try\s*\{[\s\S]*?getComponent[\s\S]*?\}\s*catch/);
  });

  it("SiegeSystem.spawnWave wraps spawnEntity in try-catch", () => {
    const src = readSystem("SiegeSystem.ts");
    expect(src).toMatch(/try\s*\{[\s\S]*?spawnEntity[\s\S]*?\}\s*catch/);
  });

  it("SiegeSystem.tick wraps getDimension recount in try-catch", () => {
    const src = readSystem("SiegeSystem.ts");
    expect(src).toMatch(/try\s*\{[\s\S]*?getDimension[\s\S]*?\}\s*catch/);
  });

  it("SiegeSystem death listener wraps health check in try-catch", () => {
    const src = readSystem("SiegeSystem.ts");
    // Player health check during siege defeat condition
    expect(src).toMatch(/try\s*\{[\s\S]*?getComponent[\s\S]*?\}\s*catch/);
  });

  it("CastleSystem wraps structureManager.place in try-catch (falls back to commands)", () => {
    const src = readSystem("CastleSystem.ts");
    expect(src).toMatch(/try\s*\{[\s\S]*?structureManager[\s\S]*?\}\s*catch/);
  });

  it("CastleSystem fallback builder wraps dimension.runCommand in try-catch", () => {
    const src = readSystem("CastleSystem.ts");
    expect(src).toMatch(/try\s*\{[\s\S]*?runCommand[\s\S]*?\}\s*catch/);
  });

  it("DayCounterSystem HUD update wraps per-player loop in try-catch", () => {
    const src = readSystem("DayCounterSystem.ts");
    // Player may disconnect between getAllPlayers() and property access
    expect(src).toContain("} catch {");
    expect(src).toContain("Player may have disconnected");
  });

  it("CombatSystem captures entity data in try-catch before defer", () => {
    const src = readSystem("CombatSystem.ts");
    // Entity properties captured before system.run to prevent invalid access
    expect(src).toContain("const typeId = dead.typeId");
    expect(src).toContain("const location = { ...dead.location }");
    expect(src).toMatch(/try\s*\{[\s\S]*?dead\.typeId[\s\S]*?\}\s*catch/);
  });

  it("main.ts entitySpawn handler wraps entity.remove in try-catch", () => {
    const src = readMain();
    expect(src).toMatch(/try\s*\{[\s\S]*?entity\.remove[\s\S]*?\}\s*catch/);
  });

  it("MilestoneEvents spawn function wraps spawnEntity in try-catch", () => {
    const src = readData("MilestoneEvents.ts");
    expect(src).toMatch(/try\s*\{[\s\S]*?spawnEntity[\s\S]*?\}\s*catch/);
  });

  it("MilestoneEvents giveBlueprintToPlayers wraps runCommand in try-catch", () => {
    const src = readData("MilestoneEvents.ts");
    expect(src).toMatch(/try\s*\{[\s\S]*?runCommand[\s\S]*?\}\s*catch/);
  });
});

// ---------------------------------------------------------------------------

describe("Input Validation at Command Boundaries", () => {
  it("setday command validates input is a number before dispatching", () => {
    const src = readMain();
    expect(src).toContain("!isNaN(day)");
    // Range clamping is enforced inside DayCounterSystem.setDay() — not duplicated here
  });

  it("army debug command validates count in 1-50 range", () => {
    const src = readMain();
    expect(src).toContain("count > 0");
    expect(src).toContain("count <= 50");
    expect(src).toContain("!isNaN(count)");
  });

  it("army debug command validates source is a player (not command block)", () => {
    const src = readMain();
    expect(src).toContain('typeId === "minecraft:player"');
  });

  it("army debug command has per-player rate-limit cooldown (100 ticks = 5 seconds)", () => {
    const src = readMain();
    expect(src).toContain("lastArmySpawnTickByPlayer");
    expect(src).toContain(">= 100");
  });

  it("CastleSystem validates blueprint item type before processing", () => {
    const src = readSystem("CastleSystem.ts");
    expect(src).toContain('startsWith("mk:mk_blueprint_")');
  });

  it("CastleSystem validates raycast result before using (look-at-ground guard)", () => {
    const src = readSystem("CastleSystem.ts");
    expect(src).toContain("if (!rayResult)");
    expect(src).toContain("CASTLE_LOOK_AT_GROUND");
  });

  it("ArmySystem validates player.isValid before recruit attempt", () => {
    const src = readSystem("ArmySystem.ts");
    expect(src).toContain("if (!player.isValid)");
  });

  it("SiegeSystem guards against double-start", () => {
    const src = readSystem("SiegeSystem.ts");
    expect(src).toContain("if (this.siegeActive)");
  });

  it("DayCounterSystem.setDay clamps input to [0, MAX_DAY] internally", () => {
    // Validation lives inside setDay() as the authoritative enforcement point
    const src = readSystem("DayCounterSystem.ts");
    expect(src).toContain("Math.max(0, Math.min(");
    expect(src).toContain("DayCounterSystem.MAX_DAY");
  });
});

// ---------------------------------------------------------------------------

describe("Deferred World Mutation Pattern", () => {
  it("CombatSystem defers entity spawn via system.run (world mutation guard)", () => {
    const src = readSystem("CombatSystem.ts");
    expect(src).toContain("system.run(");
    expect(src).toContain("this.army.recruitAlly");
  });

  it("SiegeSystem defers defeat check via system.run after player death", () => {
    const src = readSystem("SiegeSystem.ts");
    // Player death handling uses system.run to avoid mutating during event
    expect(src).toContain("system.run(");
    expect(src).toContain('"minecraft:player"');
  });

  it("ArmySystem uses system.runJob for staggered debug ally spawning", () => {
    const src = readSystem("ArmySystem.ts");
    expect(src).toContain("system.runJob(");
  });

  it("SiegeSystem uses system.runJob for staggered wave spawning", () => {
    const src = readSystem("SiegeSystem.ts");
    expect(src).toContain("system.runJob(");
  });

  it("CastleSystem uses system.runJob for staggered command-based building", () => {
    const src = readSystem("CastleSystem.ts");
    expect(src).toContain("system.runJob(");
  });

  it("MilestoneEvents uses system.runJob for staggered enemy spawning", () => {
    const src = readData("MilestoneEvents.ts");
    expect(src).toContain("system.runJob(");
  });
});

// ---------------------------------------------------------------------------

describe("Entity Tag Conventions", () => {
  it("ArmySystem uses mk_army tag for ally identification", () => {
    const src = readSystem("ArmySystem.ts");
    expect(src).toContain('"mk_army"');
  });

  it("ArmySystem owner tag format is mk_owner_<sanitized_name>", () => {
    const src = readSystem("ArmySystem.ts");
    // Template literal uses mk_owner_ prefix (not a quoted string)
    expect(src).toContain("mk_owner_");
    expect(src).toContain("sanitizePlayerTag");
  });

  it("ArmySystem death listener reads mk:owner_name dynamic property", () => {
    const src = readSystem("ArmySystem.ts");
    expect(src).toContain('"mk:owner_name"');
  });

  it("SiegeSystem uses mk_siege_mob tag for enemy tracking", () => {
    const src = readSystem("SiegeSystem.ts");
    expect(src).toContain('"mk_siege_mob"');
  });

  it("main.ts uses mk_script_spawned to skip gating for milestone-spawned entities", () => {
    const src = readMain();
    expect(src).toContain('"mk_script_spawned"');
  });

  it("MilestoneEvents tags all spawned entities with mk_script_spawned", () => {
    const src = readData("MilestoneEvents.ts");
    expect(src).toContain('"mk_script_spawned"');
  });

  it("MilestoneEvents tag matches the skip-gating check in main.ts", () => {
    const mainSrc = readMain();
    const milestoneSrc = readData("MilestoneEvents.ts");
    // Extract the exact tag string from both files
    const mainTag = mainSrc.match(/"mk_script_spawned"/)?.[0];
    const milestoneTag = milestoneSrc.match(/"mk_script_spawned"/)?.[0];
    expect(mainTag).toBe(milestoneTag);
  });
});

// ---------------------------------------------------------------------------

describe("Dynamic Property Defensive Clamping", () => {
  it("ArmySystem clamps army_size read to [0, GLOBAL_ARMY_CAP]", () => {
    const src = readSystem("ArmySystem.ts");
    expect(src).toContain("Math.max(");
    expect(src).toContain("Math.min(GLOBAL_ARMY_CAP,");
  });

  it("CombatSystem clamps kills to non-negative", () => {
    const src = readSystem("CombatSystem.ts");
    // Prevents negative kill counts from corrupt dynamic property
    expect(src).toContain("Math.max(0,");
  });

  it("DayCounterSystem clamps HUD tier index to valid range", () => {
    const src = readSystem("DayCounterSystem.ts");
    expect(src).toContain("ARMOR_TIERS.length - 1");
    expect(src).toContain("Math.min(");
    expect(src).toContain("Math.max(");
  });

  it("DayCounterSystem clamps HUD army_size to non-negative", () => {
    const src = readSystem("DayCounterSystem.ts");
    // Validates both Math.max(0, ...) for army_size and Math.max(0, ...) for armyBonus
    const maxZeroCount = (src.match(/Math\.max\(0,/g) ?? []).length;
    expect(maxZeroCount).toBeGreaterThanOrEqual(2);
  });

  it("SiegeSystem clamps siegeMobCount to non-negative on death event", () => {
    const src = readSystem("SiegeSystem.ts");
    expect(src).toContain("Math.max(0, this.siegeMobCount - 1)");
  });
});

// ---------------------------------------------------------------------------

describe("Player Validity Checks", () => {
  it("DayCounterSystem checks player.isValid in HUD loop", () => {
    const src = readSystem("DayCounterSystem.ts");
    expect(src).toContain("player.isValid");
  });

  it("ArmySystem checks entity.isValid before recruit", () => {
    const src = readSystem("ArmySystem.ts");
    expect(src).toContain(".isValid");
  });

  it("SiegeSystem checks player.isValid in spawn loop", () => {
    const src = readSystem("SiegeSystem.ts");
    expect(src).toContain(".isValid");
  });

  it("SiegeSystem checks cachedPlayer?.isValid before reading location", () => {
    const src = readSystem("SiegeSystem.ts");
    expect(src).toContain("cachedPlayer?.isValid");
  });

  it("ArmorTierSystem checks player.isValid in tier unlock loop", () => {
    const src = readSystem("ArmorTierSystem.ts");
    expect(src).toContain("player.isValid");
  });

  it("main.ts entitySpawn handler checks entity.isValid before gating", () => {
    const src = readMain();
    expect(src).toContain("entity.isValid");
  });
});

// ---------------------------------------------------------------------------

describe("Castle Build Commands Quality", () => {
  it("CastleSystem has all 3 build methods defined", () => {
    const src = readSystem("CastleSystem.ts");
    expect(src).toContain("buildSmallTower");
    expect(src).toContain("buildGatehouse");
    expect(src).toContain("buildGreatHall");
  });

  it("build methods use fill and setblock Minecraft commands", () => {
    const src = readSystem("CastleSystem.ts");
    expect(src).toContain("`fill ");
    expect(src).toContain("`setblock ");
  });

  it("fallback builder runs exactly 2 commands per tick (Switch budget)", () => {
    const src = readSystem("CastleSystem.ts");
    expect(src).toContain("CMDS_PER_TICK = 2");
  });

  it("each blueprint has a matching case in getBuildCommands", () => {
    const src = readSystem("CastleSystem.ts");
    expect(src).toContain('case "small_tower"');
    expect(src).toContain('case "gatehouse"');
    expect(src).toContain('case "great_hall"');
  });

  it("getBuildCommands returns empty array for unknown blueprint ID (safe default)", () => {
    const src = readSystem("CastleSystem.ts");
    expect(src).toContain("default:");
    expect(src).toContain("return []");
  });

  it("structure placement tries structureManager first, falls back to commands", () => {
    const src = readSystem("CastleSystem.ts");
    expect(src).toContain("world.structureManager.place(");
    expect(src).toContain("buildFallbackStaggered");
  });
});
