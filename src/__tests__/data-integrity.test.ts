import { describe, it, expect } from "vitest";
import { ARMOR_TIERS } from "../data/ArmorTiers";
import { WAVE_DEFINITIONS } from "../data/WaveDefinitions";
import { CASTLE_BLUEPRINTS } from "../data/CastleBlueprints";
import {
  DAY_CHANGE,
  HUD_ACTION_BAR,
  MILESTONE_TITLE,
  SIEGE_WAVE,
  ALLY_RECRUITED,
  TIER_UNLOCKED,
  ALLY_INFO,
  CASTLE_CAPACITY_UP,
  DEBUG_DAY_SET,
  DEBUG_ALLIES_SPAWNED,
} from "../data/Strings";

describe("ARMOR_TIERS data", () => {
  it("should have exactly 5 tiers", () => {
    expect(ARMOR_TIERS).toHaveLength(5);
  });

  it("tiers should be numbered 0–4 in order", () => {
    ARMOR_TIERS.forEach((tier, i) => {
      expect(tier.tier).toBe(i);
    });
  });

  it("tier names should be non-empty strings", () => {
    ARMOR_TIERS.forEach((tier) => {
      expect(typeof tier.name).toBe("string");
      expect(tier.name.length).toBeGreaterThan(0);
    });
  });

  it("prefix should follow mk_<name> pattern", () => {
    ARMOR_TIERS.forEach((tier) => {
      expect(tier.prefix).toMatch(/^mk_/);
    });
  });

  it("unlock days should be strictly ascending", () => {
    for (let i = 1; i < ARMOR_TIERS.length; i++) {
      expect(ARMOR_TIERS[i].unlockDay).toBeGreaterThan(
        ARMOR_TIERS[i - 1].unlockDay,
      );
    }
  });

  it("page tier (0) should have no token item", () => {
    expect(ARMOR_TIERS[0].tokenItem).toBeNull();
  });

  it("tiers 1–4 should have token items using mk: prefix", () => {
    ARMOR_TIERS.slice(1).forEach((tier) => {
      expect(tier.tokenItem).not.toBeNull();
      expect(tier.tokenItem).toMatch(/^mk:/);
    });
  });

  it("repair items should use minecraft: or mk: namespace", () => {
    ARMOR_TIERS.forEach((tier) => {
      expect(tier.repairItem).toMatch(/^(minecraft:|mk:)/);
    });
  });

  it("durability should strictly increase with tier", () => {
    for (let i = 1; i < ARMOR_TIERS.length; i++) {
      expect(ARMOR_TIERS[i].durability).toBeGreaterThan(
        ARMOR_TIERS[i - 1].durability,
      );
    }
  });

  it("protection values should be positive for all slots", () => {
    ARMOR_TIERS.forEach((tier) => {
      expect(tier.protection.helmet).toBeGreaterThan(0);
      expect(tier.protection.chest).toBeGreaterThan(0);
      expect(tier.protection.legs).toBeGreaterThan(0);
      expect(tier.protection.boots).toBeGreaterThan(0);
    });
  });

  it("chestplate protection should always exceed boots protection", () => {
    ARMOR_TIERS.forEach((tier) => {
      expect(tier.protection.chest).toBeGreaterThan(tier.protection.boots);
    });
  });

  it("total protection should increase with tier", () => {
    const totals = ARMOR_TIERS.map(
      (t) =>
        t.protection.helmet +
        t.protection.chest +
        t.protection.legs +
        t.protection.boots,
    );
    for (let i = 1; i < totals.length; i++) {
      expect(totals[i]).toBeGreaterThan(totals[i - 1]);
    }
  });
});

describe("WAVE_DEFINITIONS data", () => {
  it("should have exactly 5 waves", () => {
    expect(WAVE_DEFINITIONS).toHaveLength(5);
  });

  it("wave numbers should be 1–5 in order", () => {
    WAVE_DEFINITIONS.forEach((wave, i) => {
      expect(wave.waveNumber).toBe(i + 1);
    });
  });

  it("all entity IDs should use mk: prefix", () => {
    WAVE_DEFINITIONS.forEach((wave) => {
      wave.spawns.forEach((spawn) => {
        expect(spawn.entityId).toMatch(/^mk:/);
      });
    });
  });

  it("all spawn counts should be positive", () => {
    WAVE_DEFINITIONS.forEach((wave) => {
      wave.spawns.forEach((spawn) => {
        expect(spawn.count).toBeGreaterThan(0);
      });
    });
  });

  it("wave 1 delay should be 0 (immediate start)", () => {
    expect(WAVE_DEFINITIONS[0].delayTicks).toBe(0);
  });

  it("waves 2–5 delay should be positive", () => {
    WAVE_DEFINITIONS.slice(1).forEach((wave) => {
      expect(wave.delayTicks).toBeGreaterThan(0);
    });
  });

  it("boss should appear only in the final wave", () => {
    const bossId = "mk:mk_boss_siege_lord";

    WAVE_DEFINITIONS.slice(0, -1).forEach((wave) => {
      const hasBoss = wave.spawns.some((s) => s.entityId === bossId);
      expect(hasBoss).toBe(false);
    });

    const lastWave = WAVE_DEFINITIONS[WAVE_DEFINITIONS.length - 1];
    const bossSpawn = lastWave.spawns.filter((s) => s.entityId === bossId);
    expect(bossSpawn).toHaveLength(1);
  });

  it("boss spawn count should be exactly 1", () => {
    const lastWave = WAVE_DEFINITIONS[WAVE_DEFINITIONS.length - 1];
    const boss = lastWave.spawns.find(
      (s) => s.entityId === "mk:mk_boss_siege_lord",
    );
    expect(boss?.count).toBe(1);
  });

  it("wave 5 should have more spawns than wave 1", () => {
    const total = (w: (typeof WAVE_DEFINITIONS)[0]) =>
      w.spawns.reduce((sum, s) => sum + s.count, 0);
    expect(total(WAVE_DEFINITIONS[4])).toBeGreaterThan(total(WAVE_DEFINITIONS[0]));
  });

  it("dark_knight should first appear in wave 3 or later", () => {
    const darkKnight = "mk:mk_enemy_dark_knight";
    WAVE_DEFINITIONS.slice(0, 2).forEach((wave) => {
      const hasDarkKnight = wave.spawns.some((s) => s.entityId === darkKnight);
      expect(
        hasDarkKnight,
        `dark_knight should not appear before wave 3 (found in wave ${wave.waveNumber})`,
      ).toBe(false);
    });
    const hasAfterWave3 = WAVE_DEFINITIONS.slice(2).some((wave) =>
      wave.spawns.some((s) => s.entityId === darkKnight),
    );
    expect(hasAfterWave3).toBe(true);
  });
});

describe("CASTLE_BLUEPRINTS data", () => {
  it("should have exactly 3 blueprints", () => {
    expect(Object.keys(CASTLE_BLUEPRINTS)).toHaveLength(3);
  });

  it("keys should be small_tower, gatehouse, great_hall", () => {
    expect(Object.keys(CASTLE_BLUEPRINTS)).toEqual(
      expect.arrayContaining(["small_tower", "gatehouse", "great_hall"]),
    );
  });

  it("id field should match the Record key", () => {
    Object.entries(CASTLE_BLUEPRINTS).forEach(([key, bp]) => {
      expect(bp.id).toBe(key);
    });
  });

  it("structureIds should use megaknights: namespace", () => {
    Object.values(CASTLE_BLUEPRINTS).forEach((bp) => {
      expect(bp.structureId).toMatch(/^megaknights:/);
    });
  });

  it("troop bonuses should all be positive", () => {
    Object.values(CASTLE_BLUEPRINTS).forEach((bp) => {
      expect(bp.troopBonus).toBeGreaterThan(0);
    });
  });

  it("unlock days should be positive and in ascending order", () => {
    const days = Object.values(CASTLE_BLUEPRINTS).map((bp) => bp.unlockDay);
    days.forEach((d) => expect(d).toBeGreaterThan(0));
    for (let i = 1; i < days.length; i++) {
      expect(days[i]).toBeGreaterThan(days[i - 1]);
    }
  });

  it("displayName should be a non-empty string", () => {
    Object.values(CASTLE_BLUEPRINTS).forEach((bp) => {
      expect(typeof bp.displayName).toBe("string");
      expect(bp.displayName.length).toBeGreaterThan(0);
    });
  });
});

describe("Strings template functions", () => {
  it("DAY_CHANGE should include the day number", () => {
    const result = DAY_CHANGE(42);
    expect(result).toContain("42");
  });

  it("MILESTONE_TITLE should include the title text", () => {
    const result = MILESTONE_TITLE("Test Event");
    expect(result).toContain("Test Event");
  });

  it("SIEGE_WAVE should include wave numbers", () => {
    const result = SIEGE_WAVE(3, 5);
    expect(result).toContain("3");
    expect(result).toContain("5");
  });

  it("ALLY_RECRUITED should include the unit's display name", () => {
    const result = ALLY_RECRUITED("Knight");
    expect(result).toContain("Knight");
  });

  it("TIER_UNLOCKED should include the tier name", () => {
    const result = TIER_UNLOCKED("Champion");
    expect(result).toContain("Champion");
  });

  it("ALLY_INFO should include name, hp, and max hp", () => {
    const result = ALLY_INFO("Sir Knight", 25, 30);
    expect(result).toContain("Sir Knight");
    expect(result).toContain("25");
    expect(result).toContain("30");
  });

  it("CASTLE_CAPACITY_UP should include bonus and max values", () => {
    const result = CASTLE_CAPACITY_UP(5, 25);
    expect(result).toContain("5");
    expect(result).toContain("25");
  });

  it("HUD_ACTION_BAR should include day, army size, cap, and tier", () => {
    const result = HUD_ACTION_BAR(50, "████░░░░░░", 12, 20, "Knight");
    expect(result).toContain("50");
    expect(result).toContain("12");
    expect(result).toContain("20");
    expect(result).toContain("Knight");
  });

  it("DEBUG_DAY_SET should include the day number", () => {
    const result = DEBUG_DAY_SET(77);
    expect(result).toContain("77");
  });

  it("DEBUG_ALLIES_SPAWNED should include the count", () => {
    const result = DEBUG_ALLIES_SPAWNED(10);
    expect(result).toContain("10");
  });

  it("all string functions should return strings", () => {
    expect(typeof DAY_CHANGE(1)).toBe("string");
    expect(typeof MILESTONE_TITLE("x")).toBe("string");
    expect(typeof SIEGE_WAVE(1, 5)).toBe("string");
    expect(typeof ALLY_RECRUITED("x")).toBe("string");
    expect(typeof TIER_UNLOCKED("x")).toBe("string");
    expect(typeof ALLY_INFO("x", 1, 1)).toBe("string");
    expect(typeof CASTLE_CAPACITY_UP(1, 1)).toBe("string");
    expect(typeof HUD_ACTION_BAR(1, "", 1, 1, "x")).toBe("string");
    expect(typeof DEBUG_DAY_SET(1)).toBe("string");
    expect(typeof DEBUG_ALLIES_SPAWNED(1)).toBe("string");
  });
});
