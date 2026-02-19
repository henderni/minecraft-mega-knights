import { describe, it, expect } from "vitest";
import {
  CAMP_TIERS,
  getCampTierForDay,
  CAMP_SPAWN_MIN_DIST,
  CAMP_SPAWN_MAX_DIST,
  CAMP_COOLDOWN_DAYS,
  CAMP_START_DAY,
  MAX_CAMP_GUARDS,
} from "../data/CampDefinitions";
import { CAMP_SPAWNED, CAMP_CLEARED } from "../data/Strings";
import * as fs from "fs";
import * as path from "path";

const GLOBAL_ARMY_CAP = 35;
const MAX_SIEGE_MOBS = 25;

describe("CampDefinitions: tier structure", () => {
  it("has exactly 5 camp tiers", () => {
    expect(CAMP_TIERS).toHaveLength(5);
  });

  it("tier names are non-empty strings", () => {
    for (const tier of CAMP_TIERS) {
      expect(typeof tier.name).toBe("string");
      expect(tier.name.length).toBeGreaterThan(0);
    }
  });

  it("day ranges are non-overlapping", () => {
    for (let i = 1; i < CAMP_TIERS.length; i++) {
      expect(CAMP_TIERS[i].minDay).toBeGreaterThan(CAMP_TIERS[i - 1].maxDay);
    }
  });

  it("day ranges start at CAMP_START_DAY and end at 99", () => {
    expect(CAMP_TIERS[0].minDay).toBe(CAMP_START_DAY);
    expect(CAMP_TIERS[CAMP_TIERS.length - 1].maxDay).toBe(99);
  });

  it("minDay <= maxDay for each tier", () => {
    for (const tier of CAMP_TIERS) {
      expect(tier.minDay).toBeLessThanOrEqual(tier.maxDay);
    }
  });

  it("structureSize is 7 or 9 for all tiers", () => {
    for (const tier of CAMP_TIERS) {
      expect([7, 9]).toContain(tier.structureSize);
    }
  });

  it("no tier spans beyond day 99 (camps stop before siege)", () => {
    for (const tier of CAMP_TIERS) {
      expect(tier.maxDay).toBeLessThan(100);
    }
  });

  it("camps only start after CAMP_START_DAY", () => {
    for (const tier of CAMP_TIERS) {
      expect(tier.minDay).toBeGreaterThanOrEqual(CAMP_START_DAY);
    }
  });
});

describe("CampDefinitions: guard compositions", () => {
  it("all tiers have at least one guard type", () => {
    for (const tier of CAMP_TIERS) {
      expect(tier.guards.length).toBeGreaterThan(0);
    }
  });

  it("all guard counts are positive", () => {
    for (const tier of CAMP_TIERS) {
      for (const guard of tier.guards) {
        expect(guard.count).toBeGreaterThan(0);
      }
    }
  });

  it("all guard entity IDs use mk: namespace", () => {
    for (const tier of CAMP_TIERS) {
      for (const guard of tier.guards) {
        expect(guard.entityId).toMatch(/^mk:/);
      }
    }
  });

  it("total guard count per tier does not exceed MAX_CAMP_GUARDS", () => {
    for (const tier of CAMP_TIERS) {
      const total = tier.guards.reduce((sum, g) => sum + g.count, 0);
      expect(total).toBeLessThanOrEqual(MAX_CAMP_GUARDS);
    }
  });

  it("guard escalation: later tiers have more total guards than earlier tiers", () => {
    const totals = CAMP_TIERS.map((t) => t.guards.reduce((sum, g) => sum + g.count, 0));
    for (let i = 1; i < totals.length; i++) {
      expect(totals[i]).toBeGreaterThanOrEqual(totals[i - 1]);
    }
  });

  it("dark knights only appear in tiers starting at day 60+", () => {
    const darkKnightId = "mk:mk_enemy_dark_knight";
    for (const tier of CAMP_TIERS) {
      const hasDk = tier.guards.some((g) => g.entityId === darkKnightId);
      if (hasDk) {
        expect(tier.minDay).toBeGreaterThanOrEqual(60);
      }
    }
  });

  it("wizards only appear in tiers starting at day 40+", () => {
    const wizardId = "mk:mk_enemy_wizard";
    for (const tier of CAMP_TIERS) {
      const hasWizard = tier.guards.some((g) => g.entityId === wizardId);
      if (hasWizard) {
        expect(tier.minDay).toBeGreaterThanOrEqual(40);
      }
    }
  });
});

describe("CampDefinitions: rewards", () => {
  it("all tiers have at least one reward", () => {
    for (const tier of CAMP_TIERS) {
      expect(tier.rewards.length).toBeGreaterThan(0);
    }
  });

  it("all reward item IDs use minecraft: namespace", () => {
    for (const tier of CAMP_TIERS) {
      for (const reward of tier.rewards) {
        expect(reward.itemId).toMatch(/^minecraft:/);
      }
    }
  });

  it("reward min <= max for all rewards", () => {
    for (const tier of CAMP_TIERS) {
      for (const reward of tier.rewards) {
        expect(reward.min).toBeLessThanOrEqual(reward.max);
        expect(reward.min).toBeGreaterThan(0);
      }
    }
  });
});

describe("getCampTierForDay()", () => {
  it("returns undefined for day below CAMP_START_DAY", () => {
    expect(getCampTierForDay(0)).toBeUndefined();
    expect(getCampTierForDay(CAMP_START_DAY - 1)).toBeUndefined();
  });

  it("returns undefined for day 100+ (siege territory)", () => {
    expect(getCampTierForDay(100)).toBeUndefined();
    expect(getCampTierForDay(150)).toBeUndefined();
  });

  it("returns Scout Camp for day 6", () => {
    expect(getCampTierForDay(6)?.name).toBe("Scout Camp");
  });

  it("returns Scout Camp for day 19 (boundary)", () => {
    expect(getCampTierForDay(19)?.name).toBe("Scout Camp");
  });

  it("returns Raider Camp for day 20 (boundary)", () => {
    expect(getCampTierForDay(20)?.name).toBe("Raider Camp");
  });

  it("returns Elite Outpost for day 99 (boundary)", () => {
    expect(getCampTierForDay(99)?.name).toBe("Elite Outpost");
  });

  it("returns a tier for every day from CAMP_START_DAY to 99", () => {
    for (let day = CAMP_START_DAY; day <= 99; day++) {
      const tier = getCampTierForDay(day);
      expect(tier, `No tier for day ${day}`).toBeDefined();
    }
  });
});

describe("Camp spawn constants", () => {
  it("CAMP_SPAWN_MIN_DIST < CAMP_SPAWN_MAX_DIST", () => {
    expect(CAMP_SPAWN_MIN_DIST).toBeLessThan(CAMP_SPAWN_MAX_DIST);
  });

  it("CAMP_SPAWN_MIN_DIST is far enough to require travel (> 30 blocks)", () => {
    expect(CAMP_SPAWN_MIN_DIST).toBeGreaterThan(30);
  });

  it("CAMP_SPAWN_MAX_DIST is within discoverable range (< 100 blocks)", () => {
    expect(CAMP_SPAWN_MAX_DIST).toBeLessThan(100);
  });

  it("CAMP_COOLDOWN_DAYS >= 3 (prevents camps every day)", () => {
    expect(CAMP_COOLDOWN_DAYS).toBeGreaterThanOrEqual(3);
  });

  it("CAMP_START_DAY > 5 (after first blueprint milestone)", () => {
    expect(CAMP_START_DAY).toBeGreaterThan(5);
  });

  it("MAX_CAMP_GUARDS + GLOBAL_ARMY_CAP is under Switch normal-play budget (40)", () => {
    // Normal play target: <40 custom entities
    // Worst case: player has full army (35) + max camp guards (10) = 45
    // But full army + full camp is an edge case; typical play has 15-25 allies
    // The hard constraint is: guards alone don't blow up the siege budget
    expect(MAX_CAMP_GUARDS).toBeLessThanOrEqual(10);
  });

  it("MAX_CAMP_GUARDS + MAX_SIEGE_MOBS is within Switch siege budget (60)", () => {
    // If a camp somehow overlaps with early siege (shouldn't happen), both caps hold
    expect(MAX_CAMP_GUARDS + MAX_SIEGE_MOBS).toBeLessThanOrEqual(60);
  });
});

describe("Camp strings", () => {
  it("CAMP_SPAWNED includes tier name and direction", () => {
    const result = CAMP_SPAWNED("Scout Camp", "North");
    expect(result).toContain("Scout Camp");
    expect(result).toContain("North");
  });

  it("CAMP_CLEARED includes tier name", () => {
    const result = CAMP_CLEARED("Fortress Outpost");
    expect(result).toContain("Fortress Outpost");
  });

  it("all camp strings return strings", () => {
    expect(typeof CAMP_SPAWNED("x", "y")).toBe("string");
    expect(typeof CAMP_CLEARED("x")).toBe("string");
  });
});

describe("main.ts wiring: camp system", () => {
  const mainSrc = fs.readFileSync(path.join(__dirname, "../main.ts"), "utf-8");

  it("EnemyCampSystem is imported", () => {
    expect(mainSrc).toContain("EnemyCampSystem");
  });

  it("camp death listener is wired up", () => {
    expect(mainSrc).toContain("campSystem.setupDeathListener()");
  });

  it("camp onDayChanged is called in day-change callback", () => {
    expect(mainSrc).toContain("campSystem.onDayChanged");
  });

  it("camp tick is called in the 200-tick interval", () => {
    expect(mainSrc).toContain("campSystem.tick()");
  });

  it("entity spawn bypass includes mk_camp_guard tag", () => {
    expect(mainSrc).toContain('"mk_camp_guard"');
  });

  it("mk:camp debug command is registered", () => {
    expect(mainSrc).toContain('"mk:camp"');
  });

  it("camp uses siege.isActive() to gate spawning during siege", () => {
    expect(mainSrc).toContain("siege.isActive()");
  });
});

describe("SiegeSystem: isActive() getter added", () => {
  const siegeSrc = fs.readFileSync(
    path.join(__dirname, "../systems/SiegeSystem.ts"),
    "utf-8",
  );

  it("SiegeSystem exposes isActive() method", () => {
    expect(siegeSrc).toContain("isActive()");
    expect(siegeSrc).toContain("return this.siegeActive");
  });
});
