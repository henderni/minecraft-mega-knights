/**
 * Tests for procedural ally name generation.
 * AllyNames.ts is a pure data file — safe to import directly.
 */

import { describe, it, expect } from "vitest";
import { generateAllyName, ALL_NAME_POOLS, ALL_TITLES } from "../data/AllyNames";

describe("[Data] AllyNames — name pools", () => {
  it("knight name pool has at least 20 names", () => {
    expect(ALL_NAME_POOLS.KNIGHT_NAMES.length).toBeGreaterThanOrEqual(20);
  });

  it("archer name pool has at least 20 names", () => {
    expect(ALL_NAME_POOLS.ARCHER_NAMES.length).toBeGreaterThanOrEqual(20);
  });

  it("wizard name pool has at least 20 names", () => {
    expect(ALL_NAME_POOLS.WIZARD_NAMES.length).toBeGreaterThanOrEqual(20);
  });

  it("no duplicate names within any pool", () => {
    for (const [poolName, pool] of Object.entries(ALL_NAME_POOLS)) {
      const set = new Set(pool);
      expect(set.size, `${poolName} has duplicates`).toBe(pool.length);
    }
  });

  it("all names are non-empty strings", () => {
    for (const [poolName, pool] of Object.entries(ALL_NAME_POOLS)) {
      for (const name of pool) {
        expect(name.trim().length, `Empty name in ${poolName}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("[Data] AllyNames — title pools", () => {
  it("has titles for all known ally types", () => {
    const expectedTypes = [
      "mk:mk_ally_knight",
      "mk:mk_ally_dark_knight",
      "mk:mk_ally_archer",
      "mk:mk_ally_wizard",
      "mk:mk_ally_standard_bearer",
    ];
    for (const typeId of expectedTypes) {
      expect(ALL_TITLES[typeId], `Missing titles for ${typeId}`).toBeDefined();
      expect(ALL_TITLES[typeId].length, `Empty titles for ${typeId}`).toBeGreaterThan(0);
    }
  });

  it("all titles are non-empty strings", () => {
    for (const [typeId, titles] of Object.entries(ALL_TITLES)) {
      for (const title of titles) {
        expect(title.trim().length, `Empty title in ${typeId}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("[Data] AllyNames — generateAllyName()", () => {
  it("returns a string with format 'Title Name'", () => {
    const name = generateAllyName("mk:mk_ally_knight");
    expect(name).toMatch(/^\S+ \S+$/);
  });

  it("generates different names over multiple calls (probabilistic)", () => {
    const names = new Set<string>();
    for (let i = 0; i < 50; i++) {
      names.add(generateAllyName("mk:mk_ally_knight"));
    }
    // With 30 names * 3 titles = 90 combos, 50 calls should yield at least 10 unique
    expect(names.size).toBeGreaterThanOrEqual(10);
  });

  it("uses appropriate titles for each type", () => {
    // Knight titles should be Sir/Dame/Ser
    for (let i = 0; i < 20; i++) {
      const name = generateAllyName("mk:mk_ally_knight");
      expect(name).toMatch(/^(Sir|Dame|Ser) /);
    }
  });

  it("uses scout/ranger titles for archers", () => {
    for (let i = 0; i < 20; i++) {
      const name = generateAllyName("mk:mk_ally_archer");
      expect(name).toMatch(/^(Scout|Ranger) /);
    }
  });

  it("uses mage/sage titles for wizards", () => {
    for (let i = 0; i < 20; i++) {
      const name = generateAllyName("mk:mk_ally_wizard");
      expect(name).toMatch(/^(Mage|Sage) /);
    }
  });

  it("falls back to knight pool for unknown types", () => {
    const name = generateAllyName("mk:mk_ally_unknown");
    expect(name).toMatch(/^\S+ \S+$/);
  });
});
