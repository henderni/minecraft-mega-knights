/**
 * bug-fixes.test.ts
 *
 * Tests for bugs found during comprehensive audit.
 * Validates fixes to prevent regressions:
 *
 * 1. Camp reward drop uses spawnItem API (not invalid "summon item" command)
 * 2. Blueprint consumed on use (player.runCommand clear)
 * 3. Standard Bearer scroll respects army cap and increments army size
 * 4. All player-facing strings centralized in Strings.ts
 * 5. Shared utilities not duplicated across systems
 * 6. MerchantSystem constructor requires ArmySystem dependency
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.join(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf-8");
}

// ─── 1. Camp reward drop uses scripting API ─────────────────────────────────

describe("Camp reward drop: uses spawnItem API", () => {
  const campSrc = readSource("systems/EnemyCampSystem.ts");

  it("does NOT use 'summon item' command for reward drops", () => {
    expect(campSrc).not.toContain("summon item");
  });

  it("uses ItemStack for reward drops", () => {
    expect(campSrc).toContain("new ItemStack(");
  });

  it("uses dimension.spawnItem for reward drops", () => {
    expect(campSrc).toContain("dimension.spawnItem(");
  });

  it("imports ItemStack from @minecraft/server", () => {
    expect(campSrc).toMatch(/import\s*\{[^}]*ItemStack[^}]*\}\s*from\s*["']@minecraft\/server["']/);
  });
});

// ─── 2. Blueprint consumed on use ───────────────────────────────────────────

describe("Blueprint consumption: item removed after placement", () => {
  const castleSrc = readSource("systems/CastleSystem.ts");

  it("runs clear command after successful placement", () => {
    expect(castleSrc).toContain("clear @s");
  });

  it("clear command uses safeTypeId derived from validated blueprintId", () => {
    // Verify clear uses safeTypeId (reconstructed from validated blueprintId), not raw item.typeId
    expect(castleSrc).toContain("safeTypeId");
    expect(castleSrc).toMatch(/clear @s \$\{safeTypeId\}/);
  });

  it("placement block includes consumption before messages", () => {
    const placedIdx = castleSrc.indexOf("if (placed)");
    const clearIdx = castleSrc.indexOf("clear @s");
    // Find CASTLE_PLACED usage AFTER the if (placed) block, not in imports
    const messagIdx = castleSrc.indexOf("CASTLE_PLACED", placedIdx);
    expect(placedIdx).toBeGreaterThan(-1);
    expect(clearIdx).toBeGreaterThan(placedIdx);
    expect(messagIdx).toBeGreaterThan(clearIdx);
  });
});

// ─── 3. Standard Bearer scroll respects army cap ────────────────────────────

describe("Standard Bearer scroll: army cap enforcement", () => {
  const merchantSrc = readSource("systems/MerchantSystem.ts");

  it("checks army capacity before spawning standard bearer", () => {
    expect(merchantSrc).toContain("getMaxArmySize");
    expect(merchantSrc).toContain("getEffectiveCap");
  });

  it("reads current army size from dynamic property", () => {
    // Verify it reads mk:army_size to check capacity
    expect(merchantSrc).toContain('mk:army_size');
  });

  it("increments army count after spawning standard bearer", () => {
    // After spawn, should set mk:army_size to currentSize + 1 (reuses capacity-check read)
    expect(merchantSrc).toContain('setDynamicProperty("mk:army_size"');
    expect(merchantSrc).toContain("currentSize + 1");
  });

  it("sends army full message when at capacity", () => {
    expect(merchantSrc).toContain("ARMY_FULL");
  });

  it("sends multiplayer-aware capacity message", () => {
    expect(merchantSrc).toContain("ARMY_FULL_SHARED");
  });

  it("checks player.isValid before spawning", () => {
    // Should have validity check at the top of onScrollUse
    const methodStart = merchantSrc.indexOf("onScrollUse");
    const validCheck = merchantSrc.indexOf("player.isValid", methodStart);
    expect(validCheck).toBeGreaterThan(methodStart);
  });

  it("checks player count for multiplayer cap scaling", () => {
    expect(merchantSrc).toContain("getAllPlayers().length");
  });
});

// ─── 3b. Camp safety recount drops rewards ───────────────────────────────────

describe("Camp safety recount: calls campCleared() not just delete", () => {
  const campSrc = readSource("systems/EnemyCampSystem.ts");

  it("tick() recount path calls campCleared when guardCount hits 0", () => {
    // The safety recount in tick() should call this.campCleared() — NOT just
    // this.activeCamps.delete() — so rewards drop and player is notified
    // even when guards despawn from unloaded chunks.
    const tickMethod = campSrc.slice(campSrc.indexOf("tick():"));
    expect(tickMethod).toContain("this.campCleared(");
  });

  it("tick() guard-recount path does NOT silently delete camps", () => {
    // The guard-recount section (before stale camp expiration) should call
    // campCleared() when guards hit 0, NOT bare activeCamps.delete().
    // Stale camp expiration (for disconnected players) legitimately uses
    // activeCamps.delete since the player is gone and no rewards apply.
    const tickMethod = campSrc.slice(campSrc.indexOf("tick():"));
    const recountSection = tickMethod.slice(0, tickMethod.indexOf("stale"));
    expect(recountSection).toContain("this.campCleared(");
    expect(recountSection).not.toContain("this.activeCamps.delete(");
  });
});

// ─── 4. All strings centralized in Strings.ts ──────────────────────────────

describe("String centralization: no hardcoded player-facing strings", () => {
  const stringsSrc = readSource("data/Strings.ts");

  it("Strings.ts exports MERCHANT_APPEARED", () => {
    expect(stringsSrc).toContain("export const MERCHANT_APPEARED");
  });

  it("Strings.ts exports STANDARD_BEARER_JOINED", () => {
    expect(stringsSrc).toContain("export const STANDARD_BEARER_JOINED");
  });

  it("MerchantSystem imports from Strings.ts (no inline strings)", () => {
    const merchantSrc = readSource("systems/MerchantSystem.ts");
    expect(merchantSrc).toContain("MERCHANT_APPEARED");
    expect(merchantSrc).toContain("STANDARD_BEARER_JOINED");
    // Should not have the old hardcoded strings
    expect(merchantSrc).not.toContain('"§6⚑ A Wandering Merchant');
    expect(merchantSrc).not.toContain('"§a+ A Standard Bearer has joined');
  });

  it("all system files import strings from Strings.ts", () => {
    const systemFiles = [
      "systems/DayCounterSystem.ts",
      "systems/ArmySystem.ts",
      "systems/CastleSystem.ts",
      "systems/SiegeSystem.ts",
      "systems/EnemyCampSystem.ts",
      "systems/MerchantSystem.ts",
      "systems/ArmorTierSystem.ts",
    ];
    for (const file of systemFiles) {
      const src = readSource(file);
      // Each system should import from Strings.ts if it sends messages
      if (src.includes("sendMessage(")) {
        expect(src).toContain("../data/Strings");
      }
    }
  });
});

// ─── 5. No duplicate utility functions ──────────────────────────────────────

describe("Shared utilities: no code duplication", () => {
  it("EnemyCampSystem imports findGroundLevel (not defined locally)", () => {
    const campSrc = readSource("systems/EnemyCampSystem.ts");
    expect(campSrc).toContain('import { findGroundLevel }');
    // Should NOT have a private findGroundLevel method
    expect(campSrc).not.toContain("private findGroundLevel");
  });

  it("findGroundLevel is exported from MerchantSystem", () => {
    const merchantSrc = readSource("systems/MerchantSystem.ts");
    expect(merchantSrc).toContain("export function findGroundLevel");
  });

  it("MerchantSystem uses getOwnerTag from ArmySystem (not inline sanitization)", () => {
    const merchantSrc = readSource("systems/MerchantSystem.ts");
    expect(merchantSrc).toContain("getOwnerTag");
    expect(merchantSrc).toContain('from "./ArmySystem"');
    // Should NOT have inline regex sanitization for owner tag
    const scrollMethod = merchantSrc.slice(merchantSrc.indexOf("onScrollUse"));
    expect(scrollMethod).not.toMatch(/replace\(\s*\/\[\^a-zA-Z/);
  });

  it("getOwnerTag is exported from ArmySystem", () => {
    const armySrc = readSource("systems/ArmySystem.ts");
    expect(armySrc).toContain("export function getOwnerTag");
  });

  it("sanitizePlayerTag is exported from ArmySystem", () => {
    const armySrc = readSource("systems/ArmySystem.ts");
    expect(armySrc).toContain("export function sanitizePlayerTag");
  });
});

// ─── 6. MerchantSystem dependency injection ─────────────────────────────────

describe("MerchantSystem: dependency injection", () => {
  it("MerchantSystem constructor takes ArmySystem parameter", () => {
    const merchantSrc = readSource("systems/MerchantSystem.ts");
    expect(merchantSrc).toContain("constructor(army: ArmySystem)");
  });

  it("main.ts passes army to MerchantSystem constructor", () => {
    const mainSrc = readSource("main.ts");
    expect(mainSrc).toContain("new MerchantSystem(army)");
  });

  it("MerchantSystem stores ArmySystem reference", () => {
    const merchantSrc = readSource("systems/MerchantSystem.ts");
    expect(merchantSrc).toContain("private army: ArmySystem");
  });
});
