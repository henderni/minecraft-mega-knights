import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { ARMOR_TIERS, TIER_NAMES } from "../data/ArmorTiers";

const SRC_ROOT = join(__dirname, "..");
const DAY_COUNTER_SRC = readFileSync(join(SRC_ROOT, "systems/DayCounterSystem.ts"), "utf-8");
const QUEST_JOURNAL_SRC = readFileSync(join(SRC_ROOT, "systems/QuestJournalSystem.ts"), "utf-8");

describe("TIER_NAMES shared constant (ArmorTiers.ts)", () => {
  describe("ArmorTiers.ts exports", () => {
    it("TIER_NAMES is exported as an array", () => {
      expect(Array.isArray(TIER_NAMES)).toBe(true);
    });

    it("TIER_NAMES has exactly 5 entries matching ARMOR_TIERS.length", () => {
      expect(TIER_NAMES).toHaveLength(ARMOR_TIERS.length);
      expect(TIER_NAMES).toHaveLength(5);
    });

    it("TIER_NAMES entries match ARMOR_TIERS[i].name in order", () => {
      for (let i = 0; i < ARMOR_TIERS.length; i++) {
        expect(TIER_NAMES[i]).toBe(ARMOR_TIERS[i].name);
      }
    });

    it("TIER_NAMES[0] is Page", () => {
      expect(TIER_NAMES[0]).toBe("Page");
    });

    it("TIER_NAMES[4] is Mega Knight", () => {
      expect(TIER_NAMES[4]).toBe("Mega Knight");
    });
  });

  describe("DayCounterSystem.ts imports TIER_NAMES from ArmorTiers", () => {
    it("imports TIER_NAMES from ArmorTiers data file", () => {
      expect(DAY_COUNTER_SRC).toMatch(/import\s*\{[^}]*TIER_NAMES[^}]*\}\s*from\s*["']\.\.\/data\/ArmorTiers["']/);
    });

    it("does NOT define a local TIER_NAMES array literal", () => {
      // Must not have a local 'const TIER_NAMES = [' definition
      expect(DAY_COUNTER_SRC).not.toMatch(/const\s+TIER_NAMES\s*=/);
    });
  });

  describe("QuestJournalSystem.ts imports TIER_NAMES from ArmorTiers", () => {
    it("imports TIER_NAMES from ArmorTiers data file", () => {
      expect(QUEST_JOURNAL_SRC).toMatch(/import\s*\{[^}]*TIER_NAMES[^}]*\}\s*from\s*["']\.\.\/data\/ArmorTiers["']/);
    });

    it("does NOT define a local TIER_NAMES array literal", () => {
      // Must not have a local 'const TIER_NAMES = [' definition
      expect(QUEST_JOURNAL_SRC).not.toMatch(/const\s+TIER_NAMES\s*=/);
    });
  });
});
