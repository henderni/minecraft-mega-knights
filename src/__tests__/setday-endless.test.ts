/**
 * setday-endless.test.ts
 *
 * Validates that DayCounterSystem.setDay() supports endless mode days > 100
 * and that main.ts mk:setday handler does not independently clamp to 100.
 * Uses source-as-text pattern since DayCounterSystem imports @minecraft/server.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.join(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf-8");
}

const daySrc = readSource("systems/DayCounterSystem.ts");
const mainSrc = readSource("main.ts");

// ─── setDay clamp behavior ──────────────────────────────────────────────────

describe("DayCounterSystem.setDay: endless mode clamp", () => {
  it("uses a higher clamp limit when endless mode is active", () => {
    // Should have conditional: cachedEndless ? 999 : MAX_DAY (or similar)
    expect(daySrc).toContain("cachedEndless");
    expect(daySrc).toMatch(/cachedEndless\s*\?\s*\d{3,}/);
  });

  it("does not unconditionally clamp to MAX_DAY=100", () => {
    // The old pattern was: Math.min(DayCounterSystem.MAX_DAY, day)
    // Should NOT appear as the sole clamp
    expect(daySrc).not.toMatch(/Math\.min\(\s*DayCounterSystem\.MAX_DAY\s*,\s*day\s*\)/);
  });

  it("allows day values up to 999 in endless mode", () => {
    expect(daySrc).toContain("999");
  });

  it("still clamps to MAX_DAY=100 in normal mode", () => {
    expect(daySrc).toContain("DayCounterSystem.MAX_DAY");
  });
});

// ─── Milestone execution on setDay ──────────────────────────────────────────

describe("DayCounterSystem.setDay: milestone execution", () => {
  it("fires milestones for jumped days", () => {
    expect(daySrc).toContain("MILESTONES");
    // setDay should check milestones for each day between previous and new
    expect(daySrc).toMatch(/for\s*\(\s*let\s+d\s*=\s*previousDay/);
  });

  it("uses system.runJob for staggered milestone execution", () => {
    expect(daySrc).toContain("system.runJob");
  });

  it("yields between milestone days to avoid frame spikes", () => {
    expect(daySrc).toContain("yield");
  });
});

// ─── main.ts mk:setday handler ─────────────────────────────────────────────

describe("main.ts mk:setday: no independent clamping", () => {
  // Extract the mk:setday handler block
  const setdayStart = mainSrc.indexOf('"mk:setday"');

  it("mk:setday handler exists", () => {
    expect(setdayStart).toBeGreaterThan(-1);
  });

  it("delegates clamping to dayCounter.setDay()", () => {
    // The handler should call dayCounter.setDay(day) without its own Math.min(100, ...)
    expect(mainSrc).toContain("dayCounter.setDay(day)");
  });

  it("does not independently clamp day to 100 in mk:setday handler", () => {
    // Find the mk:setday block and check it doesn't have Math.min(100, ...) or Math.min(day, 100)
    const block = mainSrc.slice(setdayStart, mainSrc.indexOf("mk:start"));
    expect(block).not.toMatch(/Math\.min\s*\(\s*100/);
    expect(block).not.toMatch(/Math\.min\s*\(\s*day\s*,\s*100/);
  });

  it("reports the actual day after setDay (not the unclamped input)", () => {
    // Should use dayCounter.getCurrentDay() in the debug message, not the raw input
    expect(mainSrc).toContain("dayCounter.getCurrentDay()");
  });
});

// ─── DayCounterSystem.tick: endless mode continuation ───────────────────────

describe("DayCounterSystem.tick: continues past day 100 in endless mode", () => {
  it("checks cachedEndless before stopping at MAX_DAY", () => {
    expect(daySrc).toMatch(/cachedDay\s*>=\s*DayCounterSystem\.MAX_DAY\s*&&\s*!this\.cachedEndless/);
  });

  it("enableEndlessMode sets cachedEndless and persists", () => {
    expect(daySrc).toContain("enableEndlessMode");
    expect(daySrc).toMatch(/cachedEndless\s*=\s*true/);
    expect(daySrc).toContain('"mk:endless_mode"');
  });
});
