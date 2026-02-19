import { describe, it, expect } from "vitest";
import { BESTIARY, BESTIARY_EFFECT_DURATION_TICKS } from "../data/BestiaryDefinitions";
import * as fs from "fs";
import * as path from "path";

describe("BestiaryDefinitions: structure", () => {
  it("has exactly 4 entries (one per enemy type)", () => {
    expect(BESTIARY).toHaveLength(4);
  });

  it("all entries have mk: namespace enemy type IDs", () => {
    for (const entry of BESTIARY) {
      expect(entry.enemyTypeId).toMatch(/^mk:mk_enemy_/);
    }
  });

  it("all entries have mk: namespace kill keys", () => {
    for (const entry of BESTIARY) {
      expect(entry.killKey).toMatch(/^mk:kills_/);
    }
  });

  it("kill keys are unique across entries", () => {
    const keys = BESTIARY.map((e) => e.killKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("all entries have at least 1 milestone", () => {
    for (const entry of BESTIARY) {
      expect(entry.milestones.length).toBeGreaterThan(0);
    }
  });

  it("milestones within each entry are in ascending kill order", () => {
    for (const entry of BESTIARY) {
      for (let i = 1; i < entry.milestones.length; i++) {
        expect(entry.milestones[i].kills).toBeGreaterThan(entry.milestones[i - 1].kills);
      }
    }
  });

  it("all milestone kill thresholds are positive", () => {
    for (const entry of BESTIARY) {
      for (const m of entry.milestones) {
        expect(m.kills).toBeGreaterThan(0);
      }
    }
  });

  it("all milestone effect IDs are non-empty strings", () => {
    for (const entry of BESTIARY) {
      for (const m of entry.milestones) {
        expect(m.effectId.length).toBeGreaterThan(0);
      }
    }
  });

  it("all milestone amplifiers are 0 or 1 (level I or II)", () => {
    for (const entry of BESTIARY) {
      for (const m of entry.milestones) {
        expect(m.amplifier).toBeGreaterThanOrEqual(0);
        expect(m.amplifier).toBeLessThanOrEqual(1);
      }
    }
  });

  it("all milestone messages are non-empty", () => {
    for (const entry of BESTIARY) {
      for (const m of entry.milestones) {
        expect(m.message.length).toBeGreaterThan(0);
      }
    }
  });

  it("dark_knight entry has lower kill thresholds (harder enemies)", () => {
    const dk = BESTIARY.find((e) => e.enemyTypeId === "mk:mk_enemy_dark_knight");
    const knight = BESTIARY.find((e) => e.enemyTypeId === "mk:mk_enemy_knight");
    expect(dk).toBeDefined();
    expect(knight).toBeDefined();
    expect(dk!.milestones[0].kills).toBeLessThan(knight!.milestones[0].kills);
  });
});

describe("BestiaryDefinitions: constants", () => {
  it("BESTIARY_EFFECT_DURATION_TICKS is greater than reapply interval (200 ticks)", () => {
    expect(BESTIARY_EFFECT_DURATION_TICKS).toBeGreaterThan(200);
  });

  it("BESTIARY_EFFECT_DURATION_TICKS provides a 50% safety overlap", () => {
    // Applied every 200 ticks, duration must be > 200 to maintain continuous effect
    expect(BESTIARY_EFFECT_DURATION_TICKS).toBeGreaterThanOrEqual(300);
  });
});

describe("BestiarySystem: wiring", () => {
  const combatSrc = fs.readFileSync(path.join(__dirname, "../systems/CombatSystem.ts"), "utf-8");
  const mainSrc = fs.readFileSync(path.join(__dirname, "../main.ts"), "utf-8");

  it("CombatSystem imports BestiarySystem", () => {
    expect(combatSrc).toContain("BestiarySystem");
  });

  it("CombatSystem accepts bestiary in constructor", () => {
    expect(combatSrc).toContain("bestiary: BestiarySystem");
  });

  it("CombatSystem calls bestiary.onKill on player kill", () => {
    expect(combatSrc).toContain("this.bestiary.onKill");
  });

  it("BestiarySystem is instantiated in main.ts", () => {
    expect(mainSrc).toContain("new BestiarySystem()");
  });

  it("bestiary.tick() is called in 200-tick interval", () => {
    expect(mainSrc).toContain("bestiary.tick()");
  });

  it("bestiary.onPlayerSpawn is called on player join", () => {
    expect(mainSrc).toContain("bestiary.onPlayerSpawn");
  });
});
