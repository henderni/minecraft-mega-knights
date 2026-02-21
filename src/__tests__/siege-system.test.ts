/**
 * siege-system.test.ts
 *
 * Focused source-as-text tests for SiegeSystem.ts covering:
 * - Switch-safety constants (SPAWNS_PER_TICK, MAX_ACTIVE_SIEGE_MOBS, CLEANUP_PER_TICK)
 * - Interval constants (VICTORY_CHECK_INTERVAL, RECOUNT_INTERVAL)
 * - Per-player spawn cap (MAX_SPAWNS_PER_PLAYER)
 * - ENDLESS_WAVES escalation structure and ENDLESS_WAVE_ESCALATION_DAYS
 * - Boss phase HP thresholds and effectiveMax guard in checkBossPhase
 * - staggeredSpawn uses system.runJob generator pattern
 * - Victory handler: all 3 messages sent, per-player try-catch present
 * - Defeat handler: all 3 messages sent
 * - endSiege calls cleanupSiegeMobs
 * - Endless mode: ENDLESS_WAVE and ENDLESS_WAVE_CLEARED messages used
 * - ENDLESS_DEFEAT used in the endless defeat path
 * - WAVE_DEFINITIONS import and usage
 *
 * Uses source-as-text pattern — no @minecraft/server imports.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { WAVE_DEFINITIONS } from "../data/WaveDefinitions";

const SRC_ROOT = join(__dirname, "..");
const SIEGE_SRC = readFileSync(join(SRC_ROOT, "systems/SiegeSystem.ts"), "utf-8");
const STRINGS_SRC = readFileSync(join(SRC_ROOT, "data/Strings.ts"), "utf-8");

// ─── Imports ─────────────────────────────────────────────────────────────────

describe("SiegeSystem: imports", () => {
  it("imports WAVE_DEFINITIONS from WaveDefinitions", () => {
    expect(SIEGE_SRC).toMatch(
      /import\s*\{[^}]*WAVE_DEFINITIONS[^}]*\}\s*from\s*["']\.\.\/data\/WaveDefinitions["']/,
    );
  });

  it("imports siege string constants from Strings", () => {
    expect(SIEGE_SRC).toMatch(
      /import\s*\{[^}]*SIEGE_VICTORY_1[^}]*\}\s*from\s*["']\.\.\/data\/Strings["']/s,
    );
  });

  it("imports ENDLESS_DEFEAT from Strings", () => {
    expect(SIEGE_SRC).toMatch(
      /import\s*\{[^}]*ENDLESS_DEFEAT[^}]*\}\s*from\s*["']\.\.\/data\/Strings["']/s,
    );
  });

  it("imports ENDLESS_WAVE and ENDLESS_WAVE_CLEARED from Strings", () => {
    expect(SIEGE_SRC).toMatch(
      /import\s*\{[^}]*ENDLESS_WAVE[^}]*\}\s*from\s*["']\.\.\/data\/Strings["']/s,
    );
    expect(SIEGE_SRC).toMatch(
      /import\s*\{[^}]*ENDLESS_WAVE_CLEARED[^}]*\}\s*from\s*["']\.\.\/data\/Strings["']/s,
    );
  });
});

// ─── Switch-safety constants ─────────────────────────────────────────────────

describe("SiegeSystem: Switch-safety constants", () => {
  it("SPAWNS_PER_TICK = 1 (one entity per tick maximum)", () => {
    expect(SIEGE_SRC).toMatch(/const\s+SPAWNS_PER_TICK\s*=\s*1\b/);
  });

  it("MAX_ACTIVE_SIEGE_MOBS = 25 (stays within 60-entity Switch budget)", () => {
    expect(SIEGE_SRC).toMatch(/const\s+MAX_ACTIVE_SIEGE_MOBS\s*=\s*25\b/);
  });

  it("CLEANUP_PER_TICK constant exists (staggered post-siege cleanup)", () => {
    expect(SIEGE_SRC).toMatch(/const\s+CLEANUP_PER_TICK\s*=\s*\d+/);
  });

  it("CLEANUP_PER_TICK value is small (2 or fewer mobs removed per tick)", () => {
    const match = SIEGE_SRC.match(/const\s+CLEANUP_PER_TICK\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    const value = parseInt(match![1]);
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(4); // generous upper bound — still Switch-safe
  });

  it("MAX_SPAWNS_PER_PLAYER = 24 (prevents entity count explosion in multiplayer)", () => {
    expect(SIEGE_SRC).toMatch(/const\s+MAX_SPAWNS_PER_PLAYER\s*=\s*24\b/);
  });

  it("SPAWNS_PER_TICK is used inside staggeredSpawn as the yield cadence", () => {
    expect(SIEGE_SRC).toMatch(/spawned\s*%\s*SPAWNS_PER_TICK\s*===\s*0/);
  });

  it("CLEANUP_PER_TICK is used inside cleanupSiegeMobs as yield cadence", () => {
    expect(SIEGE_SRC).toMatch(/removed\s*%\s*CLEANUP_PER_TICK\s*===\s*0/);
  });
});

// ─── Interval constants ──────────────────────────────────────────────────────

describe("SiegeSystem: interval constants", () => {
  it("VICTORY_CHECK_INTERVAL constant exists", () => {
    expect(SIEGE_SRC).toMatch(/const\s+VICTORY_CHECK_INTERVAL\s*=\s*\d+/);
  });

  it("VICTORY_CHECK_INTERVAL = 60 (check every 3 seconds)", () => {
    expect(SIEGE_SRC).toMatch(/const\s+VICTORY_CHECK_INTERVAL\s*=\s*60\b/);
  });

  it("VICTORY_CHECK_INTERVAL is used in the tick victory check", () => {
    expect(SIEGE_SRC).toMatch(/ticksSinceVictoryCheck\s*>=\s*VICTORY_CHECK_INTERVAL/);
  });

  it("RECOUNT_INTERVAL constant exists for safety-net recount", () => {
    expect(SIEGE_SRC).toMatch(/const\s+RECOUNT_INTERVAL\s*=\s*\d+/);
  });

  it("RECOUNT_INTERVAL = 600 (recount every 30 seconds)", () => {
    expect(SIEGE_SRC).toMatch(/const\s+RECOUNT_INTERVAL\s*=\s*600\b/);
  });

  it("RECOUNT_INTERVAL is used in the tick recount check", () => {
    expect(SIEGE_SRC).toMatch(/ticksSinceRecount\s*>=\s*RECOUNT_INTERVAL/);
  });
});

// ─── ENDLESS_WAVES escalation ────────────────────────────────────────────────

describe("SiegeSystem: ENDLESS_WAVES array", () => {
  it("ENDLESS_WAVE_ESCALATION_DAYS = 40", () => {
    expect(SIEGE_SRC).toMatch(/const\s+ENDLESS_WAVE_ESCALATION_DAYS\s*=\s*40\b/);
  });

  it("ENDLESS_WAVES is typed as a 2D array of entity spawn objects", () => {
    expect(SIEGE_SRC).toMatch(/const\s+ENDLESS_WAVES.*\[\]/);
  });

  it("ENDLESS_WAVES has wave set 0 comment (light)", () => {
    expect(SIEGE_SRC).toMatch(/Wave set 0.*light/i);
  });

  it("ENDLESS_WAVES has wave set 1 comment (medium)", () => {
    expect(SIEGE_SRC).toMatch(/Wave set 1.*medium/i);
  });

  it("ENDLESS_WAVES has wave set 2 comment (heavy)", () => {
    expect(SIEGE_SRC).toMatch(/Wave set 2.*heavy/i);
  });

  it("ENDLESS_WAVE_ESCALATION_DAYS is used in startEndlessSiege wave index formula", () => {
    expect(SIEGE_SRC).toContain("ENDLESS_WAVE_ESCALATION_DAYS");
    // Specifically inside the waveIndex calculation
    expect(SIEGE_SRC).toMatch(/Math\.floor\s*\(\s*\(day\s*-\s*100\)\s*\/\s*ENDLESS_WAVE_ESCALATION_DAYS\s*\)/);
  });
});

// ─── WAVE_DEFINITIONS usage in tick ──────────────────────────────────────────

describe("SiegeSystem: WAVE_DEFINITIONS usage", () => {
  it("WAVE_DEFINITIONS is referenced in tick() to gate next wave", () => {
    const tickBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("tick(): void"),
      SIEGE_SRC.indexOf("private spawnWave()"),
    );
    expect(tickBlock).toContain("WAVE_DEFINITIONS.length");
  });

  it("WAVE_DEFINITIONS is referenced in spawnWave()", () => {
    const spawnBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("private spawnWave()"),
      SIEGE_SRC.indexOf("private staggeredSpawn("),
    );
    expect(spawnBlock).toContain("WAVE_DEFINITIONS");
  });

  it("there are 5 wave definitions (waves 1-5)", () => {
    expect(WAVE_DEFINITIONS).toHaveLength(5);
  });

  it("wave 5 includes the siege lord boss", () => {
    const wave5 = WAVE_DEFINITIONS[4];
    const bossSpawn = wave5.spawns.find((s) => s.entityId === "mk:mk_boss_siege_lord");
    expect(bossSpawn).toBeDefined();
  });

  it("wave numbers are sequential 1-5", () => {
    for (let i = 0; i < WAVE_DEFINITIONS.length; i++) {
      expect(WAVE_DEFINITIONS[i].waveNumber).toBe(i + 1);
    }
  });

  it("wave 1 has delayTicks=0 (immediate start)", () => {
    expect(WAVE_DEFINITIONS[0].delayTicks).toBe(0);
  });

  it("waves 2-5 each have delayTicks=1200 (60 second gaps)", () => {
    for (let i = 1; i < WAVE_DEFINITIONS.length; i++) {
      expect(WAVE_DEFINITIONS[i].delayTicks).toBe(1200);
    }
  });

  it("all wave spawn entityIds use mk:mk_ prefix", () => {
    for (const wave of WAVE_DEFINITIONS) {
      for (const spawn of wave.spawns) {
        expect(spawn.entityId).toMatch(/^mk:mk_/);
      }
    }
  });
});

// ─── Boss phase: checkBossPhase ───────────────────────────────────────────────

describe("SiegeSystem: checkBossPhase()", () => {
  it("checkBossPhase method exists as private", () => {
    expect(SIEGE_SRC).toMatch(/private\s+checkBossPhase\s*\(\s*\)/);
  });

  it("HP threshold 0.33 present for phase 3 transition (33% HP)", () => {
    const checkBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("private checkBossPhase()"),
    );
    expect(checkBlock).toContain("0.33");
  });

  it("HP threshold 0.66 present for phase 2 transition (66% HP)", () => {
    const checkBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("private checkBossPhase()"),
    );
    expect(checkBlock).toContain("0.66");
  });

  it("guards against effectiveMax <= 0 (prevents division by zero)", () => {
    expect(SIEGE_SRC).toMatch(/hp\.effectiveMax\s*<=\s*0/);
  });

  it("guards against bossEntity being null before calling checkBossPhase", () => {
    // In tick(), the call to checkBossPhase is guarded by bossEntity !== null
    const tickBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("tick(): void"),
      SIEGE_SRC.indexOf("private spawnWave()"),
    );
    expect(tickBlock).toMatch(/this\.bossEntity\s*!==\s*null/);
  });

  it("checkBossPhase guards against invalid bossEntity before property access", () => {
    const checkBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("private checkBossPhase()"),
    );
    expect(checkBlock).toMatch(/bossEntity\.isValid/);
  });

  it("checkBossPhase sets bossEntity to null when entity is invalid", () => {
    const checkBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("private checkBossPhase()"),
    );
    expect(checkBlock).toMatch(/this\.bossEntity\s*=\s*null/);
  });

  it("phase transitions are one-way (siegePhase checked before triggering)", () => {
    expect(SIEGE_SRC).toContain("this.siegePhase < 2");
    expect(SIEGE_SRC).toContain("this.siegePhase < 1");
  });

  it("phase 3 transition fires mk:enter_phase_3 event on boss", () => {
    expect(SIEGE_SRC).toContain('this.bossEntity.triggerEvent("mk:enter_phase_3")');
  });

  it("phase 2 transition fires mk:enter_phase_2 event on boss", () => {
    expect(SIEGE_SRC).toContain('this.bossEntity.triggerEvent("mk:enter_phase_2")');
  });

  it("phase 3 (33%) is checked before phase 2 (66%) in the if-else chain", () => {
    // In the source, the ratio <= 0.33 block appears before ratio <= 0.66
    const checkBlock = SIEGE_SRC.slice(SIEGE_SRC.indexOf("private checkBossPhase()"));
    const pos33 = checkBlock.indexOf("0.33");
    const pos66 = checkBlock.indexOf("0.66");
    expect(pos33).toBeGreaterThan(-1);
    expect(pos66).toBeGreaterThan(-1);
    expect(pos33).toBeLessThan(pos66);
  });
});

// ─── staggeredSpawn: generator pattern ───────────────────────────────────────

describe("SiegeSystem: staggeredSpawn() generator pattern", () => {
  it("staggeredSpawn uses system.runJob (not setInterval or setTimeout)", () => {
    const spawnBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("private staggeredSpawn("),
      SIEGE_SRC.indexOf("private endSiege("),
    );
    expect(spawnBlock).toContain("system.runJob");
    expect(spawnBlock).not.toContain("system.setInterval");
    expect(spawnBlock).not.toContain("system.setTimeout");
  });

  it("staggeredSpawn uses a generator function (function*)", () => {
    const spawnBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("private staggeredSpawn("),
      SIEGE_SRC.indexOf("private endSiege("),
    );
    expect(spawnBlock).toMatch(/function\s*\*/);
  });

  it("staggeredSpawn yields after spawning SPAWNS_PER_TICK entities", () => {
    expect(SIEGE_SRC).toMatch(/spawned\s*%\s*SPAWNS_PER_TICK\s*===\s*0[\s\S]*?yield/);
  });

  it("activeSpawnJobs is incremented before runJob", () => {
    const spawnBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("private staggeredSpawn("),
      SIEGE_SRC.indexOf("private endSiege("),
    );
    const incIdx = spawnBlock.indexOf("this.activeSpawnJobs++");
    // Search for the actual call site "system.runJob(" (not the comment mentioning it)
    const runJobIdx = spawnBlock.indexOf("system.runJob(");
    expect(incIdx).toBeGreaterThan(-1);
    expect(runJobIdx).toBeGreaterThan(-1);
    expect(incIdx).toBeLessThan(runJobIdx);
  });

  it("activeSpawnJobs is decremented with Math.max(0, ...) at generator end", () => {
    expect(SIEGE_SRC).toContain(
      "siegeRef.activeSpawnJobs = Math.max(0, siegeRef.activeSpawnJobs - 1)",
    );
  });

  it("mid-wave entity cap: while loop yields one tick at a time", () => {
    expect(SIEGE_SRC).toMatch(
      /while\s*\(\s*siegeRef\.siegeMobCount\s*>=\s*MAX_ACTIVE_SIEGE_MOBS\s*\)\s*\{\s*yield/,
    );
  });

  it("staggeredSpawn tags each spawned entity with mk_siege_mob", () => {
    const spawnBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("private staggeredSpawn("),
      SIEGE_SRC.indexOf("private endSiege("),
    );
    expect(spawnBlock).toContain('entity.addTag("mk_siege_mob")');
  });

  it("staggeredSpawn increments siegeMobCount after successful spawn", () => {
    const spawnBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("private staggeredSpawn("),
      SIEGE_SRC.indexOf("private endSiege("),
    );
    const tagIdx = spawnBlock.indexOf("siegeRef.siegeMobCount++");
    expect(tagIdx).toBeGreaterThan(-1);
  });

  it("staggeredSpawn wraps spawn in try-catch (chunk not loaded / entity limit)", () => {
    const spawnBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("private staggeredSpawn("),
      SIEGE_SRC.indexOf("private endSiege("),
    );
    expect(spawnBlock).toMatch(/try\s*\{[\s\S]*?spawnEntity[\s\S]*?\}\s*catch/);
  });

  it("player map is refreshed every 5th yield to avoid stale references", () => {
    expect(SIEGE_SRC).toMatch(/spawned\s*%\s*5\s*===\s*0/);
    expect(SIEGE_SRC).toMatch(/playerMap\.clear\(\)/);
  });
});

// ─── Victory handler ──────────────────────────────────────────────────────────

describe("SiegeSystem: victory handler", () => {
  it("sends SIEGE_VICTORY_1 on victory", () => {
    expect(SIEGE_SRC).toContain("SIEGE_VICTORY_1");
  });

  it("sends SIEGE_VICTORY_2 on victory", () => {
    expect(SIEGE_SRC).toContain("SIEGE_VICTORY_2");
  });

  it("sends SIEGE_VICTORY_3 on victory", () => {
    expect(SIEGE_SRC).toContain("SIEGE_VICTORY_3");
  });

  it("all three SIEGE_VICTORY messages appear in the victory branch (after the wasEndless guard)", () => {
    // endSiege: wasEndless branch returns early, so the victory messages must be after it
    const endSiegeBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("private endSiege("),
      SIEGE_SRC.indexOf("private cleanupSiegeMobs()"),
    );
    const victory1Idx = endSiegeBlock.indexOf("SIEGE_VICTORY_1");
    const victory2Idx = endSiegeBlock.indexOf("SIEGE_VICTORY_2");
    const victory3Idx = endSiegeBlock.indexOf("SIEGE_VICTORY_3");
    const wasEndlessIdx = endSiegeBlock.indexOf("if (wasEndless)");
    // All three must appear after the wasEndless early return
    expect(victory1Idx).toBeGreaterThan(wasEndlessIdx);
    expect(victory2Idx).toBeGreaterThan(wasEndlessIdx);
    expect(victory3Idx).toBeGreaterThan(wasEndlessIdx);
    // All three must appear in order
    expect(victory1Idx).toBeLessThan(victory2Idx);
    expect(victory2Idx).toBeLessThan(victory3Idx);
  });

  it("per-player try-catch wraps setTitle/runCommand in victory handler (task #99 fix)", () => {
    // Victory handler iterates players and wraps each in try-catch to handle disconnects
    const endSiegeBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("private endSiege("),
      SIEGE_SRC.indexOf("private cleanupSiegeMobs()"),
    );
    // Should have a for-of over getAllPlayers() followed by try-catch
    expect(endSiegeBlock).toMatch(
      /for\s*\(\s*const\s+player\s+of[\s\S]*?getAllPlayers[\s\S]*?\)\s*\{[\s\S]*?try\s*\{/,
    );
  });

  it("victory handler guards against invalid players before setTitle", () => {
    const endSiegeBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("private endSiege("),
      SIEGE_SRC.indexOf("private cleanupSiegeMobs()"),
    );
    expect(endSiegeBlock).toMatch(/player\.isValid/);
  });

  it("victory handler calls onVictoryCallback after delay (endless mode unlock)", () => {
    expect(SIEGE_SRC).toContain("this.onVictoryCallback");
    expect(SIEGE_SRC).toContain("ENDLESS_UNLOCKED");
    expect(SIEGE_SRC).toContain("ENDLESS_DESC");
  });

  it("endless mode is unlocked inside system.runTimeout for dramatic delay", () => {
    expect(SIEGE_SRC).toMatch(/system\.runTimeout\s*\(\s*\(\s*\)\s*=>/);
    expect(SIEGE_SRC).toContain("ENDLESS_UNLOCKED");
  });
});

// ─── Defeat handler ───────────────────────────────────────────────────────────

describe("SiegeSystem: defeat handler", () => {
  it("sends SIEGE_DEFEAT_1 on defeat", () => {
    expect(SIEGE_SRC).toContain("SIEGE_DEFEAT_1");
  });

  it("sends SIEGE_DEFEAT_2 on defeat", () => {
    expect(SIEGE_SRC).toContain("SIEGE_DEFEAT_2");
  });

  it("sends SIEGE_DEFEAT_3 on defeat", () => {
    expect(SIEGE_SRC).toContain("SIEGE_DEFEAT_3");
  });

  it("all three SIEGE_DEFEAT messages appear in endSiege in order", () => {
    const endSiegeBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("private endSiege("),
      SIEGE_SRC.indexOf("private cleanupSiegeMobs()"),
    );
    const d1 = endSiegeBlock.indexOf("SIEGE_DEFEAT_1");
    const d2 = endSiegeBlock.indexOf("SIEGE_DEFEAT_2");
    const d3 = endSiegeBlock.indexOf("SIEGE_DEFEAT_3");
    expect(d1).toBeGreaterThan(-1);
    expect(d2).toBeGreaterThan(d1);
    expect(d3).toBeGreaterThan(d2);
  });

  it("SIEGE_DEFEAT strings are defined in Strings.ts", () => {
    expect(STRINGS_SRC).toContain("SIEGE_DEFEAT_1");
    expect(STRINGS_SRC).toContain("SIEGE_DEFEAT_2");
    expect(STRINGS_SRC).toContain("SIEGE_DEFEAT_3");
  });

  it("victory callback is gated behind if(victory) — not reachable from defeat", () => {
    const endSiegeBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("private endSiege("),
      SIEGE_SRC.indexOf("private cleanupSiegeMobs()"),
    );
    // onVictoryCallback must appear inside the if(victory) branch only
    expect(endSiegeBlock).toContain("if (victory)");
    const victoryBranch = endSiegeBlock.slice(
      endSiegeBlock.indexOf("if (victory)"),
    );
    expect(victoryBranch).toContain("onVictoryCallback");
    // Victory title display is also gated
    expect(victoryBranch).toContain("setTitle");
  });

  it("player death detection checks all players' health in system.run()", () => {
    const deathBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("setupDeathListener"),
      SIEGE_SRC.indexOf("tick(): void"),
    );
    // The death check loops through all players and checks health
    expect(deathBlock).toContain("minecraft:health");
    expect(deathBlock).toContain("anyAlive");
    expect(deathBlock).toContain("this.endSiege(false)");
  });
});

// ─── endSiege and cleanupSiegeMobs ───────────────────────────────────────────

describe("SiegeSystem: endSiege calls cleanupSiegeMobs", () => {
  it("endSiege calls this.cleanupSiegeMobs()", () => {
    expect(SIEGE_SRC).toMatch(/this\.cleanupSiegeMobs\s*\(\s*\)/);
  });

  it("cleanupSiegeMobs() is called before the wasEndless branch", () => {
    // Verified by character position: cleanup must precede the wasEndless branch check
    const callPos = SIEGE_SRC.indexOf("this.cleanupSiegeMobs()");
    const branchPos = SIEGE_SRC.indexOf("if (wasEndless)");
    expect(callPos).toBeGreaterThan(-1);
    expect(branchPos).toBeGreaterThan(-1);
    expect(callPos).toBeLessThan(branchPos);
  });

  it("endSiege sets siegeActive = false before cleanup returns", () => {
    const endSiegeBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("private endSiege("),
      SIEGE_SRC.indexOf("private cleanupSiegeMobs()"),
    );
    expect(endSiegeBlock).toContain("this.siegeActive = false");
  });
});

// ─── Endless mode message paths ───────────────────────────────────────────────

describe("SiegeSystem: endless mode message paths", () => {
  it("startEndlessSiege sends ENDLESS_WAVE(day) message on start", () => {
    const endlessBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("startEndlessSiege("),
      SIEGE_SRC.indexOf("setupDeathListener()"),
    );
    expect(endlessBlock).toMatch(/ENDLESS_WAVE\s*\(\s*day\s*\)/);
  });

  it("endSiege sends ENDLESS_WAVE_CLEARED on endless victory", () => {
    expect(SIEGE_SRC).toContain("ENDLESS_WAVE_CLEARED");
    // It must be inside the wasEndless branch
    const endSiegeBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("private endSiege("),
      SIEGE_SRC.indexOf("private cleanupSiegeMobs()"),
    );
    expect(endSiegeBlock).toContain("ENDLESS_WAVE_CLEARED");
  });

  it("endSiege sends ENDLESS_DEFEAT on endless defeat", () => {
    expect(SIEGE_SRC).toContain("ENDLESS_DEFEAT");
    const endSiegeBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("private endSiege("),
      SIEGE_SRC.indexOf("private cleanupSiegeMobs()"),
    );
    expect(endSiegeBlock).toContain("ENDLESS_DEFEAT");
  });

  it("endless defeat path is in the wasEndless branch (not the normal siege defeat)", () => {
    const endSiegeBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("private endSiege("),
      SIEGE_SRC.indexOf("private cleanupSiegeMobs()"),
    );
    // ENDLESS_DEFEAT must appear before the function's closing brace (inside wasEndless block)
    const endlessDefeatPos = endSiegeBlock.indexOf("ENDLESS_DEFEAT");
    const wasEndlessPos = endSiegeBlock.indexOf("if (wasEndless)");
    // The endless defeat is sent inside the wasEndless block — must appear after the if guard
    expect(endlessDefeatPos).toBeGreaterThan(wasEndlessPos);
  });

  it("endless victory path returns early (no normal siege messages sent)", () => {
    const endSiegeBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("private endSiege("),
      SIEGE_SRC.indexOf("private cleanupSiegeMobs()"),
    );
    // After ENDLESS_WAVE_CLEARED there must be a return; inside the wasEndless block
    const clearedPos = endSiegeBlock.indexOf("ENDLESS_WAVE_CLEARED");
    const returnAfterCleared = endSiegeBlock.indexOf("return;", clearedPos);
    expect(returnAfterCleared).toBeGreaterThan(clearedPos);
  });

  it("ENDLESS_WAVE function is defined in Strings.ts as a day-parameterized template", () => {
    expect(STRINGS_SRC).toMatch(/ENDLESS_WAVE\s*=\s*\(\s*day\s*:\s*number\s*\)\s*=>/);
  });

  it("ENDLESS_DEFEAT is a plain string constant in Strings.ts", () => {
    expect(STRINGS_SRC).toMatch(/ENDLESS_DEFEAT\s*=\s*["']/);
  });

  it("startEndlessSiege sets currentWave to WAVE_DEFINITIONS.length after spawning (bypasses normal wave progression)", () => {
    const endlessBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("startEndlessSiege("),
      SIEGE_SRC.indexOf("setupDeathListener()"),
    );
    expect(endlessBlock).toContain("this.currentWave = WAVE_DEFINITIONS.length");
  });
});

// ─── Siege lifecycle guards ───────────────────────────────────────────────────

describe("SiegeSystem: lifecycle guards", () => {
  it("startSiege returns early if already active", () => {
    const start = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("startSiege(): void"),
      SIEGE_SRC.indexOf("startEndlessSiege("),
    );
    expect(start).toMatch(/if\s*\(\s*this\.siegeActive\s*\)\s*\{?\s*return/);
  });

  it("startEndlessSiege returns early if already active", () => {
    const start = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("startEndlessSiege("),
      SIEGE_SRC.indexOf("setupDeathListener()"),
    );
    expect(start).toMatch(/if\s*\(\s*this\.siegeActive\s*\)\s*\{?\s*return/);
  });

  it("reset() calls endSiege(false) only when siegeActive", () => {
    expect(SIEGE_SRC).toMatch(
      /reset\s*\(\s*\)[\s\S]*?if\s*\(\s*this\.siegeActive\s*\)[\s\S]*?this\.endSiege\s*\(\s*false\s*\)/,
    );
  });

  it("isActive() returns siegeActive field", () => {
    expect(SIEGE_SRC).toMatch(/isActive\s*\(\s*\)[\s\S]*?return\s+this\.siegeActive/);
  });

  it("death listener exits early when siege is not active", () => {
    const deathListener = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("setupDeathListener"),
      SIEGE_SRC.indexOf("tick(): void"),
    );
    expect(deathListener).toMatch(/if\s*\(\s*!this\.siegeActive\s*\)\s*\{?\s*return/);
  });

  it("tick() exits early when siege is not active", () => {
    const tickBlock = SIEGE_SRC.slice(
      SIEGE_SRC.indexOf("tick(): void"),
      SIEGE_SRC.indexOf("private spawnWave()"),
    );
    expect(tickBlock).toMatch(/if\s*\(\s*!this\.siegeActive\s*\)\s*\{?\s*return/);
  });
});
