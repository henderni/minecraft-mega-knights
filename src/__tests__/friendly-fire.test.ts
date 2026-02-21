import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SRC_ROOT = join(__dirname, "..");
const MAIN_SRC = readFileSync(join(SRC_ROOT, "main.ts"), "utf-8");

describe("Friendly Fire Protection (main.ts lines 114-171)", () => {
  it("subscribes to entityHurt afterEvent", () => {
    expect(MAIN_SRC).toMatch(/world\.afterEvents\.entityHurt\.subscribe/);
  });

  it("checks mk_army tag on hurt entity", () => {
    expect(MAIN_SRC).toMatch(/hasTag\s*\(\s*["']mk_army["']\s*\)/);
  });

  it("verifies owner via getOwnerTag function", () => {
    expect(MAIN_SRC).toMatch(/hasTag\s*\(\s*getOwnerTag\s*\(/);
  });

  it("heals back damage using health.setCurrentValue", () => {
    expect(MAIN_SRC).toMatch(/health\.setCurrentValue\s*\(/);
  });

  it("clamps healed HP with Math.min", () => {
    // Should see Math.min(..., health.effectiveMax) to clamp the heal-back
    expect(MAIN_SRC).toMatch(/Math\.min\s*\(.*health\.effectiveMax/s);
  });

  it("throttle interval is 60 ticks between messages per player", () => {
    expect(MAIN_SRC).toMatch(/>=\s*60/);
  });

  it("imports FRIENDLY_FIRE_BLOCKED from Strings", () => {
    expect(MAIN_SRC).toMatch(/FRIENDLY_FIRE_BLOCKED/);
    // Verify it comes from Strings import
    expect(MAIN_SRC).toMatch(/import.*FRIENDLY_FIRE_BLOCKED.*from.*Strings/);
  });

  it("uses FRIENDLY_FIRE_BLOCKED in sendMessage call", () => {
    expect(MAIN_SRC).toMatch(/sendMessage\s*\(\s*FRIENDLY_FIRE_BLOCKED\s*\)/);
  });

  it("defers heal-back mutation inside system.run()", () => {
    // The heal-back health.setCurrentValue must appear inside a system.run callback
    expect(MAIN_SRC).toMatch(/system\.run\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?health\.setCurrentValue/);
  });

  it("uses shared LRUTickCache for bounded rate-limit cache", () => {
    expect(MAIN_SRC).toContain("LRUTickCache");
    expect(MAIN_SRC).toContain("friendlyFireCache");
  });

  it("LRU eviction uses shared LRUTickCache class", () => {
    expect(MAIN_SRC).toContain("LRUTickCache");
    expect(MAIN_SRC).toContain("friendlyFireCache");
  });

  it("checks source player typeId is minecraft:player before acting", () => {
    expect(MAIN_SRC).toMatch(/typeId\s*!==?\s*["']minecraft:player["']/);
  });
});
