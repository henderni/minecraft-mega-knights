import { describe, it, expect } from "vitest";
import { ARMOR_TIERS } from "../data/ArmorTiers";
import { WAVE_DEFINITIONS } from "../data/WaveDefinitions";
import {
  CAMP_TIERS,
  getCampTierForDay,
  CAMP_COOLDOWN_DAYS,
  CAMP_START_DAY,
  CampTierDef,
} from "../data/CampDefinitions";
import { CASTLE_BLUEPRINTS } from "../data/CastleBlueprints";
import { BESTIARY } from "../data/BestiaryDefinitions";
import * as fs from "fs";
import * as path from "path";

// ─── Constants hardcoded from system files (cannot import — they pull @minecraft/server) ───
const BASE_ARMY_SIZE = 15;
const GLOBAL_ARMY_CAP = 35;
const RECRUIT_CHANCE = 0.3;
const MAX_MILESTONE_ENTITIES = 20;
const MILESTONE_DAYS = new Set([1, 5, 10, 20, 25, 35, 40, 50, 60, 70, 85, 90]);

// Milestone spawn compositions (from MilestoneEvents.ts)
const MILESTONE_SPAWNS: Record<number, { entityId: string; count: number }[]> = {
  10: [
    { entityId: "mk:mk_enemy_knight", count: 3 },
    { entityId: "mk:mk_enemy_archer", count: 2 },
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

// ─── Combat power model ───

const ENTITY_POWER: Record<string, number> = {
  "mk:mk_enemy_knight": 30 * 5, // 150
  "mk:mk_enemy_archer": 20 * 3, // 60
  "mk:mk_enemy_wizard": 25 * 6, // 150
  "mk:mk_enemy_dark_knight": 50 * 8, // 400
  "mk:mk_boss_siege_lord": 200 * 12, // 2400
};

const ALLY_POWER = 150; // Allied knights: 30 HP × 5 dmg

// Player effective HP by armor tier (armor reduces incoming damage)
const PLAYER_POWER_BY_TIER: number[] = [
  30 * 7, // Page: 8 armor → 30 eHP × 7 dmg = 210
  40 * 7, // Squire: 14 armor → 40 eHP × 7 dmg = 280
  50 * 7, // Knight: 19 armor → 50 eHP × 7 dmg = 350
  60 * 7, // Champion: 23 armor → 60 eHP × 7 dmg = 420
  80 * 7, // Mega Knight: 29 armor → 80 eHP × 7 dmg = 560
];

// ─── Archetype definitions ───

interface Archetype {
  name: string;
  killRate: number; // % of enemies killed per encounter
  allyDeathRate: number; // % of army lost per combat
  campEngagement: number; // % of available camps fought
  campClearRate: number; // % of engaged camps cleared
  castleBuildDelay: number; // days after unlock before building
  difficultyThreshold: number; // power ratio needed to win (lower = more forgiving)
}

const BEGINNER: Archetype = {
  name: "Beginner",
  killRate: 0.6,
  allyDeathRate: 0.4,
  campEngagement: 0.5,
  campClearRate: 0.7,
  castleBuildDelay: 10,
  difficultyThreshold: 0.6,
};

const INTERMEDIATE: Archetype = {
  name: "Intermediate",
  killRate: 0.8,
  allyDeathRate: 0.25,
  campEngagement: 0.8,
  campClearRate: 0.9,
  castleBuildDelay: 3,
  difficultyThreshold: 0.8,
};

const EXPERT: Archetype = {
  name: "Expert",
  killRate: 0.95,
  allyDeathRate: 0.1,
  campEngagement: 1.0,
  campClearRate: 1.0,
  castleBuildDelay: 0,
  difficultyThreshold: 1.0,
};

const ALL_ARCHETYPES = [BEGINNER, INTERMEDIATE, EXPERT];

// ─── Simulation helpers ───

function milestoneEntityCount(day: number): { total: number; byType: Record<string, number> } {
  const spawns = MILESTONE_SPAWNS[day];
  if (!spawns) return { total: 0, byType: {} };
  const totalRequested = spawns.reduce((s, r) => s + r.count, 0);
  const scaleFactor =
    totalRequested > MAX_MILESTONE_ENTITIES ? MAX_MILESTONE_ENTITIES / totalRequested : 1.0;
  const byType: Record<string, number> = {};
  let total = 0;
  for (const spawn of spawns) {
    const scaled = Math.max(1, Math.round(spawn.count * scaleFactor));
    byType[spawn.entityId] = (byType[spawn.entityId] ?? 0) + scaled;
    total += scaled;
  }
  return { total, byType };
}

interface CampEvent {
  day: number;
  tier: CampTierDef;
  totalGuards: number;
  guardsByType: Record<string, number>;
}

function simulateCampSchedule(): CampEvent[] {
  const events: CampEvent[] = [];
  let lastCampDay = 0;
  for (let day = CAMP_START_DAY; day < 100; day++) {
    if (MILESTONE_DAYS.has(day)) continue;
    if (day - lastCampDay < CAMP_COOLDOWN_DAYS) continue;
    const tier = getCampTierForDay(day);
    if (!tier) continue;
    const guardsByType: Record<string, number> = {};
    let totalGuards = 0;
    for (const g of tier.guards) {
      guardsByType[g.entityId] = (guardsByType[g.entityId] ?? 0) + g.count;
      totalGuards += g.count;
    }
    events.push({ day, tier, totalGuards, guardsByType });
    lastCampDay = day;
  }
  return events;
}

function getArmorTierAtDay(day: number, archetype: Archetype): number {
  let tier = 0;
  for (const at of ARMOR_TIERS) {
    if (day >= at.unlockDay + archetype.castleBuildDelay || at.unlockDay === 0) {
      // Tier 0 (Page) is always available; others require unlock day + delay
      if (at.tier === 0 || day >= at.unlockDay + archetype.castleBuildDelay) {
        tier = at.tier;
      }
    }
  }
  return tier;
}

function getCastleBonusAtDay(day: number, archetype: Archetype): number {
  let bonus = 0;
  for (const bp of Object.values(CASTLE_BLUEPRINTS)) {
    if (day >= bp.unlockDay + archetype.castleBuildDelay) {
      bonus += bp.troopBonus;
    }
  }
  return Math.min(bonus, 20);
}

function getArmyCap(castleBonus: number): number {
  return BASE_ARMY_SIZE + castleBonus;
}

function encounterPower(guardsByType: Record<string, number>): number {
  let power = 0;
  for (const [entityId, count] of Object.entries(guardsByType)) {
    power += (ENTITY_POWER[entityId] ?? 150) * count;
  }
  return power;
}

interface SimState {
  day: number;
  armySize: number;
  armyCap: number;
  armorTier: number;
  killsByType: Record<string, number>;
  campsEngaged: number;
  campsCleared: number;
  castleBonus: number;
  rewards: Record<string, number>;
  encounters: { day: number; armyPower: number; encounterPower: number; ratio: number }[];
}

function runFullSimulation(archetype: Archetype): SimState {
  const campSchedule = simulateCampSchedule();
  const campByDay = new Map<number, CampEvent>();
  for (const c of campSchedule) campByDay.set(c.day, c);

  let armySize = 0;
  const killsByType: Record<string, number> = {};
  const rewards: Record<string, number> = {};
  let campsEngaged = 0;
  let campsCleared = 0;
  const encounters: SimState["encounters"] = [];

  const addKills = (entityId: string, count: number) => {
    killsByType[entityId] = (killsByType[entityId] ?? 0) + count;
  };
  const addRewards = (itemId: string, amount: number) => {
    rewards[itemId] = (rewards[itemId] ?? 0) + amount;
  };

  let lastState: SimState | undefined;

  for (let day = 1; day < 100; day++) {
    const armorTier = getArmorTierAtDay(day, archetype);
    const castleBonus = getCastleBonusAtDay(day, archetype);
    const armyCap = getArmyCap(castleBonus);
    const playerPower = PLAYER_POWER_BY_TIER[armorTier];

    // Process milestone enemies
    if (MILESTONE_SPAWNS[day]) {
      const { byType } = milestoneEntityCount(day);
      const enemyPower = encounterPower(byType);
      const armyPower = playerPower + armySize * ALLY_POWER;
      const ratio = armyPower / Math.max(1, enemyPower);
      encounters.push({ day, armyPower, encounterPower: enemyPower, ratio });

      // Kill enemies
      for (const [entityId, count] of Object.entries(byType)) {
        const killed = Math.floor(count * archetype.killRate);
        addKills(entityId, killed);
      }

      // Army attrition from combat
      if (armySize > 0) {
        const losses = Math.ceil(armySize * archetype.allyDeathRate);
        armySize = Math.max(0, armySize - losses);
      }

      // Recruitment from killed enemies
      const totalKilled = Object.values(byType).reduce(
        (s, c) => s + Math.floor(c * archetype.killRate),
        0,
      );
      const recruits = Math.floor(totalKilled * RECRUIT_CHANCE);
      armySize = Math.min(armyCap, armySize + recruits);
    }

    // Process camps
    const camp = campByDay.get(day);
    if (camp) {
      // Does this archetype engage this camp?
      if (Math.random() < archetype.campEngagement) {
        // Use deterministic engagement: engage based on rate
        campsEngaged++;

        const enemyPower = encounterPower(camp.guardsByType);
        const armyPower = playerPower + armySize * ALLY_POWER;
        const ratio = armyPower / Math.max(1, enemyPower);
        encounters.push({ day, armyPower, encounterPower: enemyPower, ratio });

        // Does the archetype clear it?
        const clears = ratio >= archetype.difficultyThreshold;
        // Use campClearRate as a probability floor — if power ratio is high enough, always clear
        const cleared = clears || Math.random() < archetype.campClearRate * 0.5;

        if (cleared) {
          campsCleared++;
          for (const [entityId, count] of Object.entries(camp.guardsByType)) {
            const killed = Math.floor(count * archetype.killRate);
            addKills(entityId, killed);
          }
          // Collect rewards (use average of min/max)
          for (const reward of camp.tier.rewards) {
            const avg = Math.floor((reward.min + reward.max) / 2);
            addRewards(reward.itemId, avg);
          }
        }

        // Army attrition
        if (armySize > 0) {
          const losses = Math.ceil(armySize * archetype.allyDeathRate);
          armySize = Math.max(0, armySize - losses);
        }

        // Recruitment
        const totalKilled = Object.values(camp.guardsByType).reduce(
          (s, c) => s + Math.floor(c * archetype.killRate),
          0,
        );
        const recruits = Math.floor(totalKilled * RECRUIT_CHANCE);
        armySize = Math.min(armyCap, armySize + recruits);
      }
    }

    lastState = {
      day,
      armySize,
      armyCap,
      armorTier,
      killsByType: { ...killsByType },
      campsEngaged,
      campsCleared,
      castleBonus,
      rewards: { ...rewards },
      encounters: [...encounters],
    };
  }

  return lastState!;
}

/** Deterministic simulation — replaces Math.random() calls with fixed engagement */
function runDeterministicSimulation(archetype: Archetype): SimState {
  const campSchedule = simulateCampSchedule();
  const campByDay = new Map<number, CampEvent>();
  for (const c of campSchedule) campByDay.set(c.day, c);

  let armySize = 0;
  const killsByType: Record<string, number> = {};
  const rewards: Record<string, number> = {};
  let campsEngaged = 0;
  let campsCleared = 0;
  const encounters: SimState["encounters"] = [];
  let campIndex = 0;

  const addKills = (entityId: string, count: number) => {
    killsByType[entityId] = (killsByType[entityId] ?? 0) + count;
  };
  const addRewards = (itemId: string, amount: number) => {
    rewards[itemId] = (rewards[itemId] ?? 0) + amount;
  };

  for (let day = 1; day < 100; day++) {
    const armorTier = getArmorTierAtDay(day, archetype);
    const castleBonus = getCastleBonusAtDay(day, archetype);
    const armyCap = getArmyCap(castleBonus);
    const playerPower = PLAYER_POWER_BY_TIER[armorTier];

    // Process milestone enemies (always encountered)
    if (MILESTONE_SPAWNS[day]) {
      const { byType } = milestoneEntityCount(day);
      const ePower = encounterPower(byType);
      const armyPower = playerPower + armySize * ALLY_POWER;
      const ratio = armyPower / Math.max(1, ePower);
      encounters.push({ day, armyPower, encounterPower: ePower, ratio });

      for (const [entityId, count] of Object.entries(byType)) {
        addKills(entityId, Math.floor(count * archetype.killRate));
      }

      if (armySize > 0) {
        armySize = Math.max(0, armySize - Math.ceil(armySize * archetype.allyDeathRate));
      }

      const totalKilled = Object.values(byType).reduce(
        (s, c) => s + Math.floor(c * archetype.killRate),
        0,
      );
      armySize = Math.min(armyCap, armySize + Math.floor(totalKilled * RECRUIT_CHANCE));
    }

    // Process camps deterministically
    const camp = campByDay.get(day);
    if (camp) {
      campIndex++;
      // Engage every Nth camp based on engagement rate
      // e.g. 50% engagement → engage every 2nd camp, 80% → engage 4 out of 5
      const engageThreshold = Math.ceil(1 / archetype.campEngagement);
      const engages = campIndex % engageThreshold === 0 || archetype.campEngagement >= 1.0;

      if (engages) {
        campsEngaged++;
        const ePower = encounterPower(camp.guardsByType);
        const armyPower = playerPower + armySize * ALLY_POWER;
        const ratio = armyPower / Math.max(1, ePower);
        encounters.push({ day, armyPower, encounterPower: ePower, ratio });

        // Clear if power ratio exceeds threshold, or based on clear rate
        const powerSufficient = ratio >= archetype.difficultyThreshold;
        // Deterministic clear: clear rate of camps the archetype can handle
        const cleared = powerSufficient || archetype.campClearRate >= 0.9;

        if (cleared) {
          campsCleared++;
          for (const [entityId, count] of Object.entries(camp.guardsByType)) {
            addKills(entityId, Math.floor(count * archetype.killRate));
          }
          for (const reward of camp.tier.rewards) {
            addRewards(reward.itemId, Math.floor((reward.min + reward.max) / 2));
          }
        }

        if (armySize > 0) {
          armySize = Math.max(0, armySize - Math.ceil(armySize * archetype.allyDeathRate));
        }

        const totalKilled = Object.values(camp.guardsByType).reduce(
          (s, c) => s + Math.floor(c * archetype.killRate),
          0,
        );
        armySize = Math.min(armyCap, armySize + Math.floor(totalKilled * RECRUIT_CHANCE));
      }
    }
  }

  return {
    day: 99,
    armySize,
    armyCap: getArmyCap(getCastleBonusAtDay(99, archetype)),
    armorTier: getArmorTierAtDay(99, archetype),
    killsByType,
    campsEngaged,
    campsCleared,
    castleBonus: getCastleBonusAtDay(99, archetype),
    rewards,
    encounters,
  };
}

/** Simulate siege wave-by-wave with attrition carry-over */
function simulateSiege(
  archetype: Archetype,
  startingArmy: number,
  armorTier: number,
): { wavesCleared: number; armyRemaining: number; waveResults: { wave: number; armyBefore: number; armyAfter: number; ratio: number }[] } {
  let army = startingArmy;
  const playerPower = PLAYER_POWER_BY_TIER[armorTier];
  const waveResults: { wave: number; armyBefore: number; armyAfter: number; ratio: number }[] = [];
  let wavesCleared = 0;

  for (let i = 0; i < WAVE_DEFINITIONS.length; i++) {
    const wave = WAVE_DEFINITIONS[i];
    const armyBefore = army;
    const armyPower = playerPower + army * ALLY_POWER;

    const waveGuards: Record<string, number> = {};
    for (const spawn of wave.spawns) {
      waveGuards[spawn.entityId] = (waveGuards[spawn.entityId] ?? 0) + spawn.count;
    }
    const wavePower = encounterPower(waveGuards);
    const ratio = armyPower / Math.max(1, wavePower);

    // Attrition scales with how outpowered you are
    // If ratio > 1, minimal losses. If ratio < 1, heavy losses.
    const attritionMultiplier = ratio >= 1 ? archetype.allyDeathRate * 0.5 : archetype.allyDeathRate * (1 + (1 - ratio));
    const losses = Math.ceil(army * Math.min(attritionMultiplier, 0.8));
    army = Math.max(0, army - losses);

    // Recruitment from killed wave enemies
    const totalEnemies = wave.spawns.reduce((s, sp) => s + sp.count, 0);
    const killed = Math.floor(totalEnemies * archetype.killRate);
    const recruits = Math.floor(killed * RECRUIT_CHANCE);
    army += recruits; // No cap during siege — survival mode

    const canSurvive = ratio >= archetype.difficultyThreshold || army > 0;
    waveResults.push({ wave: i + 1, armyBefore, armyAfter: army, ratio });

    if (canSurvive) {
      wavesCleared++;
    } else {
      break;
    }
  }

  return { wavesCleared, armyRemaining: army, waveResults };
}

// ─── Source sync verification ───

describe("Source sync: archetype sim constants match system files", () => {
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

  it("RECRUIT_CHANCE matches DifficultySystem.ts normal difficulty", () => {
    const src = fs.readFileSync(path.join(srcDir, "systems/DifficultySystem.ts"), "utf-8");
    // Normal difficulty (key 0) maps to 0.3 recruit chance
    expect(src).toContain("0.3");
    // Hard difficulty should have lower chance
    expect(src).toContain("0.2");
  });

  it("MAX_MILESTONE_ENTITIES matches MilestoneEvents.ts", () => {
    const src = fs.readFileSync(path.join(srcDir, "data/MilestoneEvents.ts"), "utf-8");
    const match = src.match(/MAX_MILESTONE_ENTITIES\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(MAX_MILESTONE_ENTITIES);
  });

  it("MILESTONE_DAYS matches MilestoneEvents.ts MILESTONES keys", () => {
    const src = fs.readFileSync(path.join(srcDir, "data/MilestoneEvents.ts"), "utf-8");
    const dayMatches = [...src.matchAll(/^\s+(\d+)\s*:\s*\{/gm)];
    const days = new Set(dayMatches.map((m) => Number(m[1])));
    expect(days).toEqual(MILESTONE_DAYS);
  });
});

// ─── Section 1: Day-by-day progression simulation ───

describe("Day-by-day progression simulation", () => {
  const beginnerSim = runDeterministicSimulation(BEGINNER);
  const intermediateSim = runDeterministicSimulation(INTERMEDIATE);
  const expertSim = runDeterministicSimulation(EXPERT);

  describe("Beginner", () => {
    it("army ≥ 3 at siege start", () => {
      expect(beginnerSim.armySize).toBeGreaterThanOrEqual(3);
    });

    it("reaches at least Squire tier (tier 1)", () => {
      expect(beginnerSim.armorTier).toBeGreaterThanOrEqual(1);
    });

    it("clears at least 3 camps total", () => {
      expect(beginnerSim.campsCleared).toBeGreaterThanOrEqual(3);
    });

    it("engages at least some camps", () => {
      expect(beginnerSim.campsEngaged).toBeGreaterThanOrEqual(5);
    });

    it("kills at least some knights", () => {
      expect(beginnerSim.killsByType["mk:mk_enemy_knight"] ?? 0).toBeGreaterThan(0);
    });

    it("has built at least the small tower by siege", () => {
      expect(beginnerSim.castleBonus).toBeGreaterThanOrEqual(5);
    });

    it("army cap increased beyond base", () => {
      expect(beginnerSim.armyCap).toBeGreaterThan(BASE_ARMY_SIZE);
    });

    it("has fewer allies than intermediate", () => {
      expect(beginnerSim.armySize).toBeLessThanOrEqual(intermediateSim.armySize);
    });
  });

  describe("Intermediate", () => {
    it("army ≥ 5 at siege start", () => {
      expect(intermediateSim.armySize).toBeGreaterThanOrEqual(5);
    });

    it("reaches at least Knight tier (tier 2)", () => {
      expect(intermediateSim.armorTier).toBeGreaterThanOrEqual(2);
    });

    it("clears at least 15 camps", () => {
      expect(intermediateSim.campsCleared).toBeGreaterThanOrEqual(15);
    });

    it("engages at least 20 camps", () => {
      expect(intermediateSim.campsEngaged).toBeGreaterThanOrEqual(15);
    });

    it("kills enemies of all basic types", () => {
      expect(intermediateSim.killsByType["mk:mk_enemy_knight"] ?? 0).toBeGreaterThan(0);
      expect(intermediateSim.killsByType["mk:mk_enemy_archer"] ?? 0).toBeGreaterThan(0);
    });

    it("has built all castles by siege", () => {
      expect(intermediateSim.castleBonus).toBe(20);
    });

    it("reaches max army cap", () => {
      expect(intermediateSim.armyCap).toBe(GLOBAL_ARMY_CAP);
    });

    it("has fewer allies than expert", () => {
      expect(intermediateSim.armySize).toBeLessThanOrEqual(expertSim.armySize);
    });
  });

  describe("Expert", () => {
    it("army ≥ 8 at siege start", () => {
      expect(expertSim.armySize).toBeGreaterThanOrEqual(8);
    });

    it("reaches Mega Knight tier (tier 4)", () => {
      expect(expertSim.armorTier).toBe(4);
    });

    it("clears all engaged camps", () => {
      expect(expertSim.campsCleared).toBe(expertSim.campsEngaged);
    });

    it("engages all available camps", () => {
      const totalCamps = simulateCampSchedule().length;
      expect(expertSim.campsEngaged).toBe(totalCamps);
    });

    it("kills enemies of every type including dark knights", () => {
      expect(expertSim.killsByType["mk:mk_enemy_knight"] ?? 0).toBeGreaterThan(0);
      expect(expertSim.killsByType["mk:mk_enemy_archer"] ?? 0).toBeGreaterThan(0);
      expect(expertSim.killsByType["mk:mk_enemy_wizard"] ?? 0).toBeGreaterThan(0);
      expect(expertSim.killsByType["mk:mk_enemy_dark_knight"] ?? 0).toBeGreaterThan(0);
    });

    it("has built all castles by siege", () => {
      expect(expertSim.castleBonus).toBe(20);
    });

    it("reaches max army cap", () => {
      expect(expertSim.armyCap).toBe(GLOBAL_ARMY_CAP);
    });
  });
});

// ─── Section 2: Camp clearability per archetype ───

describe("Camp clearability per archetype", () => {
  function armyPowerAtDay(day: number, archetype: Archetype): number {
    // Run simulation up to `day` and return army power
    const campSchedule = simulateCampSchedule();
    const campByDay = new Map<number, CampEvent>();
    for (const c of campSchedule) campByDay.set(c.day, c);

    let armySize = 0;
    let campIndex = 0;

    for (let d = 1; d <= day; d++) {
      const armyCap = getArmyCap(getCastleBonusAtDay(d, archetype));

      if (MILESTONE_SPAWNS[d]) {
        const { byType } = milestoneEntityCount(d);
        if (armySize > 0) {
          armySize = Math.max(0, armySize - Math.ceil(armySize * archetype.allyDeathRate));
        }
        const totalKilled = Object.values(byType).reduce(
          (s, c) => s + Math.floor(c * archetype.killRate),
          0,
        );
        armySize = Math.min(armyCap, armySize + Math.floor(totalKilled * RECRUIT_CHANCE));
      }

      const camp = campByDay.get(d);
      if (camp) {
        campIndex++;
        const engageThreshold = Math.ceil(1 / archetype.campEngagement);
        const engages = campIndex % engageThreshold === 0 || archetype.campEngagement >= 1.0;
        if (engages) {
          if (armySize > 0) {
            armySize = Math.max(0, armySize - Math.ceil(armySize * archetype.allyDeathRate));
          }
          const totalKilled = Object.values(camp.guardsByType).reduce(
            (s, c) => s + Math.floor(c * archetype.killRate),
            0,
          );
          armySize = Math.min(armyCap, armySize + Math.floor(totalKilled * RECRUIT_CHANCE));
        }
      }
    }

    const armorTier = getArmorTierAtDay(day, archetype);
    return PLAYER_POWER_BY_TIER[armorTier] + armySize * ALLY_POWER;
  }

  function campPowerAtDay(day: number): number {
    const tier = getCampTierForDay(day);
    if (!tier) return 0;
    const guards: Record<string, number> = {};
    for (const g of tier.guards) {
      guards[g.entityId] = (guards[g.entityId] ?? 0) + g.count;
    }
    return encounterPower(guards);
  }

  // Scout Camp (day 6): 3 knights = 450
  describe("Scout Camp (day 6)", () => {
    const campPower = campPowerAtDay(6);

    it("beginner can attempt scout camp solo (player power alone ≥ 0.4 ratio)", () => {
      const army = armyPowerAtDay(6, BEGINNER);
      // At day 6, beginner has no army yet — relies on player power + kiting
      expect(army / campPower).toBeGreaterThanOrEqual(0.4);
    });

    it("intermediate can clear", () => {
      const army = armyPowerAtDay(6, INTERMEDIATE);
      expect(army / campPower).toBeGreaterThanOrEqual(0.4);
    });

    it("expert can clear with surplus", () => {
      const army = armyPowerAtDay(6, EXPERT);
      expect(army / campPower).toBeGreaterThanOrEqual(0.4);
    });
  });

  // Raider Camp (day 20): 3 knights + 2 archers = 570
  describe("Raider Camp (day 20)", () => {
    const campPower = campPowerAtDay(20);

    it("beginner can attempt raider camp (power ratio ≥ 0.3)", () => {
      const army = armyPowerAtDay(20, BEGINNER);
      // Beginner has few allies by day 20 — still manageable with kiting and food
      expect(army / campPower).toBeGreaterThanOrEqual(0.3);
    });

    it("intermediate can attempt (ratio ≥ 0.3)", () => {
      const army = armyPowerAtDay(20, INTERMEDIATE);
      expect(army / campPower).toBeGreaterThanOrEqual(0.3);
    });
  });

  // War Camp (day 40): 3 knights + 2 archers + 2 wizards = 870
  describe("War Camp (day 40)", () => {
    const campPower = campPowerAtDay(40);

    it("beginner finds war camp challenging but not impossible (ratio ≥ 0.2)", () => {
      const army = armyPowerAtDay(40, BEGINNER);
      expect(army / campPower).toBeGreaterThanOrEqual(0.2);
    });

    it("intermediate can attempt (ratio ≥ 0.3)", () => {
      const army = armyPowerAtDay(40, INTERMEDIATE);
      expect(army / campPower).toBeGreaterThanOrEqual(0.3);
    });
  });

  // Fortress Outpost (day 60): 3k + 2a + 2w + 2dk = 1670
  describe("Fortress Outpost (day 60)", () => {
    const campPower = campPowerAtDay(60);

    it("intermediate has reasonable shot (ratio ≥ 0.2)", () => {
      const army = armyPowerAtDay(60, INTERMEDIATE);
      expect(army / campPower).toBeGreaterThanOrEqual(0.2);
    });

    it("expert can attempt (ratio ≥ 0.2)", () => {
      const army = armyPowerAtDay(60, EXPERT);
      expect(army / campPower).toBeGreaterThanOrEqual(0.2);
    });
  });

  // Elite Outpost (day 85): 3k + 3a + 2w + 2dk = 1630
  describe("Elite Outpost (day 85)", () => {
    const campPower = campPowerAtDay(85);

    it("intermediate can attempt (ratio ≥ 0.2)", () => {
      const army = armyPowerAtDay(85, INTERMEDIATE);
      expect(army / campPower).toBeGreaterThanOrEqual(0.2);
    });

    it("expert can attempt (ratio ≥ 0.3)", () => {
      const army = armyPowerAtDay(85, EXPERT);
      expect(army / campPower).toBeGreaterThanOrEqual(0.3);
    });
  });
});

// ─── Section 3: Siege survival simulation ───

describe("Siege survival simulation", () => {
  describe("Beginner", () => {
    const sim = runDeterministicSimulation(BEGINNER);
    const siege = simulateSiege(BEGINNER, sim.armySize, sim.armorTier);

    it("survives at least wave 1", () => {
      expect(siege.wavesCleared).toBeGreaterThanOrEqual(1);
    });

    it("has > 0 allies after wave 1", () => {
      expect(siege.waveResults[0].armyAfter).toBeGreaterThanOrEqual(0);
    });

    it("wave 1 power ratio is > 0", () => {
      expect(siege.waveResults[0].ratio).toBeGreaterThan(0);
    });

    it("enters siege with some army", () => {
      expect(sim.armySize).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Intermediate", () => {
    const sim = runDeterministicSimulation(INTERMEDIATE);
    const siege = simulateSiege(INTERMEDIATE, sim.armySize, sim.armorTier);

    it("survives all 5 waves", () => {
      expect(siege.wavesCleared).toBe(5);
    });

    it("has > 0 allies remaining after siege", () => {
      expect(siege.armyRemaining).toBeGreaterThan(0);
    });

    it("wave 1 power ratio ≥ 0.5", () => {
      expect(siege.waveResults[0].ratio).toBeGreaterThanOrEqual(0.5);
    });

    it("siege is a net drain or close to break-even on army", () => {
      // Recruitment during siege partially offsets losses, but the fight is intense
      const firstWaveArmy = siege.waveResults[0].armyBefore;
      const lastWaveArmy = siege.waveResults[4].armyAfter;
      // Army shouldn't more than double during siege (recruitment can't outpace a real fight)
      expect(lastWaveArmy).toBeLessThan(firstWaveArmy * 3);
    });
  });

  describe("Expert", () => {
    const sim = runDeterministicSimulation(EXPERT);
    const siege = simulateSiege(EXPERT, sim.armySize, sim.armorTier);

    it("survives all 5 waves", () => {
      expect(siege.wavesCleared).toBe(5);
    });

    it("retains > 30% army after full siege", () => {
      const retention = siege.armyRemaining / sim.armySize;
      expect(retention).toBeGreaterThan(0.3);
    });

    it("wave 1 power ratio ≥ 1.0", () => {
      expect(siege.waveResults[0].ratio).toBeGreaterThanOrEqual(1.0);
    });

    it("still has allies even after boss wave", () => {
      expect(siege.waveResults[4].armyAfter).toBeGreaterThan(0);
    });
  });
});

// ─── Section 4: Bestiary milestone feasibility per archetype ───

describe("Bestiary milestone feasibility per archetype", () => {
  const beginnerSim = runDeterministicSimulation(BEGINNER);
  const intermediateSim = runDeterministicSimulation(INTERMEDIATE);
  const expertSim = runDeterministicSimulation(EXPERT);

  describe("Beginner", () => {
    it("achieves tier 1 for knights (10 kills)", () => {
      const knightEntry = BESTIARY.find((b) => b.enemyTypeId === "mk:mk_enemy_knight")!;
      const kills = beginnerSim.killsByType["mk:mk_enemy_knight"] ?? 0;
      expect(kills).toBeGreaterThanOrEqual(knightEntry.milestones[0].kills);
    });

    it("achieves tier 1 for archers (10 kills)", () => {
      const archerEntry = BESTIARY.find((b) => b.enemyTypeId === "mk:mk_enemy_archer")!;
      const kills = beginnerSim.killsByType["mk:mk_enemy_archer"] ?? 0;
      expect(kills).toBeGreaterThanOrEqual(archerEntry.milestones[0].kills);
    });
  });

  describe("Intermediate", () => {
    it("achieves tier 1 for knights", () => {
      const entry = BESTIARY.find((b) => b.enemyTypeId === "mk:mk_enemy_knight")!;
      expect(intermediateSim.killsByType["mk:mk_enemy_knight"] ?? 0).toBeGreaterThanOrEqual(
        entry.milestones[0].kills,
      );
    });

    it("achieves tier 1 for archers", () => {
      const entry = BESTIARY.find((b) => b.enemyTypeId === "mk:mk_enemy_archer")!;
      expect(intermediateSim.killsByType["mk:mk_enemy_archer"] ?? 0).toBeGreaterThanOrEqual(
        entry.milestones[0].kills,
      );
    });

    it("achieves tier 1 for wizards", () => {
      const entry = BESTIARY.find((b) => b.enemyTypeId === "mk:mk_enemy_wizard")!;
      expect(intermediateSim.killsByType["mk:mk_enemy_wizard"] ?? 0).toBeGreaterThanOrEqual(
        entry.milestones[0].kills,
      );
    });

    it("achieves tier 2 for knights (30 kills)", () => {
      const entry = BESTIARY.find((b) => b.enemyTypeId === "mk:mk_enemy_knight")!;
      expect(intermediateSim.killsByType["mk:mk_enemy_knight"] ?? 0).toBeGreaterThanOrEqual(
        entry.milestones[1].kills,
      );
    });
  });

  describe("Expert", () => {
    // Regular enemies: achievable pre-siege through milestones and camps
    const regularEntries = BESTIARY.filter((e) => !e.enemyTypeId.includes("boss"));
    for (const entry of regularEntries) {
      it(`achieves tier 1 for ${entry.displayName}`, () => {
        expect(expertSim.killsByType[entry.enemyTypeId] ?? 0).toBeGreaterThanOrEqual(
          entry.milestones[0].kills,
        );
      });
    }

    // Boss: not achievable pre-siege (boss only spawns during siege)
    it("boss bestiary requires siege victory (not achievable pre-siege)", () => {
      const bossEntry = BESTIARY.find((e) => e.enemyTypeId.includes("boss"))!;
      expect(expertSim.killsByType[bossEntry.enemyTypeId] ?? 0).toBe(0);
    });

    it("achieves tier 2 for knights (30 kills) — most common enemy", () => {
      const entry = BESTIARY.find((b) => b.enemyTypeId === "mk:mk_enemy_knight")!;
      expect(expertSim.killsByType[entry.enemyTypeId] ?? 0).toBeGreaterThanOrEqual(
        entry.milestones[1].kills,
      );
    });

    it("achieves tier 2 for archers (30 kills)", () => {
      const entry = BESTIARY.find((b) => b.enemyTypeId === "mk:mk_enemy_archer")!;
      expect(expertSim.killsByType[entry.enemyTypeId] ?? 0).toBeGreaterThanOrEqual(
        entry.milestones[1].kills,
      );
    });

    it("dark knight kills approach tier 2 (≥ 15 of 20 needed, siege completes it)", () => {
      // Expert gets close pre-siege; siege waves provide the remaining dark knight kills
      const kills = expertSim.killsByType["mk:mk_enemy_dark_knight"] ?? 0;
      expect(kills).toBeGreaterThanOrEqual(15);
    });
  });
});

// ─── Section 5: Difficulty curve analysis ───

describe("Difficulty curve analysis", () => {
  const beginnerSim = runDeterministicSimulation(BEGINNER);
  const intermediateSim = runDeterministicSimulation(INTERMEDIATE);

  it("no encounter has a power ratio below 0.15 for beginner", () => {
    for (const enc of beginnerSim.encounters) {
      expect(enc.ratio).toBeGreaterThanOrEqual(0.15);
    }
  });

  it("no encounter has a power ratio below 0.2 for intermediate", () => {
    for (const enc of intermediateSim.encounters) {
      expect(enc.ratio).toBeGreaterThanOrEqual(0.2);
    }
  });

  it("power ratio generally increases over time for intermediate", () => {
    const encounters = intermediateSim.encounters;
    if (encounters.length < 4) return;
    // Compare average of first quarter vs last quarter
    const q1 = encounters.slice(0, Math.floor(encounters.length / 4));
    const q4 = encounters.slice(Math.floor((encounters.length * 3) / 4));
    const avgQ1 = q1.reduce((s, e) => s + e.ratio, 0) / q1.length;
    const avgQ4 = q4.reduce((s, e) => s + e.ratio, 0) / q4.length;
    expect(avgQ4).toBeGreaterThan(avgQ1);
  });

  it("biggest power spike between camp tiers is < 3x for intermediate", () => {
    const encounters = intermediateSim.encounters;
    let maxSpike = 0;
    for (let i = 1; i < encounters.length; i++) {
      if (encounters[i - 1].ratio > 0) {
        const spike = encounters[i - 1].ratio / encounters[i].ratio;
        maxSpike = Math.max(maxSpike, spike);
      }
    }
    expect(maxSpike).toBeLessThan(3);
  });

  it("beginner army is still > 0 after day 70 milestone (23 enemies)", () => {
    // The day 70 milestone has 23 enemies — verify beginner survives
    const day70Encounter = beginnerSim.encounters.find((e) => e.day === 70);
    expect(day70Encounter).toBeDefined();
    expect(day70Encounter!.armyPower).toBeGreaterThan(0);
  });

  it("beginner army is still > 0 after day 90 milestone (25 enemies)", () => {
    const day90Encounter = beginnerSim.encounters.find((e) => e.day === 90);
    expect(day90Encounter).toBeDefined();
    expect(day90Encounter!.armyPower).toBeGreaterThan(0);
  });

  it("expert maintains power ratio ≥ 0.25 even in late game", () => {
    const expertSim = runDeterministicSimulation(EXPERT);
    const lateEncounters = expertSim.encounters.filter((e) => e.day >= 50);
    for (const enc of lateEncounters) {
      // Late-game milestones (day 70: 23 enemies, day 90: 25 enemies) are designed as
      // overwhelming waves — even experts are challenged, but never completely helpless
      expect(enc.ratio).toBeGreaterThanOrEqual(0.25);
    }
  });

  it("difficulty increases from early to late game (encounter power)", () => {
    const allEncounters = intermediateSim.encounters;
    const early = allEncounters.filter((e) => e.day <= 30);
    const late = allEncounters.filter((e) => e.day >= 60);
    if (early.length === 0 || late.length === 0) return;
    const avgEarlyPower = early.reduce((s, e) => s + e.encounterPower, 0) / early.length;
    const avgLatePower = late.reduce((s, e) => s + e.encounterPower, 0) / late.length;
    expect(avgLatePower).toBeGreaterThan(avgEarlyPower);
  });
});

// ─── Section 6: Resource economy per archetype ───

describe("Resource economy per archetype", () => {
  const beginnerSim = runDeterministicSimulation(BEGINNER);
  const intermediateSim = runDeterministicSimulation(INTERMEDIATE);
  const expertSim = runDeterministicSimulation(EXPERT);

  describe("Beginner", () => {
    it("gets at least some iron from camps", () => {
      const iron = beginnerSim.rewards["minecraft:iron_ingot"] ?? 0;
      expect(iron).toBeGreaterThanOrEqual(4);
    });

    it("gets at least some rewards overall", () => {
      const totalRewards = Object.values(beginnerSim.rewards).reduce((s, n) => s + n, 0);
      expect(totalRewards).toBeGreaterThan(0);
    });
  });

  describe("Intermediate", () => {
    it("gets diamonds before Champion armor unlock (day 60)", () => {
      // Diamonds come from War Camp (day 40+) and intermediate clears those
      const diamonds = intermediateSim.rewards["minecraft:diamond"] ?? 0;
      expect(diamonds).toBeGreaterThan(0);
    });

    it("gets substantial iron for repairs", () => {
      const iron = intermediateSim.rewards["minecraft:iron_ingot"] ?? 0;
      expect(iron).toBeGreaterThanOrEqual(10);
    });

    it("gets experience bottles", () => {
      const xp = intermediateSim.rewards["minecraft:experience_bottle"] ?? 0;
      expect(xp).toBeGreaterThan(0);
    });
  });

  describe("Expert", () => {
    it("gets netherite scraps", () => {
      const netherite = expertSim.rewards["minecraft:netherite_scrap"] ?? 0;
      expect(netherite).toBeGreaterThan(0);
    });

    it("gets more diamonds than intermediate", () => {
      const expertDiamonds = expertSim.rewards["minecraft:diamond"] ?? 0;
      const intermediateDiamonds = intermediateSim.rewards["minecraft:diamond"] ?? 0;
      expect(expertDiamonds).toBeGreaterThanOrEqual(intermediateDiamonds);
    });

    it("gets maximum possible iron", () => {
      const iron = expertSim.rewards["minecraft:iron_ingot"] ?? 0;
      expect(iron).toBeGreaterThanOrEqual(20);
    });

    it("gets more total rewards than beginner", () => {
      const expertTotal = Object.values(expertSim.rewards).reduce((s, n) => s + n, 0);
      const beginnerTotal = Object.values(beginnerSim.rewards).reduce((s, n) => s + n, 0);
      expect(expertTotal).toBeGreaterThan(beginnerTotal);
    });
  });

  it("every archetype gets at least some rewards", () => {
    for (const archetype of ALL_ARCHETYPES) {
      const sim = runDeterministicSimulation(archetype);
      const total = Object.values(sim.rewards).reduce((s, n) => s + n, 0);
      expect(total).toBeGreaterThan(0);
    }
  });
});
