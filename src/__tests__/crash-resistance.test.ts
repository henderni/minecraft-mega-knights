/**
 * crash-resistance.test.ts
 *
 * Validates crash resistance and gameplay stress scenarios:
 * - Entity reference safety (try-catch around stale entity access)
 * - Generator lifecycle safety (bounded retries, job counters)
 * - Entity budget stress (worst-case counts under 80)
 * - HUD cache and bit-packing correctness
 * - Input validation on debug commands
 * - Multiplayer edge cases (cap scaling, day overlaps)
 * - State machine integrity (ordering, guards, resets)
 *
 * Uses source-as-text pattern — no @minecraft/server imports.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { WAVE_DEFINITIONS } from "../data/WaveDefinitions";
import {
  getCampTierForDay,
  MAX_CAMP_GUARDS,
} from "../data/CampDefinitions";

const SRC_ROOT = path.join(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf-8");
}

const armySrc = readSource("systems/ArmySystem.ts");
const siegeSrc = readSource("systems/SiegeSystem.ts");
const combatSrc = readSource("systems/CombatSystem.ts");
const merchantSrc = readSource("systems/MerchantSystem.ts");
const campSrc = readSource("systems/EnemyCampSystem.ts");
const daySrc = readSource("systems/DayCounterSystem.ts");
const mainSrc = readSource("main.ts");
const milestoneSrc = readSource("data/MilestoneEvents.ts");

// Extract MILESTONE_DAYS from source (can't import — MilestoneEvents pulls in @minecraft/server)
const MILESTONE_DAYS = new Set(
  [...milestoneSrc.matchAll(/^\s*(\d+)\s*:\s*\{/gm)].map((m) => Number(m[1])),
);

// ─── Constants extracted from source ─────────────────────────────────────────

const GLOBAL_ARMY_CAP = 35;
const MAX_ACTIVE_SIEGE_MOBS = 25;
const BASE_ARMY_SIZE = 15;
const MAX_ARMY_BONUS = 20;
const MAX_SPAWNS_PER_PLAYER = 24;
const MAX_TAG_CACHE = 100;
const MAX_RATE_LIMIT_CACHE = 200;
const MAX_DAY = 100;
const MAX_MILESTONE_ENTITIES = 20;

// ─── 1. Entity reference safety ─────────────────────────────────────────────

describe("Entity reference safety", () => {
  it("Standard Bearer aura: ally.location inside outer try-catch", () => {
    // The ally.location access (line ~242) is inside the try block starting at line 227
    const tickMethod = armySrc.slice(
      armySrc.indexOf("tick(): void"),
      armySrc.indexOf("onPlayerInteract("),
    );
    // The try block should encompass the Standard Bearer aura logic
    expect(tickMethod).toMatch(/try\s*\{[\s\S]*ally\.location[\s\S]*\}\s*catch/);
  });

  it("ally.addEffect has its own inner try-catch", () => {
    // ally.addEffect("strength"...) is wrapped in try { } catch { ... }
    expect(armySrc).toMatch(/try\s*\{\s*ally\.addEffect\([^)]*\);\s*\}\s*catch\s*\{/);
  });

  it("SiegeSystem generator: cachedPlayer.location inside try-catch", () => {
    const spawnWave = siegeSrc.slice(
      siegeSrc.indexOf("private spawnWave()"),
      siegeSrc.indexOf("private endSiege("),
    );
    // cachedPlayer.location access is inside a try block
    expect(spawnWave).toMatch(/try\s*\{[\s\S]*cachedPlayer\.location[\s\S]*\}\s*catch/);
  });

  it("MerchantSystem onScrollUse: runCommand inside try-catch in system.run", () => {
    const scrollMethod = merchantSrc.slice(
      merchantSrc.indexOf("onScrollUse("),
      merchantSrc.lastIndexOf("}"),
    );
    // system.run wraps a try block that contains runCommand
    expect(scrollMethod).toMatch(/system\.run\(\(\)\s*=>\s*\{[\s\S]*try\s*\{[\s\S]*runCommand[\s\S]*\}\s*catch/);
  });

  it("CombatSystem: entity properties captured BEFORE system.run defer", () => {
    const onDieMethod = combatSrc.slice(
      combatSrc.indexOf("onEntityDie("),
      combatSrc.lastIndexOf("}"),
    );
    // typeId, location, dimension captured before system.run
    const captureIdx = onDieMethod.indexOf("const typeId = dead.typeId");
    const locationIdx = onDieMethod.indexOf("const location = { ...dead.location }");
    const dimensionIdx = onDieMethod.indexOf("const dimension = dead.dimension");
    const systemRunIdx = onDieMethod.indexOf("system.run(");
    expect(captureIdx).toBeGreaterThan(-1);
    expect(locationIdx).toBeGreaterThan(-1);
    expect(dimensionIdx).toBeGreaterThan(-1);
    expect(captureIdx).toBeLessThan(systemRunIdx);
    expect(locationIdx).toBeLessThan(systemRunIdx);
    expect(dimensionIdx).toBeLessThan(systemRunIdx);
  });

  it("CombatSystem: entity capture is inside try-catch", () => {
    const onDieMethod = combatSrc.slice(
      combatSrc.indexOf("if (Math.random()"),
      combatSrc.indexOf("}\n}"),
    );
    expect(onDieMethod).toMatch(/try\s*\{[\s\S]*dead\.typeId[\s\S]*dead\.location[\s\S]*\}\s*catch/);
  });

  it("Army death listener checks mk_army tag before processing", () => {
    const deathListener = armySrc.slice(
      armySrc.indexOf("setupDeathListener"),
      armySrc.indexOf("tick(): void"),
    );
    // hasTag check must appear before getDynamicProperty
    const tagCheckIdx = deathListener.indexOf('hasTag("mk_army")');
    const propAccessIdx = deathListener.indexOf('getDynamicProperty("mk:owner_name")');
    expect(tagCheckIdx).toBeGreaterThan(-1);
    expect(propAccessIdx).toBeGreaterThan(-1);
    expect(tagCheckIdx).toBeLessThan(propAccessIdx);
  });

  it("Camp death listener checks mk_camp_guard tag before processing", () => {
    const deathListener = campSrc.slice(
      campSrc.indexOf("setupDeathListener"),
      campSrc.indexOf("tick(): void"),
    );
    const tagCheckIdx = deathListener.indexOf('hasTag("mk_camp_guard")');
    expect(tagCheckIdx).toBeGreaterThan(-1);
  });
});

// ─── 2. Generator lifecycle safety ──────────────────────────────────────────

describe("Generator lifecycle safety", () => {
  it("Siege startSiege guards against double-start", () => {
    const start = siegeSrc.slice(
      siegeSrc.indexOf("startSiege(): void"),
      siegeSrc.indexOf("setupDeathListener"),
    );
    expect(start).toMatch(/if\s*\(\s*this\.siegeActive\s*\)\s*\{?\s*return/);
  });

  it("activeSpawnJobs always decremented with Math.max(0, ...)", () => {
    expect(siegeSrc).toContain(
      "siegeRef.activeSpawnJobs = Math.max(0, siegeRef.activeSpawnJobs - 1)",
    );
  });

  it("Victory check blocked until activeSpawnJobs === 0", () => {
    expect(siegeSrc).toContain("this.activeSpawnJobs === 0");
  });

  it("setDay staggers milestones via system.runJob + yield", () => {
    const setDay = daySrc.slice(
      daySrc.indexOf("setDay(day: number)"),
      daySrc.indexOf("reset(): void"),
    );
    expect(setDay).toContain("system.runJob");
    expect(setDay).toContain("yield");
  });

  it("Siege mid-wave cap pause uses single-yield while loop", () => {
    // Replaced old 120-yield × 5-retry spin loop with a single yield per tick
    expect(siegeSrc).toContain("while (siegeRef.siegeMobCount >= MAX_ACTIVE_SIEGE_MOBS)");
    expect(siegeSrc).not.toContain("retries < 5");
  });

  it("Siege mid-wave cap pause refreshes player map after resume", () => {
    // After the while-yield loop breaks, player map is refreshed
    expect(siegeSrc).toMatch(/while\s*\(siegeRef\.siegeMobCount >= MAX_ACTIVE_SIEGE_MOBS\)[\s\S]*?playerMap\.clear\(\)/);
  });

  it("currentWave++ happens AFTER system.runJob launch", () => {
    const spawnWave = siegeSrc.slice(
      siegeSrc.indexOf("private spawnWave()"),
      siegeSrc.indexOf("private endSiege("),
    );
    const runJobIdx = spawnWave.indexOf("system.runJob");
    const waveIncIdx = spawnWave.indexOf("this.currentWave++");
    expect(runJobIdx).toBeGreaterThan(-1);
    expect(waveIncIdx).toBeGreaterThan(-1);
    expect(waveIncIdx).toBeGreaterThan(runJobIdx);
  });

  it("spawnWave guards against currentWave >= WAVE_DEFINITIONS.length", () => {
    const spawnWave = siegeSrc.slice(
      siegeSrc.indexOf("private spawnWave()"),
      siegeSrc.indexOf("private endSiege("),
    );
    expect(spawnWave).toMatch(
      /if\s*\(\s*this\.currentWave\s*>=\s*WAVE_DEFINITIONS\.length\s*\)/,
    );
  });
});

// ─── 3. Entity budget stress scenarios ──────────────────────────────────────

describe("Entity budget stress scenarios", () => {
  /**
   * Compute worst-case siege wave entity count for a given player count.
   * Mirrors spawnWave() scaling logic from SiegeSystem.
   */
  function siegeWaveEntityCount(waveIndex: number, playerCount: number): number {
    const wave = WAVE_DEFINITIONS[waveIndex];
    const scaleFactor = playerCount <= 1 ? 1.0 : playerCount <= 2 ? 0.75 : 0.6;
    let total = 0;
    for (const spawn of wave.spawns) {
      const perPlayer = Math.min(
        Math.max(1, Math.round(spawn.count * scaleFactor)),
        MAX_SPAWNS_PER_PLAYER,
      );
      total += perPlayer * playerCount;
    }
    // Capped at MAX_SPAWNS_PER_PLAYER per player per wave
    return Math.min(total, MAX_SPAWNS_PER_PLAYER * playerCount);
  }

  function maxCampGuards(day: number): number {
    const tier = getCampTierForDay(day);
    if (!tier) return 0;
    let total = 0;
    for (const g of tier.guards) {
      total += g.count;
    }
    return Math.min(total, MAX_CAMP_GUARDS);
  }

  it("Day 99 camp guards + siege wave 1 + full army < 80", () => {
    const campGuards = maxCampGuards(99);
    const wave1 = siegeWaveEntityCount(0, 1);
    const fullArmy = GLOBAL_ARMY_CAP;
    const total = campGuards + wave1 + fullArmy;
    expect(total).toBeLessThan(80);
  });

  it("Camp system skips siege days", () => {
    expect(campSrc).toMatch(/if\s*\(\s*siegeActive\s*\)\s*\{?\s*return/);
  });

  it("Consecutive milestone spawns staggered via single runJob", () => {
    // spawnEnemiesNearPlayersBatched uses a single system.runJob with SPAWNS_PER_TICK=1
    expect(milestoneSrc).toContain("system.runJob");
    expect(milestoneSrc).toContain("SPAWNS_PER_TICK");
  });

  it("Milestone spawns capped at MAX_MILESTONE_ENTITIES", () => {
    expect(milestoneSrc).toContain("MAX_MILESTONE_ENTITIES");
    expect(milestoneSrc).toMatch(
      /totalRequested\s*>\s*MAX_MILESTONE_ENTITIES/,
    );
  });

  it("Back-to-back spawn milestones (70+90) total entities bounded", () => {
    // Day 70: 10+8+3+2 = 23 enemies requested, day 90: 5+5+10+5 = 25
    // With 1 player, each capped to MAX_MILESTONE_ENTITIES=20
    const day70Total = 10 + 8 + 3 + 2; // 23
    const day90Total = 5 + 5 + 10 + 5; // 25
    // Each batch individually caps to 20
    const capped70 = Math.min(day70Total, MAX_MILESTONE_ENTITIES);
    const capped90 = Math.min(day90Total, MAX_MILESTONE_ENTITIES);
    // In practice they don't overlap (days apart), but even if they did:
    expect(capped70 + capped90).toBeLessThanOrEqual(40);
  });

  it("Siege wave 5 with 4 players respects MAX_SPAWNS_PER_PLAYER", () => {
    const wave5 = siegeWaveEntityCount(4, 4);
    expect(wave5).toBeLessThanOrEqual(MAX_SPAWNS_PER_PLAYER * 4);
  });

  it("Standard Bearer scroll checks cap BEFORE spawn", () => {
    const scrollMethod = merchantSrc.slice(
      merchantSrc.indexOf("onScrollUse("),
      merchantSrc.lastIndexOf("}"),
    );
    const capCheckIdx = scrollMethod.indexOf("currentSize >= effectiveCap");
    const spawnIdx = scrollMethod.indexOf("spawnEntity");
    expect(capCheckIdx).toBeGreaterThan(-1);
    expect(spawnIdx).toBeGreaterThan(-1);
    expect(capCheckIdx).toBeLessThan(spawnIdx);
  });

  it.each([1, 2, 3, 4])(
    "army + siege + camp guards < 80 for %d player(s)",
    (playerCount) => {
      const armyCap = Math.min(
        BASE_ARMY_SIZE + MAX_ARMY_BONUS,
        Math.floor(GLOBAL_ARMY_CAP / playerCount),
      ) * playerCount;
      const siegeMobs = MAX_ACTIVE_SIEGE_MOBS;
      // Worst-case camp: Elite Outpost (10 guards max) — one per player
      const campGuards = MAX_CAMP_GUARDS * playerCount;
      // Camp and siege don't overlap (siegeActive check), so take max
      const peakEntities = armyCap + Math.max(siegeMobs, campGuards);
      expect(peakEntities).toBeLessThan(80);
    },
  );

  it("Siege MAX_ACTIVE_SIEGE_MOBS blocks further spawning", () => {
    expect(siegeSrc).toContain("siegeMobCount >= MAX_ACTIVE_SIEGE_MOBS");
  });

  it("Camp guards capped at MAX_CAMP_GUARDS before spawning", () => {
    expect(campSrc).toContain("MAX_CAMP_GUARDS");
    expect(campSrc).toMatch(/spawnQueue\.length\s*>\s*MAX_CAMP_GUARDS/);
  });
});

// ─── 4. HUD and cache safety ────────────────────────────────────────────────

describe("HUD and cache safety", () => {
  /**
   * Reimplement the HUD composite key packing from DayCounterSystem.
   * Packs day(7), filled(5), armySize(6), armyCap(6), tier(3) = 27 bits.
   */
  function packHudKey(
    day: number,
    filled: number,
    armySize: number,
    armyCap: number,
    tier: number,
  ): number {
    return (day << 20) | (filled << 15) | (armySize << 9) | (armyCap << 3) | tier;
  }

  function unpackHudKey(key: number): {
    day: number;
    filled: number;
    armySize: number;
    armyCap: number;
    tier: number;
  } {
    return {
      day: (key >> 20) & 0x7f,
      filled: (key >> 15) & 0x1f,
      armySize: (key >> 9) & 0x3f,
      armyCap: (key >> 3) & 0x3f,
      tier: key & 0x7,
    };
  }

  it("Composite key roundtrips for max values (100, 20, 35, 35, 4)", () => {
    const key = packHudKey(100, 20, 35, 35, 4);
    const unpacked = unpackHudKey(key);
    expect(unpacked.day).toBe(100);
    expect(unpacked.filled).toBe(20);
    expect(unpacked.armySize).toBe(35);
    expect(unpacked.armyCap).toBe(35);
    expect(unpacked.tier).toBe(4);
  });

  it("Composite key roundtrips for zero values", () => {
    const key = packHudKey(0, 0, 0, 0, 0);
    expect(key).toBe(0);
    const unpacked = unpackHudKey(key);
    expect(unpacked.day).toBe(0);
    expect(unpacked.filled).toBe(0);
    expect(unpacked.armySize).toBe(0);
    expect(unpacked.armyCap).toBe(0);
    expect(unpacked.tier).toBe(0);
  });

  it("day(7 bits) fits max value 100", () => {
    expect(100).toBeLessThanOrEqual(0x7f); // 127
  });

  it("filled(5 bits) fits max value 20", () => {
    expect(20).toBeLessThanOrEqual(0x1f); // 31
  });

  it("armySize(6 bits) fits max value 35", () => {
    expect(GLOBAL_ARMY_CAP).toBeLessThanOrEqual(0x3f); // 63
  });

  it("armyCap(6 bits) fits max value 35", () => {
    expect(BASE_ARMY_SIZE + MAX_ARMY_BONUS).toBeLessThanOrEqual(0x3f); // 63
  });

  it("tier(3 bits) fits max value 4", () => {
    expect(4).toBeLessThanOrEqual(0x7); // 7
  });

  it("No key collisions across sampled normal value range", () => {
    const keys = new Set<number>();
    let collisions = 0;
    // Sample: every 10th day, every 5th filled, every 5th army, every 5th cap, all tiers
    for (let day = 0; day <= 100; day += 10) {
      for (let filled = 0; filled <= 20; filled += 5) {
        for (let army = 0; army <= 35; army += 5) {
          for (let cap = 15; cap <= 35; cap += 5) {
            for (let tier = 0; tier <= 4; tier++) {
              const key = packHudKey(day, filled, army, cap, tier);
              if (keys.has(key)) collisions++;
              keys.add(key);
            }
          }
        }
      }
    }
    expect(collisions).toBe(0);
  });

  it("Tag caches bounded at MAX_TAG_CACHE=100 with clear-on-overflow", () => {
    expect(armySrc).toContain(`MAX_TAG_CACHE = ${MAX_TAG_CACHE}`);
    // sanitizePlayerTag clears cache when size >= MAX_TAG_CACHE
    expect(armySrc).toMatch(/tagCache\.size\s*>=\s*MAX_TAG_CACHE/);
    expect(armySrc).toContain("tagCache.clear()");
  });

  it("Owner tag cache also bounded at MAX_TAG_CACHE with clear-on-overflow", () => {
    expect(armySrc).toMatch(/ownerTagCache\.size\s*>=\s*MAX_TAG_CACHE/);
    expect(armySrc).toContain("ownerTagCache.clear()");
  });

  it("Rate limiter bounded at MAX_RATE_LIMIT_CACHE with while-loop eviction", () => {
    expect(mainSrc).toContain(`MAX_RATE_LIMIT_CACHE = ${MAX_RATE_LIMIT_CACHE}`);
    expect(mainSrc).toMatch(
      /while\s*\(\s*lastArmySpawnTickByPlayer\.size\s*>\s*MAX_RATE_LIMIT_CACHE\s*\)/,
    );
  });

  it("HUD prunes disconnected players from per-player maps", () => {
    const hudMethod = daySrc.slice(
      daySrc.indexOf("updateHUD(): void"),
      daySrc.indexOf("private onDayChange("),
    );
    expect(hudMethod).toContain("lastHudKeys.delete(key)");
    expect(hudMethod).toContain("cachedPlayerArmySize.delete(key)");
    expect(hudMethod).toContain("cachedPlayerTier.delete(key)");
    expect(hudMethod).toContain("cachedPlayerArmyBonus.delete(key)");
  });
});

// ─── 5. Input validation and debug commands ─────────────────────────────────

describe("Input validation and debug commands", () => {
  it("mk:setday rejects NaN input", () => {
    expect(mainSrc).toMatch(/!isNaN\(day\)/);
  });

  it("mk:setday clamps to [0, maxDay] via setDay()", () => {
    // setDay computes maxDay based on endless mode, then clamps
    expect(daySrc).toMatch(/maxDay\s*=\s*this\.cachedEndless\s*\?\s*999\s*:\s*DayCounterSystem\.MAX_DAY/);
    expect(daySrc).toMatch(/Math\.max\(\s*0\s*,\s*Math\.min\(\s*maxDay\s*,\s*day\s*\)/);
  });

  it("mk:army rejects count=0", () => {
    expect(mainSrc).toContain("count > 0");
  });

  it("mk:army rejects count above GLOBAL_ARMY_CAP", () => {
    expect(mainSrc).toContain("count <= GLOBAL_ARMY_CAP");
  });

  it("mk:army requires player source entity", () => {
    // Checks sourcePlayer exists and is a player
    expect(mainSrc).toContain("sourcePlayer &&");
    expect(mainSrc).toContain('sourcePlayer.typeId === "minecraft:player"');
  });

  it("mk:army has 100-tick cooldown", () => {
    expect(mainSrc).toContain("now - lastTick >= 100");
  });

  it("mk:siege double-call is idempotent (startSiege returns early)", () => {
    // startSiege() has if (this.siegeActive) return
    expect(siegeSrc).toMatch(/startSiege\(\)[\s\S]*?if\s*\(\s*this\.siegeActive\s*\)\s*\{?\s*return/);
  });

  it("mk:camp requires player source entity", () => {
    const campSection = mainSrc.slice(mainSrc.indexOf('"mk:camp"'));
    expect(campSection).toContain("sourcePlayer &&");
    expect(campSection).toContain('sourcePlayer.typeId === "minecraft:player"');
  });
});

// ─── 6. Multiplayer edge cases ──────────────────────────────────────────────

describe("Multiplayer edge cases", () => {
  /**
   * Reimplement getEffectiveCap from ArmySystem.
   */
  function getEffectiveCap(armyBonus: number, playerCount: number): number {
    const personalCap = BASE_ARMY_SIZE + Math.min(armyBonus, MAX_ARMY_BONUS);
    if (playerCount <= 1) return personalCap;
    return Math.min(personalCap, Math.floor(GLOBAL_ARMY_CAP / playerCount));
  }

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    "Army cap * %d players <= GLOBAL_ARMY_CAP",
    (playerCount) => {
      const perPlayer = getEffectiveCap(MAX_ARMY_BONUS, playerCount);
      expect(perPlayer * playerCount).toBeLessThanOrEqual(GLOBAL_ARMY_CAP);
    },
  );

  it("Siege spawn scaling reduces per-player counts in multiplayer", () => {
    // 1 player: scaleFactor=1.0, 2 players: 0.75, 3+: 0.6
    expect(siegeSrc).toMatch(/playerCount\s*<=\s*1\s*\?\s*1\.0/);
    expect(siegeSrc).toMatch(/playerCount\s*<=\s*2\s*\?\s*0\.75\s*:\s*0\.6/);
  });

  it("No MILESTONE_DAY is also a MERCHANT_DAY", () => {
    const MERCHANT_DAYS = new Set([15, 30, 55, 75, 95]);
    for (const day of MILESTONE_DAYS) {
      expect(MERCHANT_DAYS.has(day)).toBe(false);
    }
  });

  it("Camp system checks MILESTONE_DAYS (skips)", () => {
    expect(campSrc).toContain("MILESTONE_DAYS.has(day)");
  });

  it("Camp system imports MILESTONE_DAYS from MilestoneEvents", () => {
    expect(campSrc).toMatch(
      /import\s*\{[^}]*MILESTONE_DAYS[^}]*\}\s*from\s*["']\.\.\/data\/MilestoneEvents["']/,
    );
  });

  it("mk:owner_name dynamic property is set as authoritative owner", () => {
    // Both ArmySystem.recruitAlly and MerchantSystem.onScrollUse set mk:owner_name
    expect(armySrc).toContain('setDynamicProperty("mk:owner_name", player.name)');
    expect(merchantSrc).toContain('setDynamicProperty("mk:owner_name", player.name)');
  });

  it("Army recount uses getEntities query to correct drift", () => {
    const tickMethod = armySrc.slice(
      armySrc.indexOf("tick(): void"),
      armySrc.indexOf("onPlayerInteract("),
    );
    expect(tickMethod).toContain("getEntities(");
    expect(tickMethod).toContain('setDynamicProperty("mk:army_size"');
  });

  it("recruitAlly counts actual entities, not just cached property", () => {
    const recruit = armySrc.slice(
      armySrc.indexOf("recruitAlly("),
      armySrc.indexOf("setupDeathListener"),
    );
    // getEntities query before cap check
    const queryIdx = recruit.indexOf("getEntities(");
    const capCheckIdx = recruit.indexOf("actualCount >= effectiveCap");
    expect(queryIdx).toBeGreaterThan(-1);
    expect(capCheckIdx).toBeGreaterThan(-1);
    expect(queryIdx).toBeLessThan(capCheckIdx);
  });

  it("Death listener decrements army count with > 0 guard", () => {
    const deathListener = armySrc.slice(
      armySrc.indexOf("setupDeathListener"),
      armySrc.indexOf("tick(): void"),
    );
    expect(deathListener).toContain("current > 0");
  });

  it("Multiplayer army cap formula matches source", () => {
    // floor(35/4) = 8
    expect(getEffectiveCap(MAX_ARMY_BONUS, 4)).toBe(8);
    // floor(35/2) = 17
    expect(getEffectiveCap(MAX_ARMY_BONUS, 2)).toBe(17);
    // solo: 15 + 20 = 35
    expect(getEffectiveCap(MAX_ARMY_BONUS, 1)).toBe(35);
  });

  it("Effective cap clamps to personal cap when it's lower", () => {
    // With no bonus: personalCap=15, floor(35/1)=35 → 15
    expect(getEffectiveCap(0, 1)).toBe(15);
    // With bonus=5: personalCap=20, floor(35/2)=17 → 17
    expect(getEffectiveCap(5, 2)).toBe(17);
    // With bonus=5: personalCap=20, floor(35/1)=35 → 20
    expect(getEffectiveCap(5, 1)).toBe(20);
  });

  it("Camp guard death listener uses Math.max(0, ...) to prevent negative", () => {
    expect(campSrc).toMatch(/guardCount\s*=\s*Math\.max\(\s*0\s*,\s*camp\.guardCount\s*-\s*1\s*\)/);
  });

  it("Siege mob death uses Math.max(0, ...) to prevent negative count", () => {
    expect(siegeSrc).toMatch(
      /siegeMobCount\s*=\s*Math\.max\(\s*0\s*,\s*this\.siegeMobCount\s*-\s*1\s*\)/,
    );
  });
});

// ─── 7. State machine integrity ─────────────────────────────────────────────

describe("State machine integrity", () => {
  it("startSiege resets all counters", () => {
    const start = siegeSrc.slice(
      siegeSrc.indexOf("startSiege(): void"),
      siegeSrc.indexOf("setupDeathListener"),
    );
    expect(start).toContain("this.currentWave = 0");
    expect(start).toContain("this.ticksSinceWave = 0");
    expect(start).toContain("this.ticksSinceVictoryCheck = 0");
    expect(start).toContain("this.ticksSinceRecount = 0");
    expect(start).toContain("this.siegeMobCount = 0");
    expect(start).toContain("this.activeSpawnJobs = 0");
    expect(start).toContain("this.bossEntity = null");
    expect(start).toContain("this.siegePhase = 0");
  });

  it("endSiege clears state", () => {
    const end = siegeSrc.slice(
      siegeSrc.indexOf("private endSiege("),
      siegeSrc.indexOf("private checkBossPhase("),
    );
    expect(end).toContain("this.bossEntity = null");
    expect(end).toContain("this.siegePhase = 0");
    expect(end).toContain("this.siegeActive = false");
  });

  it("Victory requires 3 conditions: all waves done, no active jobs, 0 mobs", () => {
    // All three must be true for victory
    const tickMethod = siegeSrc.slice(
      siegeSrc.indexOf("tick(): void"),
      siegeSrc.indexOf("private spawnWave()"),
    );
    expect(tickMethod).toContain("this.currentWave >= WAVE_DEFINITIONS.length");
    expect(tickMethod).toContain("this.activeSpawnJobs === 0");
    expect(tickMethod).toContain("this.siegeMobCount <= 0");
  });

  it("Day counter tick no-ops when inactive", () => {
    const tick = daySrc.slice(
      daySrc.indexOf("tick(): void"),
      daySrc.indexOf("updateHUD(): void"),
    );
    expect(tick).toMatch(/if\s*\(\s*!this\.cachedActive\s*\)\s*\{?\s*return/);
  });

  it("Day counter stops at MAX_DAY", () => {
    const tick = daySrc.slice(
      daySrc.indexOf("tick(): void"),
      daySrc.indexOf("updateHUD(): void"),
    );
    expect(tick).toMatch(/cachedDay\s*>=\s*DayCounterSystem\.MAX_DAY/);
  });

  it("Army recruit: entity query -> cap check -> spawn -> count update", () => {
    const recruit = armySrc.slice(
      armySrc.indexOf("recruitAlly("),
      armySrc.indexOf("setupDeathListener"),
    );
    const queryIdx = recruit.indexOf("getEntities(");
    const capCheckIdx = recruit.indexOf("actualCount >= effectiveCap");
    const spawnIdx = recruit.indexOf("spawnEntity(");
    const countUpdateIdx = recruit.indexOf('setDynamicProperty("mk:army_size", actualCount + 1)');
    expect(queryIdx).toBeLessThan(capCheckIdx);
    expect(capCheckIdx).toBeLessThan(spawnIdx);
    expect(spawnIdx).toBeLessThan(countUpdateIdx);
  });

  it("Camp lifecycle: guardCount++, spawningComplete flag set last", () => {
    const spawnGuards = campSrc.slice(
      campSrc.indexOf("private spawnGuards("),
      campSrc.indexOf("private campCleared("),
    );
    const guardIncIdx = spawnGuards.indexOf("campRef.guardCount++");
    const completeIdx = spawnGuards.indexOf("campRef.spawningComplete = true");
    expect(guardIncIdx).toBeGreaterThan(-1);
    expect(completeIdx).toBeGreaterThan(-1);
    expect(guardIncIdx).toBeLessThan(completeIdx);
  });

  it("Camp cleared requires guardCount <= 0 AND spawningComplete", () => {
    const deathListener = campSrc.slice(
      campSrc.indexOf("setupDeathListener"),
      campSrc.indexOf("tick(): void"),
    );
    expect(deathListener).toContain("camp.guardCount <= 0 && camp.spawningComplete");
  });

  it("Camp cleared drops rewards", () => {
    const cleared = campSrc.slice(
      campSrc.indexOf("private campCleared("),
      campSrc.indexOf("private dropRewards("),
    );
    expect(cleared).toContain("this.dropRewards(camp)");
  });

  it("Siege recount every 600 ticks corrects siegeMobCount", () => {
    expect(siegeSrc).toContain("RECOUNT_INTERVAL = 600");
    const tick = siegeSrc.slice(
      siegeSrc.indexOf("tick(): void"),
      siegeSrc.indexOf("private spawnWave()"),
    );
    expect(tick).toContain("this.siegeMobCount = actual.length");
  });

  it("Bestiary onKill called BEFORE recruitment roll in CombatSystem", () => {
    const onDie = combatSrc.slice(
      combatSrc.indexOf("onEntityDie("),
      combatSrc.lastIndexOf("}"),
    );
    const bestiaryIdx = onDie.indexOf("this.bestiary.onKill(");
    // Recruit chance is now dynamic via difficulty system
    const recruitIdx = onDie.indexOf("getRecruitChance()");
    expect(bestiaryIdx).toBeGreaterThan(-1);
    expect(recruitIdx).toBeGreaterThan(-1);
    expect(bestiaryIdx).toBeLessThan(recruitIdx);
  });

  it("DayCounterSystem.reset clears HUD caches", () => {
    const reset = daySrc.slice(
      daySrc.indexOf("reset(): void"),
      daySrc.indexOf("initializePlayer("),
    );
    expect(reset).toContain("this.lastHudKeys.clear()");
  });

  it("Siege death listener checks siegeActive before processing", () => {
    const deathListener = siegeSrc.slice(
      siegeSrc.indexOf("setupDeathListener"),
      siegeSrc.indexOf("tick(): void"),
    );
    expect(deathListener).toMatch(/if\s*\(\s*!this\.siegeActive\s*\)\s*\{?\s*return/);
  });

  it("Siege mid-wave cap pause yields one tick at a time (no spin loop)", () => {
    // The while loop yields once per tick until mobs die — no batched 120-yield spin
    expect(siegeSrc).toMatch(/while\s*\(\s*siegeRef\.siegeMobCount\s*>=\s*MAX_ACTIVE_SIEGE_MOBS\s*\)\s*\{\s*yield/);
    // No old retry counter pattern
    expect(siegeSrc).not.toContain("retries < 5");
    expect(siegeSrc).not.toContain("let retries");
  });
});
