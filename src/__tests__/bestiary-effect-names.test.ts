import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import { BESTIARY } from "../data/BestiaryDefinitions";

const readSource = (relPath: string) =>
  readFileSync(join(__dirname, "..", relPath), "utf-8");

const journalSrc = readSource("systems/QuestJournalSystem.ts");

/** The same formatting logic used in QuestJournalSystem */
const formatEffectName = (effectId: string): string =>
  effectId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

describe("Bestiary effect IDs", () => {
  it("all entries have non-empty effectId strings", () => {
    for (const entry of BESTIARY) {
      for (const m of entry.milestones) {
        expect(m.effectId).toBeTruthy();
        expect(typeof m.effectId).toBe("string");
        expect(m.effectId.length).toBeGreaterThan(0);
      }
    }
  });

  it("no effectId contains uppercase letters (convention check)", () => {
    for (const entry of BESTIARY) {
      for (const m of entry.milestones) {
        expect(m.effectId).toBe(m.effectId.toLowerCase());
      }
    }
  });

  it("all milestones have amplifier 0 or 1", () => {
    for (const entry of BESTIARY) {
      for (const m of entry.milestones) {
        expect([0, 1]).toContain(m.amplifier);
      }
    }
  });
});

describe("Effect name formatting", () => {
  it("health_boost formats to 'Health Boost' not 'Health_boost'", () => {
    expect(formatEffectName("health_boost")).toBe("Health Boost");
  });

  it("single-word effects capitalize correctly", () => {
    expect(formatEffectName("speed")).toBe("Speed");
    expect(formatEffectName("strength")).toBe("Strength");
    expect(formatEffectName("resistance")).toBe("Resistance");
  });

  it("all BESTIARY effectIds produce clean display names (no underscores)", () => {
    for (const entry of BESTIARY) {
      for (const m of entry.milestones) {
        const formatted = formatEffectName(m.effectId);
        expect(formatted).not.toContain("_");
        expect(formatted.charAt(0)).toBe(formatted.charAt(0).toUpperCase());
      }
    }
  });

  it("QuestJournalSystem uses underscore replacement in formatting", () => {
    expect(journalSrc).toContain("replace(/_/g");
  });
});
