/**
 * Game systems integrity tests.
 *
 * Covers:
 * - MILESTONE_DAYS consistency between EnemyCampSystem and MilestoneEvents
 * - Compass direction math (8 cardinal/intercardinal directions)
 * - Scroll item ID consistency across code, trade table, and item definition
 * - Multiplayer entity budget safety (allies + siege ≤ Switch limit)
 * - Bestiary kill threshold ordering
 * - Item texture completeness
 * - MilestoneEvents progression balance
 *
 * Note: MilestoneEvents.ts and other @minecraft/server dependents cannot be
 * directly imported in tests — they are checked via source file text patterns.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { BESTIARY } from "../data/BestiaryDefinitions";

const BP_ROOT = path.join(__dirname, "../../MegaKnights_BP");
const RP_ROOT = path.join(__dirname, "../../MegaKnights_RP");
const SRC_ROOT = path.join(__dirname, "..");

// ─── MILESTONE_DAYS consistency ───────────────────────────────────────────────

/**
 * Parse MILESTONES record keys from MilestoneEvents.ts source text.
 * Extracts the numeric keys directly from the source without importing
 * the module (which depends on @minecraft/server).
 */
function parseMilestoneDaysFromSource(): Set<number> {
  const src = fs.readFileSync(path.join(SRC_ROOT, "data/MilestoneEvents.ts"), "utf-8");
  // Match "  10: {" style keys in the MILESTONES object
  const matches = [...src.matchAll(/^\s{2}(\d+):\s*\{/gm)];
  return new Set(matches.map((m) => parseInt(m[1])));
}

describe("MILESTONE_DAYS: consistency with MILESTONES", () => {
  it("MilestoneEvents.ts exports MILESTONE_DAYS derived from MILESTONES keys", () => {
    const src = fs.readFileSync(path.join(SRC_ROOT, "data/MilestoneEvents.ts"), "utf-8");
    expect(src).toContain("export const MILESTONE_DAYS");
    expect(src).toContain("Object.keys(MILESTONES).map(Number)");
  });

  it("EnemyCampSystem imports MILESTONE_DAYS from MilestoneEvents (not hardcoded)", () => {
    const src = fs.readFileSync(path.join(SRC_ROOT, "systems/EnemyCampSystem.ts"), "utf-8");
    expect(src).toContain("MILESTONE_DAYS");
    expect(src).toContain("MilestoneEvents");
    // Old hardcoded Set literal must be gone
    expect(src).not.toContain("new Set([1, 5, 10");
  });

  it("EnemyCampSystem does not re-declare MILESTONE_DAYS as a local constant", () => {
    const src = fs.readFileSync(path.join(SRC_ROOT, "systems/EnemyCampSystem.ts"), "utf-8");
    // Should not have a local 'const MILESTONE_DAYS =' — it's imported now
    expect(src).not.toMatch(/^const MILESTONE_DAYS\s*=/m);
  });

  it("all MILESTONES keys are within the 100-day quest span (1–99)", () => {
    const days = parseMilestoneDaysFromSource();
    for (const day of days) {
      expect(day, `Milestone day ${day} is out of range`).toBeGreaterThanOrEqual(1);
      expect(day, `Milestone day ${day} is out of range`).toBeLessThanOrEqual(99);
    }
  });

  it("at least 8 milestone days exist (sufficient content for 100-day span)", () => {
    const days = parseMilestoneDaysFromSource();
    expect(days.size).toBeGreaterThanOrEqual(8);
  });

  it("milestone days include first-day orientation and at least day 5 blueprint unlock", () => {
    const days = parseMilestoneDaysFromSource();
    expect(days.has(1), "Missing day 1 milestone (quest start)").toBe(true);
    expect(days.has(5), "Missing day 5 milestone (first blueprint)").toBe(true);
    expect(days.has(10), "Missing day 10 milestone (first enemies)").toBe(true);
  });
});

// ─── Compass direction math ────────────────────────────────────────────────────

/**
 * Pure reimplementation of EnemyCampSystem.getCompassDirection.
 * In Minecraft Bedrock: +X = East, -X = West, +Z = South, -Z = North.
 * cos(angle) = X offset, sin(angle) = Z offset.
 */
function compassDirection(angle: number): string {
  const deg = (((angle * 180) / Math.PI) % 360 + 360) % 360;
  if (deg < 22.5 || deg >= 337.5) return "East";
  if (deg < 67.5) return "Southeast";
  if (deg < 112.5) return "South";
  if (deg < 157.5) return "Southwest";
  if (deg < 202.5) return "West";
  if (deg < 247.5) return "Northwest";
  if (deg < 292.5) return "North";
  return "Northeast";
}

describe("Compass direction math", () => {
  it("angle=0 → East (pure +X offset)", () => {
    expect(compassDirection(0)).toBe("East");
  });

  it("angle=π/4 (45°) → Southeast (+X, +Z)", () => {
    expect(compassDirection(Math.PI / 4)).toBe("Southeast");
  });

  it("angle=π/2 (90°) → South (pure +Z offset)", () => {
    expect(compassDirection(Math.PI / 2)).toBe("South");
  });

  it("angle=3π/4 (135°) → Southwest (-X, +Z)", () => {
    expect(compassDirection((3 * Math.PI) / 4)).toBe("Southwest");
  });

  it("angle=π (180°) → West (pure -X offset)", () => {
    expect(compassDirection(Math.PI)).toBe("West");
  });

  it("angle=5π/4 (225°) → Northwest (-X, -Z)", () => {
    expect(compassDirection((5 * Math.PI) / 4)).toBe("Northwest");
  });

  it("angle=3π/2 (270°) → North (pure -Z offset)", () => {
    expect(compassDirection((3 * Math.PI) / 2)).toBe("North");
  });

  it("angle=7π/4 (315°) → Northeast (+X, -Z)", () => {
    expect(compassDirection((7 * Math.PI) / 4)).toBe("Northeast");
  });

  it("angle=2π wraps to East (same as 0)", () => {
    expect(compassDirection(2 * Math.PI)).toBe("East");
  });

  it("angle=-π/2 wraps to North (same as 3π/2)", () => {
    expect(compassDirection(-Math.PI / 2)).toBe("North");
  });

  it("all 8 directions are reachable from the 8 cardinal angles", () => {
    const angles = [
      0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4,
      Math.PI, (5 * Math.PI) / 4, (3 * Math.PI) / 2, (7 * Math.PI) / 4,
    ];
    const results = new Set(angles.map(compassDirection));
    expect(results.size).toBe(8);
  });

  it("EnemyCampSystem source uses cos=X and sin=Z convention", () => {
    const src = fs.readFileSync(path.join(SRC_ROOT, "systems/EnemyCampSystem.ts"), "utf-8");
    expect(src).toContain("Math.cos(angle)");
    expect(src).toContain("Math.sin(angle)");
  });
});

// ─── Scroll item ID consistency ───────────────────────────────────────────────

describe("Standard bearer scroll: item ID consistency", () => {
  const CORRECT_ID = "mk:mk_standard_bearer_scroll";

  it("main.ts itemUse handler uses the correct full item ID", () => {
    const mainSrc = fs.readFileSync(path.join(SRC_ROOT, "main.ts"), "utf-8");
    expect(mainSrc).toContain(`"${CORRECT_ID}"`);
  });

  it("MerchantSystem clear command uses the correct full item ID", () => {
    const merchantSrc = fs.readFileSync(
      path.join(SRC_ROOT, "systems/MerchantSystem.ts"),
      "utf-8",
    );
    expect(merchantSrc).toContain("mk:mk_standard_bearer_scroll");
  });

  it("trade table gives entry uses the correct full item ID", () => {
    const tradesRaw = fs.readFileSync(
      path.join(BP_ROOT, "trading/mk_merchant_trades.json"),
      "utf-8",
    );
    expect(tradesRaw).toContain(CORRECT_ID);
  });

  it("item definition file uses the correct identifier", () => {
    const itemRaw = fs.readFileSync(
      path.join(BP_ROOT, "items/tools/mk_standard_bearer_scroll.json"),
      "utf-8",
    );
    const item = JSON.parse(itemRaw);
    expect(item["minecraft:item"]?.description?.identifier).toBe(CORRECT_ID);
  });

  it("no code references the old wrong ID mk:standard_bearer_scroll (missing mk_ prefix)", () => {
    const mainSrc = fs.readFileSync(path.join(SRC_ROOT, "main.ts"), "utf-8");
    const merchantSrc = fs.readFileSync(
      path.join(SRC_ROOT, "systems/MerchantSystem.ts"),
      "utf-8",
    );
    expect(mainSrc).not.toContain('"mk:standard_bearer_scroll"');
    expect(merchantSrc).not.toContain("clear @s mk:standard_bearer_scroll 0");
  });

  it("trade table does not use minecraft: namespace for custom items", () => {
    const tradesRaw = fs.readFileSync(
      path.join(BP_ROOT, "trading/mk_merchant_trades.json"),
      "utf-8",
    );
    expect(tradesRaw).not.toContain("minecraft:mk_");
  });
});

// ─── Multiplayer entity budget ─────────────────────────────────────────────────

describe("Multiplayer entity budget safety", () => {
  const GLOBAL_ARMY_CAP = 35;
  const MAX_ACTIVE_SIEGE_MOBS = 25;
  const SWITCH_SIEGE_BUDGET = 60;

  it("GLOBAL_ARMY_CAP + MAX_ACTIVE_SIEGE_MOBS ≤ siege budget (60)", () => {
    expect(GLOBAL_ARMY_CAP + MAX_ACTIVE_SIEGE_MOBS).toBeLessThanOrEqual(SWITCH_SIEGE_BUDGET);
  });

  it("ArmySystem declares GLOBAL_ARMY_CAP = 35", () => {
    const armySrc = fs.readFileSync(path.join(SRC_ROOT, "systems/ArmySystem.ts"), "utf-8");
    expect(armySrc).toContain("GLOBAL_ARMY_CAP = 35");
  });

  it("SiegeSystem declares MAX_ACTIVE_SIEGE_MOBS = 25", () => {
    const siegeSrc = fs.readFileSync(path.join(SRC_ROOT, "systems/SiegeSystem.ts"), "utf-8");
    expect(siegeSrc).toContain("MAX_ACTIVE_SIEGE_MOBS = 25");
  });

  it("4-player capped army (floor(35/4)×4) + siege mobs ≤ 60", () => {
    const capPerPlayer = Math.floor(GLOBAL_ARMY_CAP / 4);
    const totalAllies = capPerPlayer * 4;
    expect(totalAllies + MAX_ACTIVE_SIEGE_MOBS).toBeLessThanOrEqual(SWITCH_SIEGE_BUDGET);
  });

  it("2-player capped army (floor(35/2)×2) + siege mobs ≤ 60", () => {
    const capPerPlayer = Math.floor(GLOBAL_ARMY_CAP / 2);
    const totalAllies = capPerPlayer * 2;
    expect(totalAllies + MAX_ACTIVE_SIEGE_MOBS).toBeLessThanOrEqual(SWITCH_SIEGE_BUDGET);
  });

  it("singleplayer full army + siege mobs ≤ 60", () => {
    expect(GLOBAL_ARMY_CAP + MAX_ACTIVE_SIEGE_MOBS).toBeLessThanOrEqual(SWITCH_SIEGE_BUDGET);
  });
});

// ─── Bestiary kill thresholds ────────────────────────────────────────────────

describe("Bestiary: kill threshold structure", () => {
  const regularEntries = BESTIARY.filter((e) => e.enemyTypeId.startsWith("mk:mk_enemy_"));
  const bossEntries = BESTIARY.filter((e) => e.enemyTypeId.startsWith("mk:mk_boss_"));

  it("regular enemies have exactly 2 milestones (tier 1 and tier 2)", () => {
    for (const entry of regularEntries) {
      expect(
        entry.milestones,
        `${entry.enemyTypeId} should have exactly 2 bestiary milestones`,
      ).toHaveLength(2);
    }
  });

  it("boss entries have at least 1 milestone", () => {
    for (const entry of bossEntries) {
      expect(entry.milestones.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("tier 1 kill count < tier 2 kill count for multi-milestone entries", () => {
    for (const entry of BESTIARY.filter((e) => e.milestones.length >= 2)) {
      const [t1, t2] = entry.milestones;
      expect(
        t1.kills,
        `${entry.enemyTypeId}: tier 1 kills (${t1.kills}) must be < tier 2 kills (${t2.kills})`,
      ).toBeLessThan(t2.kills);
    }
  });

  it("all kill thresholds are positive integers", () => {
    for (const entry of BESTIARY) {
      for (const m of entry.milestones) {
        expect(m.kills % 1).toBe(0);
        expect(m.kills).toBeGreaterThan(0);
      }
    }
  });

  it("all enemy type IDs use mk: namespace", () => {
    for (const entry of BESTIARY) {
      expect(entry.enemyTypeId).toMatch(/^mk:/);
    }
  });

  it("effect IDs are valid Minecraft potion effects", () => {
    const VALID_EFFECTS = new Set([
      "resistance", "strength", "speed", "haste", "regeneration",
      "fire_resistance", "water_breathing", "invisibility", "night_vision",
      "jump_boost", "slow_falling", "health_boost", "absorption",
    ]);
    for (const entry of BESTIARY) {
      for (const m of entry.milestones) {
        expect(
          VALID_EFFECTS.has(m.effectId),
          `${entry.enemyTypeId}: effect "${m.effectId}" is not a recognized vanilla potion effect`,
        ).toBe(true);
      }
    }
  });

  it("effect amplifiers are 0 (tier 1) and 1 (tier 2) for regular enemies", () => {
    for (const entry of regularEntries) {
      const [t1, t2] = entry.milestones;
      expect(t1.amplifier).toBe(0);
      expect(t2.amplifier).toBe(1);
    }
  });
});

// ─── Item icon texture completeness ───────────────────────────────────────────

describe("Item texture completeness", () => {
  it("all item PNG files in RP textures/items/ are referenced in item_texture.json", () => {
    const atlas = JSON.parse(
      fs.readFileSync(path.join(RP_ROOT, "textures/item_texture.json"), "utf-8"),
    );
    const atlasTexturePaths = new Set(
      Object.values(atlas["texture_data"] as Record<string, { textures: string }>).map(
        (e) => e.textures.replace("textures/items/", ""),
      ),
    );
    const texturesDir = path.join(RP_ROOT, "textures/items");
    const pngFiles = fs.readdirSync(texturesDir).filter((f) => f.endsWith(".png"));

    pngFiles.forEach((file) => {
      const basename = file.replace(".png", "");
      expect(
        atlasTexturePaths.has(basename),
        `PNG "${file}" exists but is not referenced in item_texture.json`,
      ).toBe(true);
    });
  });
});
