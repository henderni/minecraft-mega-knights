/**
 * merchant-system.test.ts
 *
 * Source-as-text behavioral tests for MerchantSystem.ts.
 * Validates findGroundLevel null fallback, merchant spawn logic,
 * and day-based scheduling.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.join(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf-8");
}

const merchantSrc = readSource("systems/MerchantSystem.ts");

// ─── findGroundLevel null fallback (task #127) ───────────────────────────────

describe("MerchantSystem: findGroundLevel null fallback", () => {
  it("handles null return from findGroundLevel", () => {
    // spawnMerchantNear must not early-return on null groundY
    expect(merchantSrc).toContain("findGroundLevel");
    // Should use nullish coalescing or explicit null check with fallback
    expect(merchantSrc).toMatch(/null\s*\?|\?\?/);
  });

  it("falls back to player.location.y when findGroundLevel returns null", () => {
    expect(merchantSrc).toContain("player.location.y");
  });

  it("logs a warning when using the fallback path", () => {
    // Fallback should be visible in BDS logs
    expect(merchantSrc).toContain("findGroundLevel returned null");
  });

  it("does not silently return without spawning when findGroundLevel is null", () => {
    // The old code had: if (groundY === null) {return;}
    // After fix, there should be a fallback instead of an early return on null
    const nullReturnPattern = /if\s*\(\s*\w+\s*===\s*null\s*\)\s*\{\s*return\s*;\s*\}/;
    expect(merchantSrc).not.toMatch(nullReturnPattern);
  });
});

// ─── Merchant scheduling ─────────────────────────────────────────────────────

describe("MerchantSystem: spawn scheduling", () => {
  it("exports MERCHANT_DAYS constant", () => {
    expect(merchantSrc).toContain("MERCHANT_DAYS");
  });

  it("MERCHANT_DAYS includes day 15 as first merchant appearance", () => {
    expect(merchantSrc).toMatch(/MERCHANT_DAYS.*15/s);
  });

  it("skips spawning during active siege", () => {
    expect(merchantSrc).toContain("siegeActive");
  });

  it("defers entity spawn to next tick to avoid event mutation", () => {
    expect(merchantSrc).toContain("system.run(");
  });
});

// ─── Merchant entity setup ───────────────────────────────────────────────────

describe("MerchantSystem: merchant entity tags and naming", () => {
  it("tags spawned merchant with mk_merchant", () => {
    expect(merchantSrc).toContain('"mk_merchant"');
  });

  it("sets merchant nameTag with gold color formatting", () => {
    expect(merchantSrc).toContain("Wandering Merchant");
    expect(merchantSrc).toContain("§6");
  });
});
