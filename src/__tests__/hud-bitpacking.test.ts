/**
 * hud-bitpacking.test.ts
 *
 * Tests for HUD composite key bit-packing correctness in DayCounterSystem.
 * The HUD uses a 27-bit composite key packed as:
 *   (day << 20) | (filled << 15) | (armySize << 9) | (armyCap << 3) | tier
 *
 * Field widths: day(7+), filled(5), armySize(6), armyCap(6), tier(3)
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.join(__dirname, "..");

const daySrc = fs.readFileSync(
  path.join(SRC_ROOT, "systems/DayCounterSystem.ts"),
  "utf-8",
);

// ─── Replicate the bit-packing formula from DayCounterSystem.updateHUD() ────

function hudKey(
  day: number,
  filled: number,
  armySize: number,
  armyCap: number,
  tier: number,
): number {
  return (day << 20) | (filled << 15) | (armySize << 9) | (armyCap << 3) | tier;
}

// ─── Max values for each field ──────────────────────────────────────────────

const MAX_DAY_NORMAL = 100;
const MAX_DAY_ENDLESS = 300; // Practical endless mode upper bound
const MAX_FILLED = 20; // BAR_LENGTH
const MAX_ARMY_SIZE = 35; // GLOBAL_ARMY_CAP
const MAX_ARMY_CAP = 35; // GLOBAL_ARMY_CAP
const MAX_TIER = 4; // 5 tiers (0-4)

// ─── Key uniqueness ─────────────────────────────────────────────────────────

describe("HUD key uniqueness", () => {
  it("different days produce different keys", () => {
    const keys = new Set<number>();
    for (let day = 0; day <= MAX_DAY_NORMAL; day++) {
      keys.add(hudKey(day, 10, 15, 20, 2));
    }
    expect(keys.size).toBe(MAX_DAY_NORMAL + 1);
  });

  it("different filled values produce different keys", () => {
    const keys = new Set<number>();
    for (let filled = 0; filled <= MAX_FILLED; filled++) {
      keys.add(hudKey(50, filled, 15, 20, 2));
    }
    expect(keys.size).toBe(MAX_FILLED + 1);
  });

  it("different armySize values produce different keys", () => {
    const keys = new Set<number>();
    for (let size = 0; size <= MAX_ARMY_SIZE; size++) {
      keys.add(hudKey(50, 10, size, 20, 2));
    }
    expect(keys.size).toBe(MAX_ARMY_SIZE + 1);
  });

  it("different armyCap values produce different keys", () => {
    const keys = new Set<number>();
    for (let cap = 0; cap <= MAX_ARMY_CAP; cap++) {
      keys.add(hudKey(50, 10, 15, cap, 2));
    }
    expect(keys.size).toBe(MAX_ARMY_CAP + 1);
  });

  it("different tier values produce different keys", () => {
    const keys = new Set<number>();
    for (let tier = 0; tier <= MAX_TIER; tier++) {
      keys.add(hudKey(50, 10, 15, 20, tier));
    }
    expect(keys.size).toBe(MAX_TIER + 1);
  });
});

// ─── Bit field width validation ─────────────────────────────────────────────

describe("HUD key field widths accommodate max values", () => {
  it("tier field (3 bits) holds max tier value 4", () => {
    // 3 bits can hold 0-7, tier max is 4
    expect(MAX_TIER).toBeLessThanOrEqual(7);
    const key = hudKey(0, 0, 0, 0, MAX_TIER);
    // Extract tier from key: lowest 3 bits
    expect(key & 0x7).toBe(MAX_TIER);
  });

  it("armyCap field (6 bits) holds max cap value 35", () => {
    // 6 bits can hold 0-63, armyCap max is 35
    expect(MAX_ARMY_CAP).toBeLessThanOrEqual(63);
    const key = hudKey(0, 0, 0, MAX_ARMY_CAP, 0);
    // Extract armyCap: bits 3-8
    expect((key >> 3) & 0x3F).toBe(MAX_ARMY_CAP);
  });

  it("armySize field (6 bits) holds max size value 35", () => {
    // 6 bits can hold 0-63, armySize max is 35
    expect(MAX_ARMY_SIZE).toBeLessThanOrEqual(63);
    const key = hudKey(0, 0, MAX_ARMY_SIZE, 0, 0);
    // Extract armySize: bits 9-14
    expect((key >> 9) & 0x3F).toBe(MAX_ARMY_SIZE);
  });

  it("filled field (5 bits) holds max filled value 20", () => {
    // 5 bits can hold 0-31, filled max is 20
    expect(MAX_FILLED).toBeLessThanOrEqual(31);
    const key = hudKey(0, MAX_FILLED, 0, 0, 0);
    // Extract filled: bits 15-19
    expect((key >> 15) & 0x1F).toBe(MAX_FILLED);
  });

  it("day field (12 bits available) holds max normal day 100", () => {
    const key = hudKey(MAX_DAY_NORMAL, 0, 0, 0, 0);
    // Extract day: bits 20+
    expect(key >> 20).toBe(MAX_DAY_NORMAL);
  });
});

// ─── No bit overflow between adjacent fields ────────────────────────────────

describe("HUD key: no bit collision at max values", () => {
  it("max tier does not bleed into armyCap field", () => {
    const key = hudKey(0, 0, 0, 0, MAX_TIER);
    // armyCap field (bits 3-8) should be 0
    expect((key >> 3) & 0x3F).toBe(0);
  });

  it("max armyCap does not bleed into armySize field", () => {
    const key = hudKey(0, 0, 0, MAX_ARMY_CAP, 0);
    // armySize field (bits 9-14) should be 0
    expect((key >> 9) & 0x3F).toBe(0);
  });

  it("max armySize does not bleed into filled field", () => {
    const key = hudKey(0, 0, MAX_ARMY_SIZE, 0, 0);
    // filled field (bits 15-19) should be 0
    expect((key >> 15) & 0x1F).toBe(0);
  });

  it("max filled does not bleed into day field", () => {
    const key = hudKey(0, MAX_FILLED, 0, 0, 0);
    // day field (bits 20+) should be 0
    expect(key >> 20).toBe(0);
  });

  it("all fields at max values produce a valid composite key", () => {
    const key = hudKey(MAX_DAY_NORMAL, MAX_FILLED, MAX_ARMY_SIZE, MAX_ARMY_CAP, MAX_TIER);
    // Verify each field can be extracted correctly
    expect(key & 0x7).toBe(MAX_TIER);
    expect((key >> 3) & 0x3F).toBe(MAX_ARMY_CAP);
    expect((key >> 9) & 0x3F).toBe(MAX_ARMY_SIZE);
    expect((key >> 15) & 0x1F).toBe(MAX_FILLED);
    expect(key >> 20).toBe(MAX_DAY_NORMAL);
  });
});

// ─── Endless mode day values ────────────────────────────────────────────────

describe("HUD key: endless mode day values (100-300)", () => {
  it("day 100 produces a valid key", () => {
    const key = hudKey(100, MAX_FILLED, MAX_ARMY_SIZE, MAX_ARMY_CAP, MAX_TIER);
    expect(key >> 20).toBe(100);
  });

  it("day 200 produces a valid key", () => {
    const key = hudKey(200, MAX_FILLED, MAX_ARMY_SIZE, MAX_ARMY_CAP, MAX_TIER);
    expect(key >> 20).toBe(200);
  });

  it("day 300 produces a valid key", () => {
    const key = hudKey(300, MAX_FILLED, MAX_ARMY_SIZE, MAX_ARMY_CAP, MAX_TIER);
    expect(key >> 20).toBe(300);
  });

  it("endless day keys are unique across typical range", () => {
    const keys = new Set<number>();
    for (let day = 100; day <= MAX_DAY_ENDLESS; day++) {
      keys.add(hudKey(day, MAX_FILLED, MAX_ARMY_SIZE, MAX_ARMY_CAP, MAX_TIER));
    }
    expect(keys.size).toBe(MAX_DAY_ENDLESS - 100 + 1);
  });

  it("endless day keys don't collide with lower fields at max values", () => {
    for (const day of [100, 150, 200, 250, 300]) {
      const key = hudKey(day, MAX_FILLED, MAX_ARMY_SIZE, MAX_ARMY_CAP, MAX_TIER);
      // All lower fields should still be extractable
      expect(key & 0x7).toBe(MAX_TIER);
      expect((key >> 3) & 0x3F).toBe(MAX_ARMY_CAP);
      expect((key >> 9) & 0x3F).toBe(MAX_ARMY_SIZE);
      expect((key >> 15) & 0x1F).toBe(MAX_FILLED);
      expect(key >> 20).toBe(day);
    }
  });
});

// ─── Source code verification ───────────────────────────────────────────────

describe("HUD key: source code patterns", () => {
  it("uses the expected bit-packing formula", () => {
    expect(daySrc).toContain("(currentDay << 20) | (filled << 15) | (armySize << 9) | (armyCap << 3) | tier");
  });

  it("comment documents safe integer precision", () => {
    expect(daySrc).toContain("53-bit");
  });
});
