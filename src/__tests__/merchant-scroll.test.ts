/**
 * merchant-scroll.test.ts
 *
 * Source-as-text behavioral tests for MerchantSystem.onScrollUse() and findGroundLevel().
 * Validates capacity checks, tag application, scroll clearing, army full messaging,
 * and ground-level scanning.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.join(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf-8");
}

const merchantSrc = readSource("systems/MerchantSystem.ts");
const mainSrc = readSource("main.ts");

// Extract the onScrollUse method body for focused assertions
const scrollMethod = merchantSrc.slice(
  merchantSrc.indexOf("onScrollUse(player"),
  merchantSrc.indexOf("export function findGroundLevel"),
);

// ─── Capacity Check ──────────────────────────────────────────────────────────

describe("MerchantSystem.onScrollUse: capacity check", () => {
  it("reads army capacity inside system.run() deferred callback", () => {
    expect(scrollMethod).toContain("system.run(");
    // army_size read is inside the deferred block
    const runBlock = scrollMethod.slice(scrollMethod.indexOf("system.run("));
    expect(runBlock).toContain("mk:army_size");
  });

  it("uses numProp() for safe numeric property reads", () => {
    expect(scrollMethod).toContain("numProp(");
  });

  it("calls getEffectiveCap for multiplayer scaling", () => {
    expect(scrollMethod).toContain("ArmySystem.getEffectiveCap(");
  });

  it("compares currentSize against effectiveCap before spawning", () => {
    expect(scrollMethod).toContain("currentSize >= effectiveCap");
  });
});

// ─── No Redundant Re-read (Regression for Task #69) ─────────────────────────

describe("MerchantSystem.onScrollUse: no redundant army_size re-read", () => {
  it("does NOT have a second `const size = ... getDynamicProperty(\"mk:army_size\")` read", () => {
    // After the first read of currentSize, the same variable is reused for increment
    const matches = scrollMethod.match(/getDynamicProperty\s*\(\s*["']mk:army_size["']\s*\)/g);
    // Should only appear once in the scroll use method
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });

  it("increments army size using currentSize + 1 (not a fresh read)", () => {
    expect(scrollMethod).toContain("currentSize + 1");
  });
});

// ─── Standard Bearer Spawning ────────────────────────────────────────────────

describe("MerchantSystem.onScrollUse: Standard Bearer spawn", () => {
  it("spawns mk:mk_ally_standard_bearer entity", () => {
    expect(scrollMethod).toContain("mk:mk_ally_standard_bearer");
  });

  it("adds mk_army tag to spawned entity", () => {
    expect(scrollMethod).toContain('addTag("mk_army")');
  });

  it("adds owner tag to spawned entity", () => {
    expect(scrollMethod).toContain("addTag(ownerTag)");
  });

  it("sets mk:owner_name dynamic property", () => {
    expect(scrollMethod).toContain('setDynamicProperty("mk:owner_name"');
  });

  it("gives the ally a procedural name via generateAllyName()", () => {
    expect(scrollMethod).toContain("generateAllyName(");
  });

  it("sets ally nameTag with colored display format", () => {
    expect(scrollMethod).toMatch(/nameTag\s*=\s*`§a/);
    expect(scrollMethod).toContain("Standard Bearer");
  });
});

// ─── Scroll Clearing ─────────────────────────────────────────────────────────

describe("MerchantSystem.onScrollUse: scroll removal", () => {
  it("clears scroll from inventory after successful spawn", () => {
    expect(scrollMethod).toContain("clear @s mk:mk_standard_bearer_scroll");
  });

  it("clears exactly 1 scroll (not all)", () => {
    expect(scrollMethod).toMatch(/clear @s mk:mk_standard_bearer_scroll\s+0\s+1/);
  });
});

// ─── Army Full Message ───────────────────────────────────────────────────────

describe("MerchantSystem.onScrollUse: army full handling", () => {
  it("sends ARMY_FULL message when at personal capacity", () => {
    expect(scrollMethod).toContain("ARMY_FULL");
  });

  it("sends ARMY_FULL_SHARED message in multiplayer when at shared cap", () => {
    expect(scrollMethod).toContain("ARMY_FULL_SHARED");
  });

  it("returns early without spawning when army is full", () => {
    // The capacity check block has a return statement
    const capBlock = scrollMethod.slice(
      scrollMethod.indexOf("currentSize >= effectiveCap"),
      scrollMethod.indexOf("spawnEntity"),
    );
    expect(capBlock).toContain("return");
  });
});

// ─── findGroundLevel Utility ─────────────────────────────────────────────────

describe("MerchantSystem: findGroundLevel utility", () => {
  it("is exported for shared use", () => {
    expect(merchantSrc).toMatch(/export\s+function\s+findGroundLevel/);
  });

  it("scans from top to bottom (baseY + range to baseY - range)", () => {
    const fnBody = merchantSrc.slice(
      merchantSrc.indexOf("function findGroundLevel"),
      merchantSrc.lastIndexOf("return null"),
    );
    expect(fnBody).toMatch(/y\s*=\s*baseY\s*\+\s*scanRange/);
    expect(fnBody).toMatch(/y\s*>=\s*baseY\s*-\s*scanRange/);
    expect(fnBody).toContain("y--");
  });

  it("returns null when no solid ground found", () => {
    const fnBody = merchantSrc.slice(merchantSrc.indexOf("function findGroundLevel"));
    expect(fnBody).toContain("return null");
  });

  it("skips air and liquid blocks", () => {
    const fnBody = merchantSrc.slice(merchantSrc.indexOf("function findGroundLevel"));
    expect(fnBody).toContain("isAir");
    expect(fnBody).toContain("isLiquid");
  });

  it("wraps block access in try-catch for unloaded chunks", () => {
    const fnBody = merchantSrc.slice(merchantSrc.indexOf("function findGroundLevel"));
    expect(fnBody).toContain("try");
    expect(fnBody).toContain("catch");
  });

  it("has a default scanRange parameter", () => {
    expect(merchantSrc).toMatch(/findGroundLevel\([^)]*scanRange\s*=\s*\w+/);
  });
});

// ─── Main.ts wiring ──────────────────────────────────────────────────────────

describe("MerchantSystem: main.ts scroll handler wiring", () => {
  it("checks for mk:mk_standard_bearer_scroll in itemUse handler", () => {
    expect(mainSrc).toContain("mk:mk_standard_bearer_scroll");
  });

  it("calls merchant.onScrollUse when scroll is used", () => {
    expect(mainSrc).toContain("merchant.onScrollUse");
  });
});
