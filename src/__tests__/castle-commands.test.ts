/**
 * castle-commands.test.ts
 *
 * Tests for castle fallback build command generation.
 * Uses source-as-text pattern since CastleSystem imports @minecraft/server.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { CASTLE_BLUEPRINTS } from "../data/CastleBlueprints";

const SRC_ROOT = path.join(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf-8");
}

const castleSrc = readSource("systems/CastleSystem.ts");

// ─── Valid Minecraft block types used in castle commands ─────────────────────

const VALID_BLOCKS = new Set([
  "cobblestone",
  "stonebrick",
  "oak_planks",
  "air",
  "glass_pane",
  "lantern",
  "oak_fence",
  "cobblestone_wall",
  "iron_bars",
  "polished_deepslate",
  "deepslate_tiles",
  "oak_log",
  "oak_stairs",
  "chain",
  "red_carpet",
  "bookshelf",
  "blue_wool",
  "ladder",
]);

// ─── Helper: extract fill commands from source text ─────────────────────────

function extractFillCommands(methodName: string): string[] {
  const regex = new RegExp(
    `private ${methodName}\\(.*?\\): string\\[\\] \\{([\\s\\S]*?)^  \\}`,
    "m",
  );
  const match = castleSrc.match(regex);
  if (!match) return [];

  const body = match[1];
  const cmds: string[] = [];
  // Match fill and setblock command patterns
  const cmdRegex = /`((?:fill|setblock)\s[^`]+)`/g;
  let m;
  while ((m = cmdRegex.exec(body)) !== null) {
    cmds.push(m[1]);
  }
  return cmds;
}

// ─── Blueprint data tests ───────────────────────────────────────────────────

describe("CastleBlueprints definitions", () => {
  it("defines 3 blueprints: small_tower, gatehouse, great_hall", () => {
    expect(Object.keys(CASTLE_BLUEPRINTS)).toEqual(
      expect.arrayContaining(["small_tower", "gatehouse", "great_hall"]),
    );
    expect(Object.keys(CASTLE_BLUEPRINTS)).toHaveLength(3);
  });

  it("each blueprint has required fields", () => {
    for (const [key, bp] of Object.entries(CASTLE_BLUEPRINTS)) {
      expect(bp.id).toBe(key);
      expect(bp.displayName).toBeTruthy();
      expect(bp.structureId).toMatch(/^megaknights:/);
      expect(bp.unlockDay).toBeGreaterThan(0);
      expect(bp.unlockDay).toBeLessThanOrEqual(100);
      expect(bp.troopBonus).toBeGreaterThan(0);
    }
  });

  it("unlock days are in ascending order", () => {
    const days = Object.values(CASTLE_BLUEPRINTS).map((bp) => bp.unlockDay);
    for (let i = 1; i < days.length; i++) {
      expect(days[i]).toBeGreaterThanOrEqual(days[i - 1]);
    }
  });

  it("total troop bonus matches CLAUDE.md spec (5+7+8 = 20)", () => {
    const total = Object.values(CASTLE_BLUEPRINTS).reduce(
      (sum, bp) => sum + bp.troopBonus,
      0,
    );
    expect(total).toBe(20);
  });
});

// ─── Command generation: source-as-text analysis ────────────────────────────

describe("CastleSystem build command generation", () => {
  it("getBuildCommands handles all 3 blueprint IDs", () => {
    expect(castleSrc).toContain('case "small_tower"');
    expect(castleSrc).toContain('case "gatehouse"');
    expect(castleSrc).toContain('case "great_hall"');
  });

  it("getBuildCommands returns empty array for unknown blueprintId", () => {
    expect(castleSrc).toContain("default:");
    expect(castleSrc).toContain("return [];");
  });

  it("Math.floor is applied to origin coordinates", () => {
    expect(castleSrc).toContain("Math.floor(origin.x)");
    expect(castleSrc).toContain("Math.floor(origin.y)");
    expect(castleSrc).toContain("Math.floor(origin.z)");
  });
});

describe("Small Tower commands", () => {
  const cmds = extractFillCommands("buildSmallTower");

  it("generates at least 20 commands", () => {
    expect(cmds.length).toBeGreaterThanOrEqual(20);
  });

  it("all commands use fill or setblock", () => {
    for (const cmd of cmds) {
      expect(cmd).toMatch(/^(fill|setblock)\s/);
    }
  });

  it("commands reference valid block types", () => {
    for (const cmd of cmds) {
      // Extract block type (last word before optional data value or bracket)
      const blockMatch = cmd.match(
        /(?:fill|setblock)\s+.*?\s+([\w]+)(?:\s+hollow|\s+\[.*)?$/,
      );
      if (blockMatch) {
        expect(VALID_BLOCKS).toContain(blockMatch[1]);
      }
    }
  });

  it("includes foundation (fill with cobblestone at y-1)", () => {
    const foundation = cmds.find(
      (c) => c.includes("y - 1") || c.includes("${y - 1}"),
    );
    // Source uses template literals, check raw source
    expect(castleSrc).toContain("${y - 1}");
    expect(castleSrc).toMatch(/fill.*\$\{y - 1\}.*cobblestone/);
  });

  it("includes door opening (air blocks)", () => {
    expect(cmds.some((c) => c.includes("air"))).toBe(true);
  });

  it("includes ladder rungs", () => {
    expect(castleSrc).toMatch(/buildSmallTower[\s\S]*?ladder/);
  });

  it("includes lighting (lanterns)", () => {
    expect(cmds.some((c) => c.includes("lantern"))).toBe(true);
  });
});

describe("Gatehouse commands", () => {
  const cmds = extractFillCommands("buildGatehouse");

  it("generates at least 20 commands", () => {
    expect(cmds.length).toBeGreaterThanOrEqual(20);
  });

  it("includes front and rear archways (air fills)", () => {
    const airFills = cmds.filter((c) => c.startsWith("fill") && c.includes("air"));
    expect(airFills.length).toBeGreaterThanOrEqual(2);
  });

  it("includes iron bars portcullis", () => {
    expect(cmds.some((c) => c.includes("iron_bars"))).toBe(true);
  });

  it("includes crenellations (stonebrick setblocks)", () => {
    const crenellations = cmds.filter(
      (c) => c.startsWith("setblock") && c.includes("stonebrick"),
    );
    expect(crenellations.length).toBeGreaterThanOrEqual(4);
  });
});

describe("Great Hall commands", () => {
  const cmds = extractFillCommands("buildGreatHall");

  it("generates at least 20 commands", () => {
    expect(cmds.length).toBeGreaterThanOrEqual(20);
  });

  it("includes polished deepslate floor", () => {
    expect(cmds.some((c) => c.includes("polished_deepslate"))).toBe(true);
  });

  it("includes oak log pillars", () => {
    expect(cmds.some((c) => c.includes("oak_log"))).toBe(true);
  });

  it("includes throne (oak_stairs)", () => {
    expect(cmds.some((c) => c.includes("oak_stairs"))).toBe(true);
  });

  it("includes chandeliers (chain + hanging lantern)", () => {
    expect(cmds.some((c) => c.includes("chain"))).toBe(true);
    expect(cmds.some((c) => c.includes("lantern"))).toBe(true);
  });

  it("includes red carpet aisle", () => {
    expect(cmds.some((c) => c.includes("red_carpet"))).toBe(true);
  });

  it("includes bookshelves", () => {
    expect(cmds.some((c) => c.includes("bookshelf"))).toBe(true);
  });
});

// ─── Structure dimensions vs blueprints ─────────────────────────────────────

describe("Structure dimensions match blueprint definitions", () => {
  it("small tower is 5x5 footprint (from source comments)", () => {
    // Walls: fill x-2..x+2, z-2..z+2 → 5 wide, 5 deep
    expect(castleSrc).toMatch(/5×5.*tower/i);
  });

  it("gatehouse is 9x7 footprint (from source comments)", () => {
    // Walls: fill x-4..x+4, z-3..z+3 → 9 wide, 7 deep
    expect(castleSrc).toMatch(/[Gg]atehouse.*9×7/);
  });

  it("great hall is 13x9 footprint (from source comments)", () => {
    // Walls: fill x-6..x+6, z-4..z+4 → 13 wide, 9 deep
    expect(castleSrc).toMatch(/13×9.*hall/i);
  });
});

// ─── Fallback build staggering ──────────────────────────────────────────────

describe("Fallback build staggering", () => {
  it("uses system.runJob for staggered building", () => {
    expect(castleSrc).toContain("system.runJob");
  });

  it("spreads commands across ticks (yields in generator)", () => {
    expect(castleSrc).toContain("yield");
  });

  it("limits commands per tick via CMDS_PER_TICK constant", () => {
    expect(castleSrc).toContain("CMDS_PER_TICK");
  });
});
