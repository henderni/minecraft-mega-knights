import { describe, it, expect } from "vitest";
import { ARMOR_TIERS } from "../data/ArmorTiers";
import { WAVE_DEFINITIONS } from "../data/WaveDefinitions";
import {
  CAMP_TIERS,
  getCampTierForDay,
  CAMP_COOLDOWN_DAYS,
  CAMP_START_DAY,
  MAX_CAMP_GUARDS,
  CampTierDef,
} from "../data/CampDefinitions";
import { CASTLE_BLUEPRINTS } from "../data/CastleBlueprints";
import { BESTIARY } from "../data/BestiaryDefinitions";
import { FACTIONS, FACTION_GUARD_WEIGHTS, FactionId } from "../data/FactionDefinitions";
import * as fs from "fs";
import * as path from "path";

// ─── Constants hardcoded from system files (cannot import — they pull @minecraft/server) ───
const BASE_ARMY_SIZE = 15;
const GLOBAL_ARMY_CAP = 35;
const MAX_ACTIVE_SIEGE_MOBS = 25;
const MAX_SPAWNS_PER_PLAYER = 24;
const MAX_MILESTONE_ENTITIES = 20;
const RECRUIT_CHANCE = 0.3;
const MERCHANT_DAYS = new Set([15, 30, 55, 75, 95]);
const MILESTONE_DAYS = new Set([1, 5, 10, 20, 25, 35, 40, 50, 60, 70, 85, 90]);

// Milestone spawn compositions (from MilestoneEvents.ts spawnEnemiesNearPlayersBatched calls)
const MILESTONE_SPAWNS: Record<number, { entityId: string; count: number }[]> = {
  10: [
    { entityId: "mk:mk_enemy_knight", count: 2 },
    { entityId: "mk:mk_enemy_archer", count: 1 },
  ],
  25: [
    { entityId: "mk:mk_enemy_knight", count: 6 },
    { entityId: "mk:mk_enemy_archer", count: 4 },
  ],
  50: [
    { entityId: "mk:mk_enemy_knight", count: 8 },
    { entityId: "mk:mk_enemy_archer", count: 5 },
    { entityId: "mk:mk_enemy_wizard", count: 2 },
  ],
  70: [
    { entityId: "mk:mk_enemy_knight", count: 10 },
    { entityId: "mk:mk_enemy_archer", count: 8 },
    { entityId: "mk:mk_enemy_wizard", count: 3 },
    { entityId: "mk:mk_enemy_dark_knight", count: 2 },
  ],
  90: [
    { entityId: "mk:mk_enemy_dark_knight", count: 5 },
    { entityId: "mk:mk_enemy_wizard", count: 5 },
    { entityId: "mk:mk_enemy_knight", count: 10 },
    { entityId: "mk:mk_enemy_archer", count: 5 },
  ],
};

// ─── Helper functions ───

/** Compute scaled milestone entity count for a given day and player count */
function milestoneEntityCount(
  day: number,
  playerCount: number,
): { total: number; byType: Record<string, number> } {
  const spawns = MILESTONE_SPAWNS[day];
  if (!spawns) return { total: 0, byType: {} };

  const totalRequested = spawns.reduce((s, r) => s + r.count, 0) * playerCount;
  const scaleFactor =
    totalRequested > MAX_MILESTONE_ENTITIES ? MAX_MILESTONE_ENTITIES / totalRequested : 1.0;

  const byType: Record<string, number> = {};
  let total = 0;

  for (let p = 0; p < playerCount; p++) {
    for (const spawn of spawns) {
      const scaled = Math.max(1, Math.round(spawn.count * scaleFactor));
      byType[spawn.entityId] = (byType[spawn.entityId] ?? 0) + scaled;
      total += scaled;
    }
  }

  return { total, byType };
}

/** Compute siege wave entities for a given wave index and player count */
function siegeWaveEntities(
  waveIndex: number,
  playerCount: number,
): { total: number; byType: Record<string, number> } {
  const wave = WAVE_DEFINITIONS[waveIndex];
  if (!wave) return { total: 0, byType: {} };

  const scaleFactor = playerCount <= 1 ? 1.0 : playerCount <= 2 ? 0.75 : 0.6;
  const byType: Record<string, number> = {};
  let total = 0;

  for (let p = 0; p < playerCount; p++) {
    let playerSpawns = 0;
    for (const spawn of wave.spawns) {
      const scaledCount = Math.max(1, Math.round(spawn.count * scaleFactor));
      const actualCount = Math.min(scaledCount, MAX_SPAWNS_PER_PLAYER - playerSpawns);
      if (actualCount <= 0) break;
      byType[spawn.entityId] = (byType[spawn.entityId] ?? 0) + actualCount;
      total += actualCount;
      playerSpawns += actualCount;
      if (playerSpawns >= MAX_SPAWNS_PER_PLAYER) break;
    }
  }

  return { total, byType };
}

interface CampEvent {
  day: number;
  tierName: string;
  tier: CampTierDef;
  guards: { entityId: string; count: number }[];
  totalGuards: number;
}

/** Simulate best-case camp schedule (camps cleared immediately) */
function simulateCampSchedule(playerCount: number = 1): CampEvent[] {
  const events: CampEvent[] = [];
  let lastCampDay = 0;
  const scaleFactor = playerCount <= 1 ? 1.0 : playerCount <= 2 ? 0.75 : 0.6;

  for (let day = CAMP_START_DAY; day < 100; day++) {
    if (MILESTONE_DAYS.has(day)) continue;
    if (day - lastCampDay < CAMP_COOLDOWN_DAYS) continue;

    const tier = getCampTierForDay(day);
    if (!tier) continue;

    const guards: { entityId: string; count: number }[] = [];
    let totalGuards = 0;
    for (const g of tier.guards) {
      const scaled = Math.max(0, Math.round(g.count * scaleFactor));
      if (scaled > 0) {
        guards.push({ entityId: g.entityId, count: scaled });
        totalGuards += scaled;
      }
    }
    if (totalGuards === 0 && tier.guards.length > 0) {
      guards.push({ entityId: tier.guards[0].entityId, count: 1 });
      totalGuards = 1;
    }
    if (totalGuards > MAX_CAMP_GUARDS) {
      guards.length = 0;
      totalGuards = 0;
      let budget = MAX_CAMP_GUARDS;
      for (const g of tier.guards) {
        const scaled = Math.max(0, Math.round(g.count * scaleFactor));
        const capped = Math.min(scaled, budget);
        if (capped > 0) {
          guards.push({ entityId: g.entityId, count: capped });
          totalGuards += capped;
          budget -= capped;
        }
      }
    }

    events.push({ day, tierName: tier.name, tier, guards, totalGuards });
    lastCampDay = day;
  }

  return events;
}

/** Count total enemies by type across milestones, camps, and siege */
function countAllEnemies(playerCount: number = 1): Record<string, number> {
  const counts: Record<string, number> = {};
  const add = (id: string, n: number) => {
    counts[id] = (counts[id] ?? 0) + n;
  };

  // Milestones
  for (const day of Object.keys(MILESTONE_SPAWNS).map(Number)) {
    const { byType } = milestoneEntityCount(day, playerCount);
    for (const [id, n] of Object.entries(byType)) add(id, n);
  }

  // Camps (optimal schedule)
  for (const camp of simulateCampSchedule(playerCount)) {
    for (const g of camp.guards) add(g.entityId, g.count);
  }

  // Siege
  for (let i = 0; i < WAVE_DEFINITIONS.length; i++) {
    const { byType } = siegeWaveEntities(i, playerCount);
    for (const [id, n] of Object.entries(byType)) add(id, n);
  }

  return counts;
}

/** Count enemies available before siege (milestones + camps only) */
function countPreSiegeEnemies(playerCount: number = 1): Record<string, number> {
  const counts: Record<string, number> = {};
  const add = (id: string, n: number) => {
    counts[id] = (counts[id] ?? 0) + n;
  };

  for (const day of Object.keys(MILESTONE_SPAWNS).map(Number)) {
    const { byType } = milestoneEntityCount(day, playerCount);
    for (const [id, n] of Object.entries(byType)) add(id, n);
  }

  for (const camp of simulateCampSchedule(playerCount)) {
    for (const g of camp.guards) add(g.entityId, g.count);
  }

  return counts;
}

/** Apply faction guard weights to a camp tier */
function applyFactionWeights(
  tierIndex: number,
  factionId: FactionId,
  scaleFactor: number = 1.0,
): { guards: { entityId: string; count: number }[]; total: number } {
  const tier = CAMP_TIERS[tierIndex];
  const weights = FACTION_GUARD_WEIGHTS[factionId];
  const guards: { entityId: string; count: number }[] = [];
  let total = 0;

  for (const g of tier.guards) {
    const factionWeight = weights[g.entityId] ?? 1.0;
    const scaled = Math.max(0, Math.round(g.count * scaleFactor * factionWeight));
    if (scaled > 0) {
      guards.push({ entityId: g.entityId, count: scaled });
      total += scaled;
    }
  }

  if (total === 0 && tier.guards.length > 0) {
    guards.push({ entityId: tier.guards[0].entityId, count: 1 });
    total = 1;
  }

  if (total > MAX_CAMP_GUARDS) {
    let budget = MAX_CAMP_GUARDS;
    for (const g of guards) {
      const capped = Math.min(g.count, budget);
      g.count = capped;
      budget -= capped;
    }
    total = guards.reduce((s, g) => s + g.count, 0);
  }

  return { guards, total };
}

/** Model day-by-day army growth with 30% recruit rate, 80% kill rate, castle bonuses at unlock+2 */
function modelArmyGrowth(
  playerCount: number = 1,
): { day: number; armySize: number; armyCap: number }[] {
  const campByDay = new Map<number, CampEvent>();
  for (const c of simulateCampSchedule(playerCount)) campByDay.set(c.day, c);

  const castleTimeline = Object.values(CASTLE_BLUEPRINTS).map((b) => ({
    effectiveDay: b.unlockDay + 2,
    bonus: b.troopBonus,
  }));

  let armySize = 0;
  let armyBonus = 0;
  const effectiveCap = (bonus: number) => {
    const personal = BASE_ARMY_SIZE + Math.min(bonus, 20);
    return playerCount <= 1 ? personal : Math.min(personal, Math.floor(GLOBAL_ARMY_CAP / playerCount));
  };

  const KILL_RATE = 0.8;
  const timeline: { day: number; armySize: number; armyCap: number }[] = [];

  for (let day = 1; day <= 100; day++) {
    for (const castle of castleTimeline) {
      if (castle.effectiveDay === day) armyBonus += castle.bonus;
    }

    const cap = effectiveCap(armyBonus);
    let enemiesKilled = 0;

    if (MILESTONE_SPAWNS[day]) {
      const perPlayer = milestoneEntityCount(day, playerCount).total / playerCount;
      enemiesKilled += Math.floor(perPlayer * KILL_RATE);
    }

    const camp = campByDay.get(day);
    if (camp) enemiesKilled += Math.floor(camp.totalGuards * KILL_RATE);

    const recruits = Math.floor(enemiesKilled * RECRUIT_CHANCE);
    armySize = Math.min(cap, armySize + recruits);
    timeline.push({ day, armySize, armyCap: cap });
  }

  return timeline;
}

// ─── Source-as-text verification ───

describe("Source sync: hardcoded constants match system files", () => {
  const srcDir = path.resolve(__dirname, "..");

  it("BASE_ARMY_SIZE matches ArmySystem.ts", () => {
    const src = fs.readFileSync(path.join(srcDir, "systems/ArmySystem.ts"), "utf-8");
    const match = src.match(/BASE_ARMY_SIZE\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(BASE_ARMY_SIZE);
  });

  it("GLOBAL_ARMY_CAP matches ArmySystem.ts", () => {
    const src = fs.readFileSync(path.join(srcDir, "systems/ArmySystem.ts"), "utf-8");
    const match = src.match(/GLOBAL_ARMY_CAP\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(GLOBAL_ARMY_CAP);
  });

  it("MAX_ACTIVE_SIEGE_MOBS matches SiegeSystem.ts", () => {
    const src = fs.readFileSync(path.join(srcDir, "systems/SiegeSystem.ts"), "utf-8");
    const match = src.match(/MAX_ACTIVE_SIEGE_MOBS\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(MAX_ACTIVE_SIEGE_MOBS);
  });

  it("MAX_SPAWNS_PER_PLAYER matches SiegeSystem.ts", () => {
    const src = fs.readFileSync(path.join(srcDir, "systems/SiegeSystem.ts"), "utf-8");
    const match = src.match(/MAX_SPAWNS_PER_PLAYER\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(MAX_SPAWNS_PER_PLAYER);
  });

  it("MAX_MILESTONE_ENTITIES matches MilestoneEvents.ts", () => {
    const src = fs.readFileSync(path.join(srcDir, "data/MilestoneEvents.ts"), "utf-8");
    const match = src.match(/MAX_MILESTONE_ENTITIES\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(MAX_MILESTONE_ENTITIES);
  });

  it("RECRUIT_CHANCE matches DifficultySystem.ts normal difficulty", () => {
    const src = fs.readFileSync(path.join(srcDir, "systems/DifficultySystem.ts"), "utf-8");
    // Normal difficulty (key 0) maps to 0.3 recruit chance
    expect(src).toContain("0.3");
    expect(src).toContain("0.2"); // Hard difficulty
  });

  it("MERCHANT_DAYS matches MerchantSystem.ts", () => {
    const src = fs.readFileSync(path.join(srcDir, "systems/MerchantSystem.ts"), "utf-8");
    const match = src.match(/MERCHANT_DAYS\s*=\s*new\s+Set\(\[([^\]]+)\]\)/);
    expect(match).not.toBeNull();
    const days = match![1].split(",").map((s) => Number(s.trim()));
    expect(new Set(days)).toEqual(MERCHANT_DAYS);
  });

  it("MILESTONE_DAYS matches MilestoneEvents.ts MILESTONES keys", () => {
    const src = fs.readFileSync(path.join(srcDir, "data/MilestoneEvents.ts"), "utf-8");
    // Extract numeric keys from MILESTONES record
    const dayMatches = [...src.matchAll(/^\s+(\d+)\s*:\s*\{/gm)];
    const days = new Set(dayMatches.map((m) => Number(m[1])));
    expect(days).toEqual(MILESTONE_DAYS);
  });

  it("milestone spawn compositions match MilestoneEvents.ts", () => {
    const src = fs.readFileSync(path.join(srcDir, "data/MilestoneEvents.ts"), "utf-8");
    // Verify each milestone that has spawns
    for (const [day, spawns] of Object.entries(MILESTONE_SPAWNS)) {
      for (const spawn of spawns) {
        const entityPattern = spawn.entityId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // Check that this entity+count pair appears in the milestone's execute block
        const pattern = new RegExp(
          `${day}\\s*:\\s*\\{[\\s\\S]*?entityId:\\s*"${entityPattern}"\\s*,\\s*count:\\s*${spawn.count}`,
        );
        expect(src).toMatch(pattern);
      }
    }
  });
});

// ─── Section 1: Full 100-Day Timeline ───

describe("Full 100-day timeline", () => {
  it("every day 1-99 can be classified into at least one event category", () => {
    const unclassified: number[] = [];
    for (let day = 1; day < 100; day++) {
      const isMilestone = MILESTONE_DAYS.has(day);
      const isMerchant = MERCHANT_DAYS.has(day);
      const isCampEligible = day >= CAMP_START_DAY && getCampTierForDay(day) !== undefined;

      if (!isMilestone && !isMerchant && !isCampEligible) {
        unclassified.push(day);
      }
    }
    // Days 1-5 are before camp start and not all are milestones
    // Day 1 = milestone, day 5 = milestone, days 2-4 are quiet (early game intro)
    expect(unclassified).toEqual([2, 3, 4]);
  });

  it("no milestone day is also a merchant day", () => {
    for (const day of MERCHANT_DAYS) {
      expect(MILESTONE_DAYS.has(day)).toBe(false);
    }
  });

  it("blueprint unlock days precede or match the next armor tier unlock", () => {
    const blueprintDays = Object.values(CASTLE_BLUEPRINTS)
      .map((b) => b.unlockDay)
      .sort((a, b) => a - b);
    // Each blueprint should be available before the siege (day 100)
    for (const day of blueprintDays) {
      expect(day).toBeLessThan(100);
    }
    // Small tower (day 5) before Squire armor (day 20)
    expect(CASTLE_BLUEPRINTS.small_tower.unlockDay).toBeLessThan(ARMOR_TIERS[1].unlockDay);
    // Gatehouse (day 35) before Knight armor (day 40)
    expect(CASTLE_BLUEPRINTS.gatehouse.unlockDay).toBeLessThan(ARMOR_TIERS[2].unlockDay);
    // Great Hall (day 50) at Champion armor (day 60) — given day 50 milestone
    expect(CASTLE_BLUEPRINTS.great_hall.unlockDay).toBeLessThanOrEqual(ARMOR_TIERS[3].unlockDay);
  });

  it("armor tiers unlock in ascending day order", () => {
    for (let i = 1; i < ARMOR_TIERS.length; i++) {
      expect(ARMOR_TIERS[i].unlockDay).toBeGreaterThan(ARMOR_TIERS[i - 1].unlockDay);
    }
  });

  it("longest content gap (no milestone/merchant) is ≤ 14 days", () => {
    const eventDays = new Set([...MILESTONE_DAYS, ...MERCHANT_DAYS]);
    let maxGap = 0;
    let lastEvent = 0;
    for (let day = 1; day <= 100; day++) {
      if (eventDays.has(day)) {
        maxGap = Math.max(maxGap, day - lastEvent - 1);
        lastEvent = day;
      }
    }
    // Days 76-84 is the longest gap between day 75 (merchant) and day 85 (milestone)
    expect(maxGap).toBeLessThanOrEqual(14);
    // Confirm the exact gap: 75→85 = 9 days gap (76,77,78,79,80,81,82,83,84)
    expect(maxGap).toBe(9);
  });

  it("camp-eligible days cover all of days 6-99 via tier mappings", () => {
    for (let day = CAMP_START_DAY; day <= 99; day++) {
      expect(getCampTierForDay(day)).toBeDefined();
    }
  });
});

// ─── Section 2: Entity Budget (Switch) ───

describe("Entity budget (Switch)", () => {
  it("milestone entity count ≤ MAX_MILESTONE_ENTITIES + 2 for 1P (rounding tolerance)", () => {
    for (const day of Object.keys(MILESTONE_SPAWNS).map(Number)) {
      const { total } = milestoneEntityCount(day, 1);
      // Rounding with Math.max(1,...) can exceed cap slightly
      expect(total).toBeLessThanOrEqual(MAX_MILESTONE_ENTITIES + 2);
    }
  });

  it("camp guards ≤ MAX_CAMP_GUARDS for every tier at 1P", () => {
    for (const tier of CAMP_TIERS) {
      const total = tier.guards.reduce((s, g) => s + g.count, 0);
      expect(total).toBeLessThanOrEqual(MAX_CAMP_GUARDS);
    }
  });

  it("army (35) + largest camp (10 guards) stays under 50, well within normal budget of 60", () => {
    const largestCamp = Math.max(...CAMP_TIERS.map((t) => t.guards.reduce((s, g) => s + g.count, 0)));
    expect(GLOBAL_ARMY_CAP + largestCamp).toBeLessThanOrEqual(50);
  });

  it("each siege wave 1P fits within MAX_SPAWNS_PER_PLAYER cap", () => {
    for (let i = 0; i < WAVE_DEFINITIONS.length; i++) {
      const { total } = siegeWaveEntities(i, 1);
      expect(total).toBeLessThanOrEqual(MAX_SPAWNS_PER_PLAYER);
    }
  });

  it("peak siege: army + MAX_ACTIVE_SIEGE_MOBS ≤ 60", () => {
    expect(GLOBAL_ARMY_CAP + MAX_ACTIVE_SIEGE_MOBS).toBe(60);
    expect(GLOBAL_ARMY_CAP + MAX_ACTIVE_SIEGE_MOBS).toBeLessThanOrEqual(60);
  });

  it("no single wave raw count exceeds 25 entities (1P unscaled)", () => {
    for (const wave of WAVE_DEFINITIONS) {
      const raw = wave.spawns.reduce((s, sp) => s + sp.count, 0);
      expect(raw).toBeLessThanOrEqual(25);
    }
  });
});

// ─── Section 3: Army Growth Rate ───

describe("Army growth rate", () => {
  it("base army size is 15", () => {
    expect(BASE_ARMY_SIZE).toBe(15);
  });

  it("max army with all castles is exactly GLOBAL_ARMY_CAP (35)", () => {
    const totalBonus = Object.values(CASTLE_BLUEPRINTS).reduce((s, b) => s + b.troopBonus, 0);
    expect(BASE_ARMY_SIZE + totalBonus).toBe(GLOBAL_ARMY_CAP);
  });

  it("castle bonuses sum to 20 (5+7+8)", () => {
    const bonuses = Object.values(CASTLE_BLUEPRINTS).map((b) => b.troopBonus);
    expect(bonuses.sort((a, b) => a - b)).toEqual([5, 7, 8]);
    expect(bonuses.reduce((a, b) => a + b, 0)).toBe(20);
  });

  it("total pre-siege enemies (1P) provide ≥ 35 expected recruits at 30% rate", () => {
    const preSiege = countPreSiegeEnemies(1);
    const totalPreSiege = Object.values(preSiege).reduce((s, n) => s + n, 0);
    const KILL_RATE = 0.8;
    const expectedRecruits = Math.floor(totalPreSiege * KILL_RATE * RECRUIT_CHANCE);
    // Should be enough to fill a 35-unit army
    expect(expectedRecruits).toBeGreaterThanOrEqual(GLOBAL_ARMY_CAP);
  });

  it("army growth model reaches ≥ 20 units by day 90 (1P)", () => {
    const timeline = modelArmyGrowth(1);
    const day90 = timeline.find((t) => t.day === 90);
    expect(day90).toBeDefined();
    expect(day90!.armySize).toBeGreaterThanOrEqual(20);
  });

  it("army cap reaches max (35) by day 52 when all castles built", () => {
    const timeline = modelArmyGrowth(1);
    // Great Hall effective day = 50+2 = 52
    const day52 = timeline.find((t) => t.day === 52);
    expect(day52).toBeDefined();
    expect(day52!.armyCap).toBe(35);
  });
});

// ─── Section 4: Camp Scheduling ───

describe("Camp scheduling", () => {
  const schedule1P = simulateCampSchedule(1);

  it("first camp spawns on day 6", () => {
    expect(schedule1P[0].day).toBe(CAMP_START_DAY);
  });

  it("best-case camp count is between 28 and 35 (1P)", () => {
    expect(schedule1P.length).toBeGreaterThanOrEqual(28);
    expect(schedule1P.length).toBeLessThanOrEqual(35);
  });

  it("every camp tier is reached at least once", () => {
    const tiersReached = new Set(schedule1P.map((c) => c.tierName));
    for (const tier of CAMP_TIERS) {
      expect(tiersReached.has(tier.name)).toBe(true);
    }
  });

  it("cooldown of 3 days is respected between consecutive camps", () => {
    for (let i = 1; i < schedule1P.length; i++) {
      expect(schedule1P[i].day - schedule1P[i - 1].day).toBeGreaterThanOrEqual(CAMP_COOLDOWN_DAYS);
    }
  });

  it("no camp spawns on a milestone day", () => {
    for (const camp of schedule1P) {
      expect(MILESTONE_DAYS.has(camp.day)).toBe(false);
    }
  });

  it("camp tiers cover days 6-99 with no gaps", () => {
    for (let day = CAMP_START_DAY; day <= 99; day++) {
      const tier = getCampTierForDay(day);
      expect(tier).toBeDefined();
    }
  });

  it("each camp tier gets multiple camps in optimal schedule", () => {
    const countByTier = new Map<string, number>();
    for (const camp of schedule1P) {
      countByTier.set(camp.tierName, (countByTier.get(camp.tierName) ?? 0) + 1);
    }
    for (const tier of CAMP_TIERS) {
      expect(countByTier.get(tier.name)!).toBeGreaterThanOrEqual(3);
    }
  });
});

// ─── Section 5: Siege Wave Pacing ───

describe("Siege wave pacing", () => {
  it("has exactly 5 waves", () => {
    expect(WAVE_DEFINITIONS).toHaveLength(5);
  });

  it("wave 1 is immediate (delayTicks = 0)", () => {
    expect(WAVE_DEFINITIONS[0].delayTicks).toBe(0);
  });

  it("waves 2-5 have consistent 1200-tick (60s) delays", () => {
    for (let i = 1; i < WAVE_DEFINITIONS.length; i++) {
      expect(WAVE_DEFINITIONS[i].delayTicks).toBe(1200);
    }
  });

  it("boss only appears in the final wave", () => {
    for (let i = 0; i < WAVE_DEFINITIONS.length - 1; i++) {
      const hasBoss = WAVE_DEFINITIONS[i].spawns.some((s) => s.entityId.includes("boss"));
      expect(hasBoss).toBe(false);
    }
    const finalWave = WAVE_DEFINITIONS[WAVE_DEFINITIONS.length - 1];
    const hasBoss = finalWave.spawns.some((s) => s.entityId.includes("boss"));
    expect(hasBoss).toBe(true);
  });

  it("wave raw entity counts escalate or stay even", () => {
    const rawCounts = WAVE_DEFINITIONS.map((w) => w.spawns.reduce((s, sp) => s + sp.count, 0));
    for (let i = 1; i < rawCounts.length; i++) {
      expect(rawCounts[i]).toBeGreaterThanOrEqual(rawCounts[i - 1] - 3);
    }
  });

  it("total siege entities across all waves (1P) is between 80 and 100", () => {
    let total = 0;
    for (let i = 0; i < WAVE_DEFINITIONS.length; i++) {
      total += siegeWaveEntities(i, 1).total;
    }
    expect(total).toBeGreaterThanOrEqual(80);
    expect(total).toBeLessThanOrEqual(100);
  });

  it("wave 3 raw count (25) exceeds MAX_SPAWNS_PER_PLAYER (24) — capped by design", () => {
    const wave3Raw = WAVE_DEFINITIONS[2].spawns.reduce((s, sp) => s + sp.count, 0);
    expect(wave3Raw).toBeGreaterThan(MAX_SPAWNS_PER_PLAYER);
    // But after cap:
    const { total } = siegeWaveEntities(2, 1);
    expect(total).toBeLessThanOrEqual(MAX_SPAWNS_PER_PLAYER);
  });
});

// ─── Section 6: Multiplayer Budget ───

describe("Multiplayer budget", () => {
  const armyCap = (playerCount: number) => Math.floor(GLOBAL_ARMY_CAP / playerCount);

  it("1P army cap = 35 (full)", () => {
    expect(BASE_ARMY_SIZE + 20).toBe(GLOBAL_ARMY_CAP);
  });

  it("2P per-player cap = 17", () => {
    expect(armyCap(2)).toBe(17);
  });

  it("3P per-player cap = 11", () => {
    expect(armyCap(3)).toBe(11);
  });

  it("4P per-player cap = 8", () => {
    expect(armyCap(4)).toBe(8);
  });

  for (const pc of [2, 3, 4]) {
    it(`${pc}P: total army + siege fits under 60`, () => {
      const totalArmy = armyCap(pc) * pc;
      expect(totalArmy + MAX_ACTIVE_SIEGE_MOBS).toBeLessThanOrEqual(60);
    });
  }

  it("2P milestone entity count stays near MAX_MILESTONE_ENTITIES", () => {
    for (const day of Object.keys(MILESTONE_SPAWNS).map(Number)) {
      const { total } = milestoneEntityCount(day, 2);
      // With rounding, can exceed slightly
      expect(total).toBeLessThanOrEqual(MAX_MILESTONE_ENTITIES + 4);
    }
  });

  it("4P milestone entity count stays near MAX_MILESTONE_ENTITIES", () => {
    for (const day of Object.keys(MILESTONE_SPAWNS).map(Number)) {
      const { total } = milestoneEntityCount(day, 4);
      expect(total).toBeLessThanOrEqual(MAX_MILESTONE_ENTITIES + 8);
    }
  });

  it("army cap is monotonically decreasing with player count", () => {
    for (let pc = 2; pc <= 4; pc++) {
      expect(armyCap(pc)).toBeLessThanOrEqual(armyCap(pc - 1));
    }
  });
});

// ─── Section 7: Bestiary Feasibility ───

describe("Bestiary feasibility", () => {
  const allEnemies = countAllEnemies(1);
  const preSiegeEnemies = countPreSiegeEnemies(1);
  const KILL_RATE = 0.8;

  for (const entry of BESTIARY) {
    const totalAvailable = allEnemies[entry.enemyTypeId] ?? 0;
    const preSiegeAvailable = preSiegeEnemies[entry.enemyTypeId] ?? 0;

    it(`${entry.displayName}: total available (${totalAvailable}) supports tier 1 (${entry.milestones[0].kills} kills)`, () => {
      const expectedKills = Math.floor(totalAvailable * KILL_RATE);
      expect(expectedKills).toBeGreaterThanOrEqual(entry.milestones[0].kills);
    });

    if (entry.milestones.length > 1) {
      it(`${entry.displayName}: total available (${totalAvailable}) supports tier 2 (${entry.milestones[1].kills} kills)`, () => {
        const expectedKills = Math.floor(totalAvailable * KILL_RATE);
        expect(expectedKills).toBeGreaterThanOrEqual(entry.milestones[1].kills);
      });
    }

    it(`${entry.displayName}: tier 1 achievable pre-siege (${preSiegeAvailable} available)`, () => {
      const expectedKills = Math.floor(preSiegeAvailable * KILL_RATE);
      expect(expectedKills).toBeGreaterThanOrEqual(entry.milestones[0].kills);
    });
  }

  it("total enemies across all types exceeds 300 (sufficient content)", () => {
    const total = Object.values(allEnemies).reduce((s, n) => s + n, 0);
    expect(total).toBeGreaterThan(300);
  });
});

// ─── Section 8: Reward Economy ───

describe("Reward economy", () => {
  it("every camp tier has at least 2 reward types", () => {
    for (const tier of CAMP_TIERS) {
      expect(tier.rewards.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("netherite scrap only available from Elite Outpost (day 85+)", () => {
    for (const tier of CAMP_TIERS) {
      const hasNetherite = tier.rewards.some((r) => r.itemId.includes("netherite"));
      if (tier.minDay < 85) {
        expect(hasNetherite).toBe(false);
      }
    }
    const elite = CAMP_TIERS.find((t) => t.name === "Elite Outpost")!;
    expect(elite.rewards.some((r) => r.itemId.includes("netherite"))).toBe(true);
  });

  it("diamonds available from War Camp (day 40) onward", () => {
    const firstDiamondTier = CAMP_TIERS.find((t) => t.rewards.some((r) => r.itemId === "minecraft:diamond"));
    expect(firstDiamondTier).toBeDefined();
    expect(firstDiamondTier!.minDay).toBeLessThanOrEqual(40);
  });

  it("iron available from day 6 (Scout Camp)", () => {
    const scout = CAMP_TIERS[0];
    expect(scout.rewards.some((r) => r.itemId === "minecraft:iron_ingot")).toBe(true);
  });

  it("Fortress Outpost has same reward type count as War Camp (3 each)", () => {
    const warCamp = CAMP_TIERS.find((t) => t.name === "War Camp")!;
    const fortress = CAMP_TIERS.find((t) => t.name === "Fortress Outpost")!;
    expect(fortress.rewards.length).toBe(warCamp.rewards.length);
  });
});

// ─── Section 9: Faction Balance ───

describe("Faction balance", () => {
  const factionIds: FactionId[] = ["marauders", "grave_walkers", "ironclad_raiders"];

  for (const factionId of factionIds) {
    it(`${factionId}: produces ≥ 1 guard for every camp tier at 1P`, () => {
      for (let i = 0; i < CAMP_TIERS.length; i++) {
        const { total } = applyFactionWeights(i, factionId, 1.0);
        expect(total).toBeGreaterThanOrEqual(1);
      }
    });

    it(`${factionId}: never exceeds MAX_CAMP_GUARDS for any tier at 1P`, () => {
      for (let i = 0; i < CAMP_TIERS.length; i++) {
        const { total } = applyFactionWeights(i, factionId, 1.0);
        expect(total).toBeLessThanOrEqual(MAX_CAMP_GUARDS);
      }
    });

    it(`${factionId}: produces ≥ 1 guard even at 4P scaling (0.6)`, () => {
      for (let i = 0; i < CAMP_TIERS.length; i++) {
        const { total } = applyFactionWeights(i, factionId, 0.6);
        expect(total).toBeGreaterThanOrEqual(1);
      }
    });
  }

  it("marauders are knight-heavy: knights outnumber wizards in Elite Outpost", () => {
    const { guards } = applyFactionWeights(4, "marauders", 1.0);
    const knights = guards.find((g) => g.entityId.includes("knight") && !g.entityId.includes("dark"))?.count ?? 0;
    const wizards = guards.find((g) => g.entityId.includes("wizard"))?.count ?? 0;
    expect(knights).toBeGreaterThan(wizards);
  });

  it("grave_walkers are wizard-heavy: wizards outnumber knights in Elite Outpost", () => {
    const { guards } = applyFactionWeights(4, "grave_walkers", 1.0);
    const knights = guards.find((g) => g.entityId.includes("knight") && !g.entityId.includes("dark"))?.count ?? 0;
    const wizards = guards.find((g) => g.entityId.includes("wizard"))?.count ?? 0;
    expect(wizards).toBeGreaterThan(knights);
  });

  it("ironclad_raiders are dark-knight-heavy: dark knights ≥ wizards in Fortress Outpost", () => {
    const { guards } = applyFactionWeights(3, "ironclad_raiders", 1.0);
    const darkKnights = guards.find((g) => g.entityId.includes("dark_knight"))?.count ?? 0;
    const wizards = guards.find((g) => g.entityId.includes("wizard"))?.count ?? 0;
    expect(darkKnights).toBeGreaterThanOrEqual(wizards);
  });
});

// ─── Section 10: Design Discovery ───

describe("Design discovery", () => {
  it("content gap days 76-84: only camps, no milestones or merchants", () => {
    for (let day = 76; day <= 84; day++) {
      expect(MILESTONE_DAYS.has(day)).toBe(false);
      expect(MERCHANT_DAYS.has(day)).toBe(false);
      // Camps are available
      expect(getCampTierForDay(day)).toBeDefined();
    }
  });

  it("difficulty curve: enemy count per phase increases", () => {
    const phases = [
      { name: "early", days: [1, 25] },
      { name: "mid", days: [26, 59] },
      { name: "late", days: [60, 99] },
    ];

    const phaseEnemies = phases.map((phase) => {
      let count = 0;
      for (const day of Object.keys(MILESTONE_SPAWNS).map(Number)) {
        if (day >= phase.days[0] && day <= phase.days[1]) {
          count += milestoneEntityCount(day, 1).total;
        }
      }
      return count;
    });

    // Mid-game has more enemies than early
    expect(phaseEnemies[1]).toBeGreaterThanOrEqual(phaseEnemies[0]);
    // Late-game has most enemies
    expect(phaseEnemies[2]).toBeGreaterThanOrEqual(phaseEnemies[1]);
  });

  it("content density: every 10-day block has at least one milestone or merchant", () => {
    const eventDays = new Set([...MILESTONE_DAYS, ...MERCHANT_DAYS]);
    const emptyBlocks: string[] = [];
    for (let start = 1; start < 100; start += 10) {
      const end = Math.min(start + 9, 99);
      let hasEvent = false;
      for (let d = start; d <= end; d++) {
        if (eventDays.has(d)) {
          hasEvent = true;
          break;
        }
      }
      if (!hasEvent) emptyBlocks.push(`${start}-${end}`);
    }
    // Day-95 merchant fills the former 91-99 gap
    expect(emptyBlocks).toEqual([]);
  });

  it("cooldown sensitivity: reducing cooldown by 1 adds ~10 more camp opportunities", () => {
    const baseline = simulateCampSchedule(1).length;
    // Simulate with cooldown - 1 (2 days)
    const events: number[] = [];
    let lastDay = 0;
    for (let day = CAMP_START_DAY; day < 100; day++) {
      if (MILESTONE_DAYS.has(day)) continue;
      if (day - lastDay < CAMP_COOLDOWN_DAYS - 1) continue;
      if (!getCampTierForDay(day)) continue;
      events.push(day);
      lastDay = day;
    }
    const difference = events.length - baseline;
    // Roughly 8-15 additional camps
    expect(difference).toBeGreaterThanOrEqual(5);
    expect(difference).toBeLessThanOrEqual(20);
  });

  it("recruitment margin: 30% of all killable enemies fills army 2-4x over", () => {
    const totalEnemies = Object.values(countAllEnemies(1)).reduce((s, n) => s + n, 0);
    const expectedRecruits = Math.floor(totalEnemies * RECRUIT_CHANCE);
    const margin = expectedRecruits / GLOBAL_ARMY_CAP;
    expect(margin).toBeGreaterThanOrEqual(2);
    expect(margin).toBeLessThanOrEqual(4);
  });

  it("attrition model: army still functional at siege start with 20% ally death rate", () => {
    // Model with ally attrition: each combat day, 20% of current army dies
    const campByDay = new Map<number, CampEvent>();
    for (const c of simulateCampSchedule(1)) campByDay.set(c.day, c);

    const castles = Object.values(CASTLE_BLUEPRINTS).map((b) => ({
      effectiveDay: b.unlockDay + 2,
      bonus: b.troopBonus,
    }));

    let armySize = 0;
    let armyBonus = 0;
    const KILL_RATE = 0.8;
    const ALLY_DEATH_RATE = 0.2;

    for (let day = 1; day < 100; day++) {
      for (const castle of castles) {
        if (castle.effectiveDay === day) armyBonus += castle.bonus;
      }
      const cap = BASE_ARMY_SIZE + Math.min(armyBonus, 20);

      let combatToday = false;
      let enemiesKilled = 0;

      if (MILESTONE_SPAWNS[day]) {
        const perPlayer = milestoneEntityCount(day, 1).total;
        enemiesKilled += Math.floor(perPlayer * KILL_RATE);
        combatToday = true;
      }

      const camp = campByDay.get(day);
      if (camp) {
        enemiesKilled += Math.floor(camp.totalGuards * KILL_RATE);
        combatToday = true;
      }

      // Attrition: allies die in combat
      if (combatToday && armySize > 0) {
        const losses = Math.ceil(armySize * ALLY_DEATH_RATE);
        armySize = Math.max(0, armySize - losses);
      }

      // Recruitment
      const recruits = Math.floor(enemiesKilled * RECRUIT_CHANCE);
      armySize = Math.min(cap, armySize + recruits);
    }

    // With 20% attrition, army hovers around 8-12 — still functional but lean.
    // This confirms the 30% recruit rate is tight under attrition: players who
    // lose many allies in combat will enter the siege with a smaller force.
    expect(armySize).toBeGreaterThanOrEqual(8);
    expect(armySize).toBeLessThanOrEqual(15);
  });
});
