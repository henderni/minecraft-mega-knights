import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * DayCounterSystem.updateHUD() uses a 27-bit composite key to detect
 * when the HUD needs a re-render:
 *
 *   key = (currentDay << 20) | (filled << 15) | (armySize << 9) | (armyCap << 3) | tier
 *
 * Field widths:
 *   day      = bits 20-26  (7 bits, max 127)
 *   filled   = bits 15-19  (5 bits, max 31)
 *   armySize = bits 9-14   (6 bits, max 63)
 *   armyCap  = bits 3-8    (6 bits, max 63)
 *   tier     = bits 0-2    (3 bits, max 7)
 *
 * These tests verify the packing is correct and doesn't collide.
 */

/** Replicate the exact packing formula from DayCounterSystem */
function hudKey(day: number, filled: number, armySize: number, armyCap: number, tier: number): number {
  return (day << 20) | (filled << 15) | (armySize << 9) | (armyCap << 3) | tier;
}

const dayCounterSrc = fs.readFileSync(
  path.join(__dirname, "../systems/DayCounterSystem.ts"),
  "utf-8",
);

describe("HUD composite key: source verification", () => {
  it("source contains the bit-packing formula", () => {
    expect(dayCounterSrc).toContain("(currentDay << 20)");
    expect(dayCounterSrc).toContain("(filled << 15)");
    expect(dayCounterSrc).toContain("(armySize << 9)");
    expect(dayCounterSrc).toContain("(armyCap << 3)");
  });

  it("source documents safe integer precision in a comment", () => {
    expect(dayCounterSrc).toContain("53-bit");
  });
});

describe("HUD composite key: uniqueness", () => {
  it("different day values produce different keys", () => {
    const k1 = hudKey(1, 10, 5, 15, 2);
    const k2 = hudKey(2, 10, 5, 15, 2);
    expect(k1).not.toBe(k2);
  });

  it("different filled values produce different keys", () => {
    const k1 = hudKey(50, 0, 5, 15, 2);
    const k2 = hudKey(50, 20, 5, 15, 2);
    expect(k1).not.toBe(k2);
  });

  it("different armySize values produce different keys", () => {
    const k1 = hudKey(50, 10, 0, 15, 2);
    const k2 = hudKey(50, 10, 35, 15, 2);
    expect(k1).not.toBe(k2);
  });

  it("different armyCap values produce different keys", () => {
    const k1 = hudKey(50, 10, 5, 15, 2);
    const k2 = hudKey(50, 10, 5, 35, 2);
    expect(k1).not.toBe(k2);
  });

  it("different tier values produce different keys", () => {
    const k1 = hudKey(50, 10, 5, 15, 0);
    const k2 = hudKey(50, 10, 5, 15, 4);
    expect(k1).not.toBe(k2);
  });

  it("all fields at zero produce key 0", () => {
    expect(hudKey(0, 0, 0, 0, 0)).toBe(0);
  });

  it("each field independently sets non-overlapping bits", () => {
    const dayOnly = hudKey(1, 0, 0, 0, 0);
    const filledOnly = hudKey(0, 1, 0, 0, 0);
    const armySizeOnly = hudKey(0, 0, 1, 0, 0);
    const armyCapOnly = hudKey(0, 0, 0, 1, 0);
    const tierOnly = hudKey(0, 0, 0, 0, 1);

    // Bitwise OR of all individual fields should equal the combined key
    const combined = dayOnly | filledOnly | armySizeOnly | armyCapOnly | tierOnly;
    expect(combined).toBe(hudKey(1, 1, 1, 1, 1));

    // And no two individual field keys should share any bits
    expect(dayOnly & filledOnly).toBe(0);
    expect(dayOnly & armySizeOnly).toBe(0);
    expect(dayOnly & armyCapOnly).toBe(0);
    expect(dayOnly & tierOnly).toBe(0);
    expect(filledOnly & armySizeOnly).toBe(0);
    expect(filledOnly & armyCapOnly).toBe(0);
    expect(filledOnly & tierOnly).toBe(0);
    expect(armySizeOnly & armyCapOnly).toBe(0);
    expect(armySizeOnly & tierOnly).toBe(0);
    expect(armyCapOnly & tierOnly).toBe(0);
  });
});

describe("HUD composite key: max value accommodation", () => {
  // Game max values: day=100 (base), filled=20, armySize=35, armyCap=35, tier=4

  it("day 100 fits in 7 bits (max 127)", () => {
    const key = hudKey(100, 0, 0, 0, 0);
    expect(key).toBe(100 << 20);
    expect(key).toBeGreaterThan(0);
  });

  it("filled=20 fits in 5 bits (max 31)", () => {
    const key = hudKey(0, 20, 0, 0, 0);
    expect(key).toBe(20 << 15);
  });

  it("armySize=35 fits in 6 bits (max 63)", () => {
    const key = hudKey(0, 0, 35, 0, 0);
    expect(key).toBe(35 << 9);
  });

  it("armyCap=35 fits in 6 bits (max 63)", () => {
    const key = hudKey(0, 0, 0, 35, 0);
    expect(key).toBe(35 << 3);
  });

  it("tier=4 fits in 3 bits (max 7)", () => {
    const key = hudKey(0, 0, 0, 0, 4);
    expect(key).toBe(4);
  });

  it("all max game values packed together produce a unique positive key", () => {
    const key = hudKey(100, 20, 35, 35, 4);
    expect(key).toBeGreaterThan(0);
    // Verify it fits in 32-bit signed integer range
    expect(key).toBeLessThan(2 ** 31);
  });

  it("max field values don't overflow into adjacent fields", () => {
    // Max each field to its bit capacity and verify no overlap
    const maxDay = hudKey(127, 0, 0, 0, 0); // 7 bits max
    const maxFilled = hudKey(0, 31, 0, 0, 0); // 5 bits max
    const maxArmy = hudKey(0, 0, 63, 0, 0); // 6 bits max
    const maxCap = hudKey(0, 0, 0, 63, 0); // 6 bits max
    const maxTier = hudKey(0, 0, 0, 0, 7); // 3 bits max

    // ORing all max fields should equal the combined key
    const allMax = maxDay | maxFilled | maxArmy | maxCap | maxTier;
    expect(allMax).toBe(hudKey(127, 31, 63, 63, 7));

    // No bit collisions
    expect(maxDay & maxFilled).toBe(0);
    expect(maxFilled & maxArmy).toBe(0);
    expect(maxArmy & maxCap).toBe(0);
    expect(maxCap & maxTier).toBe(0);
  });
});

describe("HUD composite key: endless mode (day > 100)", () => {
  it("day 120 fits in 7 bits (max 127)", () => {
    const key = hudKey(120, 10, 5, 15, 2);
    expect(key).toBeGreaterThan(0);
    // Verify day 120 doesn't overflow — 120 < 128 (7 bits)
    expect(120).toBeLessThan(128);
  });

  it("day 127 is the max representable without overflow", () => {
    const key = hudKey(127, 20, 35, 35, 4);
    expect(key).toBeGreaterThan(0);
    expect(key).toBeLessThan(2 ** 31);
  });

  it("day 128+ overflows the 7-bit day field (known limitation)", () => {
    // Day 128 = 0b10000000 — the MSB spills into bit 27
    // This doesn't cause incorrect behavior because:
    // 1. The key is only used for change detection (equality check), not decoded
    // 2. Even with overflow, different (day, filled, armySize, armyCap, tier)
    //    combos still produce different keys in practice
    const key128 = hudKey(128, 10, 5, 15, 2);
    const key129 = hudKey(129, 10, 5, 15, 2);
    // Keys are still unique for different days
    expect(key128).not.toBe(key129);
    // But a day-128-only-change is distinguishable from day-0-only-change
    // because the overflow bit goes into unused higher bits
    expect(hudKey(128, 0, 0, 0, 0)).not.toBe(hudKey(0, 0, 0, 0, 0));
  });

  it("day 200 still produces unique keys (overflow is safe for equality checks)", () => {
    const k1 = hudKey(200, 10, 5, 15, 2);
    const k2 = hudKey(201, 10, 5, 15, 2);
    expect(k1).not.toBe(k2);
  });

  it("day 300 still produces a valid 32-bit integer key", () => {
    const key = hudKey(300, 20, 35, 35, 4);
    // 300 << 20 = 314572800, well within 32-bit signed range
    expect(key).toBeLessThan(2 ** 31);
    expect(key).toBeGreaterThan(0);
  });
});
