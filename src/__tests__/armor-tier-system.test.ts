/**
 * armor-tier-system.test.ts
 *
 * Source-as-text behavioral tests for ArmorTierSystem.ts.
 * Validates initialization guards, unlock logic, token commands,
 * and tier-specific audio cues.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { ARMOR_TIERS } from "../data/ArmorTiers";

const SRC_ROOT = path.join(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf-8");
}

const armorSrc = readSource("systems/ArmorTierSystem.ts");

describe("ArmorTierSystem: initializePlayer", () => {
  it("checks mk:has_started before giving armor", () => {
    expect(armorSrc).toContain("mk:has_started");
    // Must check has_started and only give armor if false
    const initBlock = armorSrc.slice(
      armorSrc.indexOf("initializePlayer"),
      armorSrc.indexOf("unlockTier"),
    );
    expect(initBlock).toContain("mk:has_started");
    expect(initBlock).toContain("!hasStarted");
    expect(initBlock).toContain("mk_page_helmet");
  });

  it("gives all 4 Page armor pieces to new players", () => {
    const initBlock = armorSrc.slice(
      armorSrc.indexOf("initializePlayer"),
      armorSrc.indexOf("unlockTier"),
    );
    expect(initBlock).toContain("mk_page_helmet");
    expect(initBlock).toContain("mk_page_chestplate");
    expect(initBlock).toContain("mk_page_leggings");
    expect(initBlock).toContain("mk_page_boots");
  });
});

describe("ArmorTierSystem: unlockTier", () => {
  it("iterates getAllPlayers with try-catch", () => {
    const unlockBlock = armorSrc.slice(
      armorSrc.indexOf("static unlockTier"),
      armorSrc.indexOf("static isTierUnlocked"),
    );
    expect(unlockBlock).toContain("getAllPlayers()");
    expect(unlockBlock).toContain("try");
    expect(unlockBlock).toContain("catch");
  });

  it("sets both mk:tier_unlocked_N and mk:current_tier", () => {
    const unlockBlock = armorSrc.slice(
      armorSrc.indexOf("static unlockTier"),
      armorSrc.indexOf("static isTierUnlocked"),
    );
    expect(unlockBlock).toContain("mk:tier_unlocked_");
    expect(unlockBlock).toContain("mk:current_tier");
    expect(unlockBlock).toContain("setDynamicProperty");
  });

  it("plays extra totem sound for Mega Knight tier (index 4)", () => {
    const unlockBlock = armorSrc.slice(
      armorSrc.indexOf("static unlockTier"),
      armorSrc.indexOf("static isTierUnlocked"),
    );
    expect(unlockBlock).toContain("tierIndex === 4");
    expect(unlockBlock).toContain("random.totem");
  });
});

describe("ArmorTierSystem: TOKEN_COMMANDS", () => {
  it("has entries for tiers 1-4 only (not tier 0)", () => {
    // TOKEN_COMMANDS should have keys 1, 2, 3, 4
    expect(armorSrc).toContain("1: \"give @s mk:mk_squire_token 4\"");
    expect(armorSrc).toContain("2: \"give @s mk:mk_knight_token 4\"");
    expect(armorSrc).toContain("3: \"give @s mk:mk_champion_token 4\"");
    expect(armorSrc).toContain("4: \"give @s mk:mk_mega_knight_token 4\"");
    // No tier 0 entry — Page doesn't need tokens (given directly)
    expect(armorSrc).not.toMatch(/\b0:\s*"give @s mk:mk_page/);
  });

  it("each token gives exactly 4 items (one per armor piece)", () => {
    const tokenMatches = [...armorSrc.matchAll(/give @s mk:mk_\w+_token (\d+)/g)];
    expect(tokenMatches.length).toBe(4);
    for (const m of tokenMatches) {
      expect(m[1]).toBe("4");
    }
  });
});

describe("ArmorTierSystem: isTierUnlocked", () => {
  it("always returns true for tier 0 (Page)", () => {
    const isTierBlock = armorSrc.slice(armorSrc.indexOf("static isTierUnlocked"));
    expect(isTierBlock).toContain("tierIndex === 0");
    expect(isTierBlock).toContain("return true");
  });

  it("reads dynamic property for other tiers", () => {
    const isTierBlock = armorSrc.slice(armorSrc.indexOf("static isTierUnlocked"));
    expect(isTierBlock).toContain("getDynamicProperty");
    expect(isTierBlock).toContain("mk:tier_unlocked_");
  });
});

describe("ArmorTierSystem: data consistency", () => {
  it("ARMOR_TIERS has exactly 5 tiers", () => {
    expect(ARMOR_TIERS).toHaveLength(5);
  });

  it("TOKEN_COMMANDS count matches non-Page tiers", () => {
    // 4 token commands for tiers 1-4
    const tokenEntries = [...armorSrc.matchAll(/(\d+):\s*"give @s mk:mk_\w+_token/g)];
    expect(tokenEntries.length).toBe(ARMOR_TIERS.length - 1);
  });
});
