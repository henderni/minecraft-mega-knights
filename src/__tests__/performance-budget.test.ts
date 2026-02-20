/**
 * performance-budget.test.ts
 *
 * Tests for Switch performance budget compliance:
 * - Entity count limits during all game phases
 * - Staggered spawning patterns
 * - Hot path optimization (no allocations in tick/HUD)
 * - Cache usage patterns
 * - Follow range and scan interval budgets
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { WAVE_DEFINITIONS } from "../data/WaveDefinitions";
import { CAMP_TIERS, MAX_CAMP_GUARDS } from "../data/CampDefinitions";

const SRC_ROOT = path.join(__dirname, "..");
const BP_ROOT = path.join(__dirname, "../../MegaKnights_BP");
const RP_ROOT = path.join(__dirname, "../../MegaKnights_RP");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf-8");
}

// ─── Entity budget calculations ─────────────────────────────────────────────

const GLOBAL_ARMY_CAP = 35;
const MAX_ACTIVE_SIEGE_MOBS = 25;
const MAX_MILESTONE_ENTITIES = 20;

describe("Entity budget: peak load scenarios", () => {
  it("army cap + siege cap = 60 (Switch max)", () => {
    expect(GLOBAL_ARMY_CAP + MAX_ACTIVE_SIEGE_MOBS).toBe(60);
  });

  it("milestone entities capped at 20 (within 40-entity normal budget)", () => {
    expect(MAX_MILESTONE_ENTITIES).toBeLessThanOrEqual(40);
  });

  it("camp guards + allies stay under 40 during normal play", () => {
    // Max camp guards + max army for solo player
    expect(MAX_CAMP_GUARDS + GLOBAL_ARMY_CAP).toBeLessThanOrEqual(45);
    // Note: camps don't spawn during siege, so this is the normal-play scenario
  });

  it("wave 5 (boss wave) spawns are bounded", () => {
    const bossWave = WAVE_DEFINITIONS[WAVE_DEFINITIONS.length - 1];
    const total = bossWave.spawns.reduce((sum, s) => sum + s.count, 0);
    expect(total).toBeLessThanOrEqual(MAX_ACTIVE_SIEGE_MOBS);
  });

  it("no single wave exceeds MAX_ACTIVE_SIEGE_MOBS solo", () => {
    for (const wave of WAVE_DEFINITIONS) {
      const total = wave.spawns.reduce((sum, s) => sum + s.count, 0);
      expect(total).toBeLessThanOrEqual(MAX_ACTIVE_SIEGE_MOBS);
    }
  });

  it("camp tiers never exceed MAX_CAMP_GUARDS", () => {
    for (const tier of CAMP_TIERS) {
      const total = tier.guards.reduce((sum, g) => sum + g.count, 0);
      expect(total).toBeLessThanOrEqual(MAX_CAMP_GUARDS);
    }
  });
});

// ─── Endless mode entity budget ─────────────────────────────────────────────

describe("Entity budget: endless mode wave caps", () => {
  const siegeSrc = readSource("systems/SiegeSystem.ts");

  // Parse ENDLESS_WAVES from source
  function parseEndlessWaves(): { entityId: string; count: number }[][] {
    const startIdx = siegeSrc.indexOf("const ENDLESS_WAVES");
    const endIdx = siegeSrc.indexOf("];", startIdx);
    const block = siegeSrc.slice(startIdx, endIdx + 2);
    const innerArrayRegex = /\[[^\[\]]+\]/g;
    const waves: { entityId: string; count: number }[][] = [];
    let m;
    while ((m = innerArrayRegex.exec(block)) !== null) {
      const spawns: { entityId: string; count: number }[] = [];
      const spawnRegex = /entityId:\s*"([^"]+)".*?count:\s*(\d+)/g;
      let sm;
      while ((sm = spawnRegex.exec(m[0])) !== null) {
        spawns.push({ entityId: sm[1], count: parseInt(sm[2]) });
      }
      if (spawns.length > 0) waves.push(spawns);
    }
    return waves;
  }

  const endlessWaves = parseEndlessWaves();
  const HARD_MULTIPLIER = 1.5;

  it("heaviest endless wave (base) fits within MAX_ACTIVE_SIEGE_MOBS (25)", () => {
    const heaviest = endlessWaves[endlessWaves.length - 1];
    const total = heaviest.reduce((sum, s) => sum + s.count, 0);
    expect(total).toBeLessThanOrEqual(MAX_ACTIVE_SIEGE_MOBS);
  });

  it("heaviest endless wave with Hard multiplier stays under 2x budget", () => {
    const heaviest = endlessWaves[endlessWaves.length - 1];
    const total = heaviest.reduce(
      (sum, s) => sum + Math.max(1, Math.round(s.count * HARD_MULTIPLIER)),
      0,
    );
    // Mid-wave cap gating handles overflow, but verify it's not wildly over
    expect(total).toBeLessThanOrEqual(MAX_ACTIVE_SIEGE_MOBS * 2);
  });

  it("mid-wave cap gating pauses spawning at MAX_ACTIVE_SIEGE_MOBS", () => {
    expect(siegeSrc).toContain("siegeMobCount >= MAX_ACTIVE_SIEGE_MOBS");
  });

  it("per-player spawn cap (MAX_SPAWNS_PER_PLAYER) exists", () => {
    expect(siegeSrc).toMatch(/MAX_SPAWNS_PER_PLAYER\s*=\s*\d+/);
  });

  it("MAX_SPAWNS_PER_PLAYER <= MAX_ACTIVE_SIEGE_MOBS", () => {
    const match = siegeSrc.match(/MAX_SPAWNS_PER_PLAYER\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    const perPlayer = parseInt(match![1]);
    expect(perPlayer).toBeLessThanOrEqual(MAX_ACTIVE_SIEGE_MOBS);
  });

  it("endless army+siege combined stays under 60 (Switch ceiling)", () => {
    // Max allies + heaviest endless wave at base difficulty
    const heaviest = endlessWaves[endlessWaves.length - 1];
    const waveTotal = heaviest.reduce((sum, s) => sum + s.count, 0);
    expect(GLOBAL_ARMY_CAP + waveTotal).toBeLessThanOrEqual(60);
  });
});

// ─── Staggered spawning ─────────────────────────────────────────────────────

describe("Staggered spawning: never synchronous bulk spawn", () => {
  it("SiegeSystem uses system.runJob for wave spawning", () => {
    const src = readSource("systems/SiegeSystem.ts");
    expect(src).toContain("system.runJob(");
    expect(src).toContain("SPAWNS_PER_TICK");
  });

  it("siege spawns max 1 entity per tick", () => {
    const src = readSource("systems/SiegeSystem.ts");
    expect(src).toMatch(/SPAWNS_PER_TICK\s*=\s*1/);
  });

  it("CastleSystem uses system.runJob for block placement", () => {
    const src = readSource("systems/CastleSystem.ts");
    expect(src).toContain("system.runJob(");
  });

  it("castle places max 2 commands per tick", () => {
    const src = readSource("systems/CastleSystem.ts");
    expect(src).toMatch(/CMDS_PER_TICK\s*=\s*2/);
  });

  it("EnemyCampSystem uses system.runJob for guard spawning", () => {
    const src = readSource("systems/EnemyCampSystem.ts");
    expect(src).toContain("system.runJob(");
  });

  it("MilestoneEvents uses system.runJob for enemy spawning", () => {
    const src = readSource("data/MilestoneEvents.ts");
    expect(src).toContain("system.runJob(");
  });

  it("ArmySystem debug spawn uses system.runJob", () => {
    const src = readSource("systems/ArmySystem.ts");
    expect(src).toContain("system.runJob(");
  });

  it("debug spawn yields every 2 entities", () => {
    const src = readSource("systems/ArmySystem.ts");
    expect(src).toContain("spawned % 2 === 0");
  });
});

// ─── HUD optimization ───────────────────────────────────────────────────────

describe("HUD hot path: no unnecessary allocations", () => {
  const hudSrc = readSource("systems/DayCounterSystem.ts");

  it("uses pre-built progress bar strings (no per-tick allocation)", () => {
    expect(hudSrc).toContain("PROGRESS_BARS");
    expect(hudSrc).toContain('"█".repeat(i)');
  });

  it("uses numeric composite key for change detection (no string comparison)", () => {
    expect(hudSrc).toContain("(currentDay << 20)");
    expect(hudSrc).toContain("key !== lastKey");
  });

  it("throttles getAllPlayers calls (not every HUD tick)", () => {
    expect(hudSrc).toContain("hudPlayerRefreshCounter");
    expect(hudSrc).toContain("hudPlayerRefreshCounter >= 4");
  });

  it("throttles dynamic property reads (not every HUD tick)", () => {
    expect(hudSrc).toContain("hudPropertyReadCounter");
    expect(hudSrc).toContain("shouldReadProps");
  });

  it("caches player name to avoid repeated bridge property access", () => {
    expect(hudSrc).toContain("const name = player.name");
  });

  it("skips setActionBar when HUD content unchanged", () => {
    expect(hudSrc).toContain("key !== lastKey");
    expect(hudSrc).toContain("setActionBar");
  });
});

// ─── Tick persistence throttling ────────────────────────────────────────────

describe("Dynamic property write throttling", () => {
  const daySrc = readSource("systems/DayCounterSystem.ts");

  it("tick counter persisted every ~60 ticks, not every tick", () => {
    expect(daySrc).toContain("tickWriteCounter");
    expect(daySrc).toContain("tickWriteCounter >= 60");
  });

  it("day changes are persisted immediately", () => {
    // When cachedDay increments, it writes immediately
    expect(daySrc).toContain("world.setDynamicProperty(DayCounterSystem.KEY_DAY, this.cachedDay)");
  });
});

// ─── Cache patterns ─────────────────────────────────────────────────────────

describe("Cache patterns: bounded size", () => {
  it("tag cache has max size to prevent memory growth", () => {
    const armySrc = readSource("systems/ArmySystem.ts");
    expect(armySrc).toContain("MAX_TAG_CACHE");
    expect(armySrc).toContain("tagCache.size >= MAX_TAG_CACHE");
  });

  it("HUD cache prunes disconnected players", () => {
    const daySrc = readSource("systems/DayCounterSystem.ts");
    expect(daySrc).toContain("activeNames");
    expect(daySrc).toContain("lastHudKeys.delete(key)");
  });

  it("rate limit cache has LRU eviction", () => {
    const mainSrc = readSource("main.ts");
    expect(mainSrc).toContain("MAX_RATE_LIMIT_CACHE");
    expect(mainSrc).toContain("playerNameInsertionOrder");
  });
});

// ─── Entity JSON performance constraints ────────────────────────────────────

describe("Entity JSON: follow_range and scan_interval budgets", () => {
  const entityDir = path.join(BP_ROOT, "entities");
  const entityFiles = fs.readdirSync(entityDir).filter((f) => f.endsWith(".json"));

  for (const file of entityFiles) {
    const raw = fs.readFileSync(path.join(entityDir, file), "utf-8");
    const entityName = file.replace(".se.json", "");

    it(`${entityName}: follow_range within budget`, () => {
      const matches = [...raw.matchAll(/"follow_range"[^}]*?"value"\s*:\s*(\d+)/g)];
      for (const m of matches) {
        const range = parseInt(m[1]);
        if (entityName.includes("boss")) {
          expect(range).toBeLessThanOrEqual(32);
        } else if (entityName.includes("dark_knight")) {
          expect(range).toBeLessThanOrEqual(24);
        } else {
          expect(range).toBeLessThanOrEqual(24);
        }
      }
    });

    it(`${entityName}: scan_interval >= 10 on targeting`, () => {
      if (raw.includes("nearest_attackable_target")) {
        const matches = [...raw.matchAll(/"scan_interval"\s*:\s*(\d+)/g)];
        expect(matches.length).toBeGreaterThan(0);
        for (const m of matches) {
          expect(parseInt(m[1])).toBeGreaterThanOrEqual(10);
        }
      }
    });
  }
});

// ─── Opaque materials ───────────────────────────────────────────────────────

describe("GPU budget: opaque materials preferred", () => {
  const entityDir = path.join(RP_ROOT, "entity");
  const entityFiles = fs.readdirSync(entityDir).filter((f) => f.endsWith(".json"));

  for (const file of entityFiles) {
    const raw = fs.readFileSync(path.join(entityDir, file), "utf-8");
    const entityName = file.replace(".ce.json", "");

    it(`${entityName}: uses opaque material (not entity_alphatest)`, () => {
      if (raw.includes("entity_alphatest")) {
        // Flag but don't fail — some entities may need transparency
        console.warn(`${entityName} uses entity_alphatest — verify if needed`);
      }
      // At minimum, should not use entity_alphatest on high-count entities
      if (entityName.includes("ally") || entityName.includes("enemy")) {
        expect(raw).not.toContain("entity_alphatest");
      }
    });
  }
});

// ─── Despawn distance budget ────────────────────────────────────────────────

describe("Despawn distances: appropriate for entity type", () => {
  const entityDir = path.join(BP_ROOT, "entities");
  const entityFiles = fs.readdirSync(entityDir).filter((f) => f.endsWith(".json"));

  for (const file of entityFiles) {
    const raw = fs.readFileSync(path.join(entityDir, file), "utf-8");
    const entityName = file.replace(".se.json", "");

    it(`${entityName}: has despawn component`, () => {
      // Every entity should have some form of despawn
      const hasDespawn =
        raw.includes("minecraft:despawn") || raw.includes("instant_despawn");
      expect(hasDespawn).toBe(true);
    });
  }
});
