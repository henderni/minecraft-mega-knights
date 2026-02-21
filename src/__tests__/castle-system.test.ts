import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import { CASTLE_BLUEPRINTS } from "../data/CastleBlueprints";

const readSource = (relPath: string) =>
  readFileSync(join(__dirname, "..", relPath), "utf-8");

const castleSrc = readSource("systems/CastleSystem.ts");

// ─── Blueprint data tests ───────────────────────────────────────────────────

describe("CastleSystem: CASTLE_BLUEPRINTS data", () => {
  const expectedBlueprints = ["small_tower", "gatehouse", "great_hall"];

  for (const id of expectedBlueprints) {
    it(`has "${id}" blueprint defined`, () => {
      expect(CASTLE_BLUEPRINTS[id]).toBeDefined();
    });

    it(`"${id}" has structureId`, () => {
      expect(CASTLE_BLUEPRINTS[id].structureId).toBeTruthy();
    });

    it(`"${id}" has troopBonus > 0`, () => {
      expect(CASTLE_BLUEPRINTS[id].troopBonus).toBeGreaterThan(0);
    });

    it(`"${id}" has displayName`, () => {
      expect(CASTLE_BLUEPRINTS[id].displayName).toBeTruthy();
    });
  }

  it("troop bonuses total 20 (all 3 structures = MAX_ARMY_BONUS)", () => {
    const total = expectedBlueprints.reduce(
      (sum, id) => sum + CASTLE_BLUEPRINTS[id].troopBonus,
      0,
    );
    expect(total).toBe(20);
  });
});

// ─── Source-as-text behavioral tests ────────────────────────────────────────

describe("CastleSystem: onItemUse behavior", () => {
  it("checks for mk:mk_blueprint_ prefix on item typeId", () => {
    expect(castleSrc).toContain('startsWith("mk:mk_blueprint_")');
  });

  it("checks player.isValid before accessing player properties", () => {
    const onItemUseIdx = castleSrc.indexOf("onItemUse(");
    const isValidIdx = castleSrc.indexOf("isValid", onItemUseIdx);
    const rayIdx = castleSrc.indexOf("getBlockFromViewDirection", onItemUseIdx);
    expect(isValidIdx).toBeGreaterThan(onItemUseIdx);
    expect(isValidIdx).toBeLessThan(rayIdx);
  });

  it("sends CASTLE_LOOK_AT_GROUND when raycast fails", () => {
    expect(castleSrc).toContain("CASTLE_LOOK_AT_GROUND");
  });

  it("calls structureManager.place() inside try-catch", () => {
    const placeIdx = castleSrc.indexOf("structureManager.place(");
    // Find the try block that wraps it
    const tryIdx = castleSrc.lastIndexOf("try {", placeIdx);
    expect(tryIdx).toBeGreaterThan(-1);
    expect(placeIdx).toBeGreaterThan(tryIdx);
  });

  it("falls back to buildFallbackStaggered on structure failure", () => {
    expect(castleSrc).toContain("buildFallbackStaggered(blueprintId");
  });

  it("consumes blueprint item via clear command with safeTypeId", () => {
    expect(castleSrc).toMatch(/clear @s \$\{safeTypeId\}/);
  });

  it("calls addTroopBonus after placement", () => {
    const placeIdx = castleSrc.indexOf("structureManager.place(");
    const bonusIdx = castleSrc.indexOf("addTroopBonus", placeIdx);
    expect(bonusIdx).toBeGreaterThan(placeIdx);
  });

  it("sends CASTLE_PLACED and CASTLE_CAPACITY_UP messages", () => {
    expect(castleSrc).toContain("CASTLE_PLACED(blueprint.displayName)");
    expect(castleSrc).toContain("CASTLE_CAPACITY_UP(blueprint.troopBonus");
  });

  it("plays anvil sound on placement", () => {
    expect(castleSrc).toContain("random.anvil_use");
  });

  it("wraps outer player access in try-catch for disconnect safety", () => {
    // The outer try-catch should wrap everything from raycast to messages
    const onItemUseIdx = castleSrc.indexOf("onItemUse(");
    const methodBody = castleSrc.slice(onItemUseIdx, castleSrc.indexOf("\n  }", onItemUseIdx + 200));
    // Should have at least 2 try blocks (outer safety + structureManager.place)
    const tryMatches = methodBody.match(/try\s*\{/g);
    expect(tryMatches).toBeTruthy();
    expect(tryMatches!.length).toBeGreaterThanOrEqual(2);
  });
});

describe("CastleSystem: buildFallbackStaggered", () => {
  it("uses system.runJob for staggered execution", () => {
    expect(castleSrc).toContain("system.runJob(");
  });

  it("spreads commands across ticks (2 per tick)", () => {
    expect(castleSrc).toContain("CMDS_PER_TICK");
    expect(castleSrc).toMatch(/CMDS_PER_TICK\s*=\s*2/);
  });

  it("uses generator function with yield", () => {
    expect(castleSrc).toContain("function* ()");
    expect(castleSrc).toContain("yield;");
  });

  it("wraps each dimension.runCommand in try-catch", () => {
    const fallbackIdx = castleSrc.indexOf("buildFallbackStaggered");
    const runCmdIdx = castleSrc.indexOf("dimension.runCommand(cmd)", fallbackIdx);
    const tryIdx = castleSrc.lastIndexOf("try {", runCmdIdx);
    expect(tryIdx).toBeGreaterThan(fallbackIdx);
  });
});

describe("CastleSystem: getBuildCommands", () => {
  it("handles all 3 blueprint types", () => {
    expect(castleSrc).toContain('"small_tower"');
    expect(castleSrc).toContain('"gatehouse"');
    expect(castleSrc).toContain('"great_hall"');
  });

  it("returns empty array for unknown blueprintId", () => {
    expect(castleSrc).toContain("default:");
    expect(castleSrc).toContain("return [];");
  });

  it("uses Math.floor on coordinates", () => {
    expect(castleSrc).toContain("Math.floor(origin.x)");
    expect(castleSrc).toContain("Math.floor(origin.y)");
    expect(castleSrc).toContain("Math.floor(origin.z)");
  });
});

describe("CastleSystem: build commands content", () => {
  it("small tower uses cobblestone foundation", () => {
    expect(castleSrc).toMatch(/buildSmallTower[\s\S]*?fill.*cobblestone/);
  });

  it("gatehouse includes iron bars portcullis", () => {
    expect(castleSrc).toMatch(/buildGatehouse[\s\S]*?iron_bars/);
  });

  it("great hall includes throne (oak_stairs)", () => {
    expect(castleSrc).toMatch(/buildGreatHall[\s\S]*?oak_stairs/);
  });

  it("great hall includes red carpet aisle", () => {
    expect(castleSrc).toContain("red_carpet");
  });
});
