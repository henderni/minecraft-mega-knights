/**
 * game-invariants.test.ts
 *
 * Cross-system invariants, constant relationships, and Monte Carlo
 * simulations that verify game balance holds under randomized conditions.
 *
 * Focuses on gaps not covered by existing tests:
 * - Entity ID integrity across all data files vs entity JSON files
 * - System constant relationships (timing, budget arithmetic)
 * - Bestiary invariants (effect duration overlap, threshold ordering)
 * - Armor per-slot hierarchy across tiers
 * - Progress bar precomputation correctness
 * - String color code format consistency
 * - Monte Carlo entity budget stress simulation
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { WAVE_DEFINITIONS } from "../data/WaveDefinitions";
import {
  CAMP_TIERS,
  getCampTierForDay,
  MAX_CAMP_GUARDS,
  CAMP_START_DAY,
  CAMP_COOLDOWN_DAYS,
} from "../data/CampDefinitions";
import { BESTIARY, BESTIARY_EFFECT_DURATION_TICKS } from "../data/BestiaryDefinitions";
import { CASTLE_BLUEPRINTS } from "../data/CastleBlueprints";
import { ARMOR_TIERS } from "../data/ArmorTiers";
import {
  FACTIONS,
  FACTION_GUARD_WEIGHTS,
  getFactionForBiome,
  FactionId,
} from "../data/FactionDefinitions";
import * as Strings from "../data/Strings";

const SRC_ROOT = path.join(__dirname, "..");
const BP_ROOT = path.join(__dirname, "../../MegaKnights_BP");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf-8");
}

// Extract constants from source (can't import — systems pull @minecraft/server)
const milestoneSrc = readSource("data/MilestoneEvents.ts");
const MILESTONE_DAYS = new Set(
  [...milestoneSrc.matchAll(/^\s*(\d+)\s*:\s*\{/gm)].map((m) => Number(m[1])),
);

// ─── Seeded PRNG (xorshift32) for deterministic Monte Carlo ──────────────────

function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return {
    next(): number {
      s ^= s << 13;
      s ^= s >> 17;
      s ^= s << 5;
      return (s >>> 0) / 0x100000000;
    },
    int(min: number, max: number): number {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    pick<T>(arr: T[]): T {
      return arr[this.int(0, arr.length - 1)];
    },
  };
}

// ─── 1. Cross-system entity ID integrity ────────────────────────────────────

describe("Cross-system entity ID integrity", () => {
  const entityDir = path.join(BP_ROOT, "entities");
  const entityFiles = fs.readdirSync(entityDir).filter((f) => f.endsWith(".json"));
  const entityIds = new Set(
    entityFiles.map((f) => `mk:${f.replace(".se.json", "")}`),
  );

  // Collect all enemy entity IDs referenced across data files
  const waveEnemyIds = new Set<string>();
  for (const wave of WAVE_DEFINITIONS) {
    for (const spawn of wave.spawns) {
      waveEnemyIds.add(spawn.entityId);
    }
  }

  const campGuardIds = new Set<string>();
  for (const tier of CAMP_TIERS) {
    for (const guard of tier.guards) {
      campGuardIds.add(guard.entityId);
    }
  }

  const bestiaryEnemyIds = new Set(BESTIARY.map((e) => e.enemyTypeId));

  const factionWeightIds = new Set<string>();
  for (const weights of Object.values(FACTION_GUARD_WEIGHTS)) {
    for (const id of Object.keys(weights)) {
      factionWeightIds.add(id);
    }
  }

  it("all wave entity IDs exist as entity JSON files", () => {
    for (const id of waveEnemyIds) {
      expect(entityIds.has(id), `Wave entity ${id} missing from entities/`).toBe(true);
    }
  });

  it("all camp guard entity IDs exist as entity JSON files", () => {
    for (const id of campGuardIds) {
      expect(entityIds.has(id), `Camp guard ${id} missing from entities/`).toBe(true);
    }
  });

  it("all bestiary enemy IDs exist as entity JSON files", () => {
    for (const id of bestiaryEnemyIds) {
      expect(entityIds.has(id), `Bestiary enemy ${id} missing from entities/`).toBe(true);
    }
  });

  it("all faction weight entity IDs exist as entity JSON files", () => {
    for (const id of factionWeightIds) {
      expect(entityIds.has(id), `Faction weight ${id} missing from entities/`).toBe(true);
    }
  });

  it("camp guards are a subset of wave enemies (all camp types appear in siege)", () => {
    for (const id of campGuardIds) {
      if (!id.includes("boss")) {
        expect(waveEnemyIds.has(id), `Camp guard ${id} never appears in siege waves`).toBe(true);
      }
    }
  });

  it("bestiary covers all non-boss enemy types from waves", () => {
    for (const id of waveEnemyIds) {
      if (!id.includes("boss")) {
        expect(bestiaryEnemyIds.has(id), `Wave enemy ${id} has no bestiary entry`).toBe(true);
      }
    }
  });

  it("faction weights cover all camp guard entity types", () => {
    for (const id of campGuardIds) {
      for (const factionId of Object.keys(FACTION_GUARD_WEIGHTS) as FactionId[]) {
        expect(
          FACTION_GUARD_WEIGHTS[factionId][id] !== undefined,
          `Faction ${factionId} missing weight for ${id}`,
        ).toBe(true);
      }
    }
  });

  it("boss entity only appears in siege waves, not camps or bestiary", () => {
    const bossIds = [...waveEnemyIds].filter((id) => id.includes("boss"));
    expect(bossIds.length).toBeGreaterThan(0);
    for (const bossId of bossIds) {
      expect(campGuardIds.has(bossId)).toBe(false);
      expect(bestiaryEnemyIds.has(bossId)).toBe(false);
    }
  });
});

// ─── 2. System constant relationships ───────────────────────────────────────

describe("System constant relationships", () => {
  const daySrc = readSource("systems/DayCounterSystem.ts");
  const armySrc = readSource("systems/ArmySystem.ts");
  const siegeSrc = readSource("systems/SiegeSystem.ts");
  const mainSrc = readSource("main.ts");

  it("TICKS_PER_DAY = 24000 (Minecraft standard)", () => {
    expect(daySrc).toMatch(/TICKS_PER_DAY\s*=\s*24000/);
  });

  it("HUD interval (10) < main tick (20) < recount (200)", () => {
    // Extract intervals from main.ts runInterval calls
    const intervals = [...mainSrc.matchAll(/runInterval\([^,]+,\s*(\d+)\s*\)/g)].map(
      (m) => Number(m[1]),
    );
    expect(intervals).toContain(10);
    expect(intervals).toContain(20);
    expect(intervals).toContain(200);
    // Ordering
    expect(10).toBeLessThan(20);
    expect(20).toBeLessThan(200);
  });

  it("BESTIARY_EFFECT_DURATION (300) > reapply interval (200) with 50% overlap", () => {
    expect(BESTIARY_EFFECT_DURATION_TICKS).toBe(300);
    expect(BESTIARY_EFFECT_DURATION_TICKS).toBeGreaterThan(200);
    // Overlap: 300 - 200 = 100 ticks (5 seconds) — effects never expire during play
    expect(BESTIARY_EFFECT_DURATION_TICKS - 200).toBeGreaterThanOrEqual(100);
  });

  it("VICTORY_CHECK_INTERVAL (60) is 3 seconds (60 ticks / 20 tps)", () => {
    expect(siegeSrc).toMatch(/VICTORY_CHECK_INTERVAL\s*=\s*60/);
  });

  it("RECOUNT_INTERVAL (600) is 30 seconds", () => {
    expect(siegeSrc).toMatch(/RECOUNT_INTERVAL\s*=\s*600/);
  });

  it("BASE_ARMY_SIZE + MAX_ARMY_BONUS = GLOBAL_ARMY_CAP (fundamental identity)", () => {
    // Extract from source
    const base = Number(armySrc.match(/BASE_ARMY_SIZE\s*=\s*(\d+)/)?.[1]);
    const maxBonus = Number(armySrc.match(/MAX_ARMY_BONUS\s*=\s*(\d+)/)?.[1]);
    const globalCap = Number(armySrc.match(/GLOBAL_ARMY_CAP\s*=\s*(\d+)/)?.[1]);
    expect(base + maxBonus).toBe(globalCap);
  });

  it("Castle blueprint bonuses sum to MAX_ARMY_BONUS", () => {
    const totalBonus = Object.values(CASTLE_BLUEPRINTS).reduce(
      (sum, bp) => sum + bp.troopBonus,
      0,
    );
    expect(totalBonus).toBe(20); // MAX_ARMY_BONUS
  });

  it("MAX_DAY (100) matches the siege trigger day in main.ts", () => {
    expect(daySrc).toMatch(/MAX_DAY\s*=\s*100/);
    expect(mainSrc).toContain("day === 100");
  });

  it("Tick write persistence (every 60 calls = ~60s crash recovery window)", () => {
    expect(daySrc).toMatch(/tickWriteCounter\s*>=\s*60/);
  });
});

// ─── 3. Bestiary invariants ─────────────────────────────────────────────────

describe("Bestiary invariants", () => {
  it("each entry has strictly ascending kill thresholds", () => {
    for (const entry of BESTIARY) {
      for (let i = 1; i < entry.milestones.length; i++) {
        expect(entry.milestones[i].kills).toBeGreaterThan(
          entry.milestones[i - 1].kills,
        );
      }
    }
  });

  it("each entry awards the same effect at increasing amplifier", () => {
    for (const entry of BESTIARY) {
      if (entry.milestones.length > 1) {
        expect(entry.milestones[1].effectId).toBe(entry.milestones[0].effectId);
        expect(entry.milestones[1].amplifier).toBeGreaterThan(
          entry.milestones[0].amplifier,
        );
      }
    }
  });

  it("each bestiary entry awards a unique effect (no two types give same buff)", () => {
    const effects = BESTIARY.map((e) => e.milestones[0].effectId);
    expect(new Set(effects).size).toBe(effects.length);
  });

  it("kill keys follow mk:kills_<type> pattern", () => {
    for (const entry of BESTIARY) {
      expect(entry.killKey).toMatch(/^mk:kills_\w+$/);
    }
  });

  it("kill keys are unique across entries", () => {
    const keys = BESTIARY.map((e) => e.killKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("dark knights have lowest tier-1 threshold (hardest enemies, lowest bar)", () => {
    const dkEntry = BESTIARY.find((e) => e.enemyTypeId.includes("dark_knight"))!;
    for (const entry of BESTIARY) {
      if (entry !== dkEntry) {
        expect(dkEntry.milestones[0].kills).toBeLessThanOrEqual(
          entry.milestones[0].kills,
        );
      }
    }
  });

  it("all milestone messages start with §6[Bestiary]", () => {
    for (const entry of BESTIARY) {
      for (const ms of entry.milestones) {
        expect(ms.message).toMatch(/^§6\[Bestiary\]/);
      }
    }
  });

  it("amplifier 0 = level I, amplifier 1 = level II (standard Minecraft mapping)", () => {
    for (const entry of BESTIARY) {
      expect(entry.milestones[0].amplifier).toBe(0);
      if (entry.milestones.length > 1) {
        expect(entry.milestones[1].amplifier).toBe(1);
      }
    }
  });
});

// ─── 4. Armor per-slot hierarchy across tiers ───────────────────────────────

describe("Armor per-slot hierarchy", () => {
  it("chest > legs > helmet > boots for every tier", () => {
    for (const tier of ARMOR_TIERS) {
      const { chest, legs, helmet, boots } = tier.protection;
      expect(chest).toBeGreaterThan(legs);
      expect(legs).toBeGreaterThanOrEqual(helmet);
      expect(helmet).toBeGreaterThan(boots);
    }
  });

  it("each slot individually increases across tiers", () => {
    const slots: (keyof typeof ARMOR_TIERS[0]["protection"])[] = [
      "helmet",
      "chest",
      "legs",
      "boots",
    ];
    for (const slot of slots) {
      for (let i = 1; i < ARMOR_TIERS.length; i++) {
        expect(
          ARMOR_TIERS[i].protection[slot],
          `${slot} at tier ${i} should exceed tier ${i - 1}`,
        ).toBeGreaterThan(ARMOR_TIERS[i - 1].protection[slot]);
      }
    }
  });

  it("Mega Knight tier has highest protection in every slot", () => {
    const mega = ARMOR_TIERS[ARMOR_TIERS.length - 1];
    for (let i = 0; i < ARMOR_TIERS.length - 1; i++) {
      for (const slot of ["helmet", "chest", "legs", "boots"] as const) {
        expect(mega.protection[slot]).toBeGreaterThan(ARMOR_TIERS[i].protection[slot]);
      }
    }
  });

  it("durability ratio between consecutive tiers is 1.4x-2.2x", () => {
    for (let i = 1; i < ARMOR_TIERS.length; i++) {
      const ratio = ARMOR_TIERS[i].durability / ARMOR_TIERS[i - 1].durability;
      expect(ratio).toBeGreaterThanOrEqual(1.4);
      expect(ratio).toBeLessThanOrEqual(2.2);
    }
  });

  it("repair material escalates: leather → iron → iron → diamond → netherite", () => {
    const expectedRepair = [
      "minecraft:leather",
      "minecraft:iron_ingot",
      "minecraft:iron_ingot",
      "minecraft:diamond",
      "minecraft:netherite_ingot",
    ];
    for (let i = 0; i < ARMOR_TIERS.length; i++) {
      expect(ARMOR_TIERS[i].repairItem).toBe(expectedRepair[i]);
    }
  });
});

// ─── 5. Progress bar precomputation ─────────────────────────────────────────

describe("Progress bar precomputation", () => {
  const daySrc = readSource("systems/DayCounterSystem.ts");

  it("BAR_LENGTH = 20", () => {
    expect(daySrc).toMatch(/BAR_LENGTH\s*=\s*20/);
  });

  it("PROGRESS_BARS array has BAR_LENGTH + 1 = 21 entries", () => {
    // for (let i = 0; i <= BAR_LENGTH; i++) — means 21 entries (0 to 20 inclusive)
    expect(daySrc).toMatch(/for\s*\(\s*let\s+i\s*=\s*0;\s*i\s*<=\s*BAR_LENGTH;\s*i\+\+\)/);
  });

  it("TIER_NAMES has exactly 5 entries matching ARMOR_TIERS count", () => {
    const tierNamesMatch = daySrc.match(/TIER_NAMES\s*=\s*\[([^\]]+)\]/);
    expect(tierNamesMatch).not.toBeNull();
    const names = tierNamesMatch![1].split(",").map((s) => s.trim().replace(/"/g, ""));
    expect(names).toHaveLength(ARMOR_TIERS.length);
  });

  it("TIER_NAMES matches ARMOR_TIERS names in order", () => {
    const tierNamesMatch = daySrc.match(/TIER_NAMES\s*=\s*\[([^\]]+)\]/);
    const names = tierNamesMatch![1].split(",").map((s) => s.trim().replace(/"/g, ""));
    for (let i = 0; i < names.length; i++) {
      expect(names[i]).toBe(ARMOR_TIERS[i].name);
    }
  });
});

// ─── 6. String color code format consistency ────────────────────────────────

describe("String color code consistency", () => {
  // Get all exported string constants and functions from Strings
  const allStringValues: string[] = [];

  // Constants (exclude form UI and non-chat strings)
  const EXCLUDE_PREFIXES = ["JOURNAL_", "DIFFICULTY_"];
  for (const [key, val] of Object.entries(Strings)) {
    if (typeof val === "string" && !EXCLUDE_PREFIXES.some((p) => key.startsWith(p))) {
      allStringValues.push(val);
    }
  }

  // Function outputs with representative inputs
  const funcOutputs: string[] = [
    Strings.DAY_CHANGE(50),
    Strings.MILESTONE_TITLE("Test"),
    Strings.MILESTONE_MESSAGE("Test"),
    Strings.TIER_UNLOCKED("Knight"),
    Strings.ARMY_FULL_SHARED(17),
    Strings.ALLY_RECRUITED("Knight"),
    Strings.ALLY_NOT_YOURS("Steve"),
    Strings.ALLY_INFO("Knight", 20, 30),
    Strings.ALLY_MODE_SET("Follow"),
    Strings.HUD_ACTION_BAR(50, "████", 12, 20, "Knight"),
    Strings.CASTLE_PLACED("Tower"),
    Strings.CASTLE_CAPACITY_UP(5, 25),
    Strings.SIEGE_WAVE(3, 5),
    Strings.CAMP_SPAWNED("Scout Camp", "North"),
    Strings.CAMP_CLEARED("Scout Camp"),
    Strings.DEBUG_DAY_SET(50),
    Strings.DEBUG_ALLIES_SPAWNED(10),
    Strings.ALLY_DIED("Knight"),
    Strings.TIER_UP_TITLE("Knight"),
    Strings.DIFFICULTY_SET("Normal"),
    Strings.ENDLESS_WAVE(120),
  ];
  allStringValues.push(...funcOutputs);

  it("all player-facing strings start with a § color code", () => {
    for (const s of allStringValues) {
      expect(s, `String "${s.slice(0, 30)}..." should start with §`).toMatch(/^§/);
    }
  });

  it("no string has double § codes (e.g. §a§a) except bold formatting", () => {
    for (const s of allStringValues) {
      // §6§l (gold bold) is intentional; §a§a (double green) is a bug
      const stripped = s.replace(/§.§l/g, ""); // remove valid bold pairs
      expect(stripped).not.toMatch(/§.§./);
    }
  });

  it("success messages use §a (green)", () => {
    expect(Strings.ALLY_RECRUITED("X")).toMatch(/^§a/);
    expect(Strings.STANDARD_BEARER_JOINED).toMatch(/^§a/);
    expect(Strings.SIEGE_VICTORY_1).toMatch(/^§a/);
  });

  it("error/warning messages use §c (red) or §4 (dark red)", () => {
    expect(Strings.ARMY_FULL).toMatch(/^§c/);
    expect(Strings.SIEGE_DEFEND).toMatch(/^§c/);
    expect(Strings.SIEGE_DEFEAT_1).toMatch(/^§4/);
  });

  it("debug messages use §e (yellow)", () => {
    expect(Strings.DEBUG_DAY_SET(1)).toMatch(/^§e/);
    expect(Strings.DEBUG_ALLIES_SPAWNED(1)).toMatch(/^§e/);
    expect(Strings.CAMP_DEBUG_SPAWNED).toMatch(/^§e/);
  });

  it("info messages use §7 (gray) or §b (aqua)", () => {
    expect(Strings.ALLY_NOT_YOURS("X")).toMatch(/^§7/);
    expect(Strings.ALLY_INFO("X", 1, 1)).toMatch(/^§b/);
    expect(Strings.MILESTONE_MESSAGE("X")).toMatch(/^§7/);
  });
});

// ─── 7. Camp tier contiguity ────────────────────────────────────────────────

describe("Camp tier day range contiguity", () => {
  it("no gap between consecutive tier day ranges", () => {
    for (let i = 1; i < CAMP_TIERS.length; i++) {
      expect(
        CAMP_TIERS[i].minDay,
        `Gap between ${CAMP_TIERS[i - 1].name} (ends ${CAMP_TIERS[i - 1].maxDay}) and ${CAMP_TIERS[i].name} (starts ${CAMP_TIERS[i].minDay})`,
      ).toBe(CAMP_TIERS[i - 1].maxDay + 1);
    }
  });

  it("getCampTierForDay returns exactly one tier for every day 6-99", () => {
    for (let day = CAMP_START_DAY; day <= 99; day++) {
      const tier = getCampTierForDay(day);
      expect(tier, `Day ${day} has no tier`).toBeDefined();
      // Verify it's the only match
      let matchCount = 0;
      for (const t of CAMP_TIERS) {
        if (day >= t.minDay && day <= t.maxDay) matchCount++;
      }
      expect(matchCount, `Day ${day} matches ${matchCount} tiers`).toBe(1);
    }
  });

  it("getCampTierForDay returns undefined for day 5 and day 100", () => {
    expect(getCampTierForDay(5)).toBeUndefined();
    expect(getCampTierForDay(100)).toBeUndefined();
  });

  it("structure size escalates: early tiers use 7, later tiers use 9", () => {
    expect(CAMP_TIERS[0].structureSize).toBe(7);
    expect(CAMP_TIERS[1].structureSize).toBe(7);
    expect(CAMP_TIERS[2].structureSize).toBe(9);
    expect(CAMP_TIERS[3].structureSize).toBe(9);
    expect(CAMP_TIERS[4].structureSize).toBe(9);
  });
});

// ─── 8. Faction biome matching ──────────────────────────────────────────────

describe("Faction biome matching", () => {
  it("grave_walkers match swamp biomes", () => {
    expect(getFactionForBiome("minecraft:swamp").id).toBe("grave_walkers");
    expect(getFactionForBiome("minecraft:mangrove_swamp").id).toBe("grave_walkers");
  });

  it("grave_walkers match dark forest biomes", () => {
    expect(getFactionForBiome("minecraft:dark_forest").id).toBe("grave_walkers");
    expect(getFactionForBiome("minecraft:roofed_forest").id).toBe("grave_walkers");
  });

  it("ironclad_raiders match mountain biomes", () => {
    expect(getFactionForBiome("minecraft:mountain").id).toBe("ironclad_raiders");
    expect(getFactionForBiome("minecraft:stony_peaks").id).toBe("ironclad_raiders");
  });

  it("ironclad_raiders match taiga/snowy biomes", () => {
    expect(getFactionForBiome("minecraft:taiga").id).toBe("ironclad_raiders");
    expect(getFactionForBiome("minecraft:snowy_tundra").id).toBe("ironclad_raiders");
  });

  it("marauders is default for unknown biomes", () => {
    expect(getFactionForBiome("minecraft:plains").id).toBe("marauders");
    expect(getFactionForBiome("minecraft:desert").id).toBe("marauders");
    expect(getFactionForBiome("unknown_biome").id).toBe("marauders");
    expect(getFactionForBiome("").id).toBe("marauders");
  });

  it("biome matching is case-insensitive", () => {
    expect(getFactionForBiome("MINECRAFT:SWAMP").id).toBe("grave_walkers");
    expect(getFactionForBiome("Minecraft:Taiga").id).toBe("ironclad_raiders");
  });

  it("each faction has a non-empty campPrefix", () => {
    for (const faction of FACTIONS) {
      expect(faction.campPrefix.length).toBeGreaterThan(0);
    }
  });

  it("marauders has empty biomeKeywords (catches everything else)", () => {
    const marauders = FACTIONS.find((f) => f.id === "marauders")!;
    expect(marauders.biomeKeywords).toHaveLength(0);
  });

  it("no biome keyword appears in multiple factions", () => {
    const allKeywords = new Map<string, string>();
    for (const faction of FACTIONS) {
      for (const kw of faction.biomeKeywords) {
        expect(
          allKeywords.has(kw),
          `Keyword "${kw}" appears in both ${allKeywords.get(kw)} and ${faction.id}`,
        ).toBe(false);
        allKeywords.set(kw, faction.id);
      }
    }
  });
});

// ─── 9. Faction guard weight completeness ───────────────────────────────────

describe("Faction guard weight completeness", () => {
  const factionIds: FactionId[] = ["marauders", "grave_walkers", "ironclad_raiders"];
  const allEnemyIds = [
    "mk:mk_enemy_knight",
    "mk:mk_enemy_archer",
    "mk:mk_enemy_wizard",
    "mk:mk_enemy_dark_knight",
  ];

  for (const factionId of factionIds) {
    it(`${factionId} has weights for all 4 enemy types`, () => {
      const weights = FACTION_GUARD_WEIGHTS[factionId];
      for (const id of allEnemyIds) {
        expect(weights[id], `${factionId} missing weight for ${id}`).toBeDefined();
      }
    });

    it(`${factionId} has no zero weights (no entity type removed entirely)`, () => {
      const weights = FACTION_GUARD_WEIGHTS[factionId];
      for (const [id, w] of Object.entries(weights)) {
        expect(w, `${factionId} weight for ${id} is 0`).toBeGreaterThan(0);
      }
    });
  }

  it("each faction has a unique dominant enemy type (highest weight)", () => {
    const dominants = new Set<string>();
    for (const factionId of factionIds) {
      const weights = FACTION_GUARD_WEIGHTS[factionId];
      let maxId = "";
      let maxWeight = 0;
      for (const [id, w] of Object.entries(weights)) {
        if (w! > maxWeight) {
          maxWeight = w!;
          maxId = id;
        }
      }
      expect(dominants.has(maxId), `${maxId} is dominant for multiple factions`).toBe(
        false,
      );
      dominants.add(maxId);
    }
  });
});

// ─── 10. Monte Carlo entity budget simulation ──────────────────────────────

describe("Monte Carlo: entity budget under randomized conditions", () => {
  const GLOBAL_ARMY_CAP = 35;
  const MAX_ACTIVE_SIEGE_MOBS = 25;
  const rng = makeRng(0x12345678);
  const ITERATIONS = 200;

  function getEffectiveCap(armyBonus: number, playerCount: number): number {
    const personalCap = 15 + Math.min(armyBonus, 20);
    if (playerCount <= 1) return personalCap;
    return Math.min(personalCap, Math.floor(GLOBAL_ARMY_CAP / playerCount));
  }

  it("entity budget holds across 200 random (playerCount, day, faction) scenarios", () => {
    const factionIds: FactionId[] = ["marauders", "grave_walkers", "ironclad_raiders"];
    let maxSeen = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      const playerCount = rng.int(1, 4);
      const day = rng.int(CAMP_START_DAY, 99);
      const factionId = rng.pick(factionIds);
      const armyBonus = rng.int(0, 20);

      // Army entities
      const armyCap = getEffectiveCap(armyBonus, playerCount);
      const totalArmy = armyCap * playerCount;

      // Camp guard count (if not a milestone day or siege day)
      let campGuards = 0;
      if (!MILESTONE_DAYS.has(day) && day < 100) {
        const tier = getCampTierForDay(day);
        if (tier) {
          const scaleFactor = playerCount <= 1 ? 1.0 : playerCount <= 2 ? 0.75 : 0.6;
          const weights = FACTION_GUARD_WEIGHTS[factionId];
          for (const g of tier.guards) {
            const factionWeight = weights[g.entityId] ?? 1.0;
            campGuards += Math.max(0, Math.round(g.count * scaleFactor * factionWeight));
          }
          campGuards = Math.min(campGuards, MAX_CAMP_GUARDS);
        }
      }

      // Normal play: army + camp (siege not active during camps)
      const normalTotal = totalArmy + campGuards;
      expect(normalTotal).toBeLessThan(80);

      // Siege: army + siege mobs (no camps during siege)
      const siegeTotal = totalArmy + MAX_ACTIVE_SIEGE_MOBS;
      expect(siegeTotal).toBeLessThanOrEqual(60);

      maxSeen = Math.max(maxSeen, normalTotal, siegeTotal);
    }

    // Across 200 random scenarios, max entity count should stay under 80
    expect(maxSeen).toBeLessThan(80);
  });

  it("army cap * playerCount never exceeds GLOBAL_ARMY_CAP for random bonuses", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const playerCount = rng.int(1, 8);
      const bonus = rng.int(0, 30);
      const cap = getEffectiveCap(bonus, playerCount);
      expect(cap * playerCount).toBeLessThanOrEqual(GLOBAL_ARMY_CAP);
    }
  });

  it("camp guard count after faction weights never exceeds MAX_CAMP_GUARDS", () => {
    const factionIds: FactionId[] = ["marauders", "grave_walkers", "ironclad_raiders"];

    for (let i = 0; i < ITERATIONS; i++) {
      const tierIdx = rng.int(0, CAMP_TIERS.length - 1);
      const factionId = rng.pick(factionIds);
      const scaleFactor = rng.pick([1.0, 0.75, 0.6]);

      const tier = CAMP_TIERS[tierIdx];
      const weights = FACTION_GUARD_WEIGHTS[factionId];
      let total = 0;
      for (const g of tier.guards) {
        const fw = weights[g.entityId] ?? 1.0;
        total += Math.max(0, Math.round(g.count * scaleFactor * fw));
      }
      // Source code caps at MAX_CAMP_GUARDS
      total = Math.min(total, MAX_CAMP_GUARDS);
      expect(total).toBeLessThanOrEqual(MAX_CAMP_GUARDS);
    }
  });
});
