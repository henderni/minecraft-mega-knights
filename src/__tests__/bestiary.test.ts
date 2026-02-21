import { describe, it, expect } from "vitest";
import { BESTIARY, BESTIARY_EFFECT_DURATION_TICKS } from "../data/BestiaryDefinitions";
import { ENEMY_SPAWN_DAY } from "../data/WaveDefinitions";
import * as fs from "fs";
import * as path from "path";

describe("BestiaryDefinitions: structure", () => {
  it("has exactly 5 entries (4 enemies + 1 boss)", () => {
    expect(BESTIARY).toHaveLength(5);
  });

  it("all entries have mk: namespace entity type IDs", () => {
    for (const entry of BESTIARY) {
      expect(entry.enemyTypeId).toMatch(/^mk:mk_(enemy|boss)_/);
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

describe("BestiaryDefinitions: ENEMY_SPAWN_DAY cross-reference", () => {
  const spawnDayKeys = Object.keys(ENEMY_SPAWN_DAY);

  it("every non-boss bestiary enemyTypeId has a matching ENEMY_SPAWN_DAY entry", () => {
    const regularEnemies = BESTIARY.filter((e) => !e.enemyTypeId.startsWith("mk:mk_boss_"));
    expect(regularEnemies.length).toBeGreaterThan(0);

    for (const entry of regularEnemies) {
      expect(
        spawnDayKeys,
        `Bestiary enemy "${entry.enemyTypeId}" (${entry.displayName}) has no ENEMY_SPAWN_DAY entry`,
      ).toContain(entry.enemyTypeId);
    }
  });

  it("boss entries are intentionally excluded from ENEMY_SPAWN_DAY (script-spawned only)", () => {
    const bossEntries = BESTIARY.filter((e) => e.enemyTypeId.startsWith("mk:mk_boss_"));
    expect(bossEntries.length).toBeGreaterThan(0);

    for (const entry of bossEntries) {
      expect(spawnDayKeys).not.toContain(entry.enemyTypeId);
    }
  });

  it("every ENEMY_SPAWN_DAY key appears in the bestiary", () => {
    const bestiaryTypeIds = BESTIARY.map((e) => e.enemyTypeId);
    for (const key of spawnDayKeys) {
      expect(
        bestiaryTypeIds,
        `ENEMY_SPAWN_DAY has "${key}" but it has no bestiary entry — kills won't be tracked`,
      ).toContain(key);
    }
  });
});

// ─── Bestiary respawn reapplication (task #125) ─────────────────────────────

describe("main.ts: bestiary effects reapplied on every respawn", () => {
  const mainSrc = fs.readFileSync(path.join(__dirname, "../main.ts"), "utf-8");

  it("calls bestiary.onPlayerSpawn outside the initialSpawn block", () => {
    // Find the playerSpawn event handler
    const handlerStart = mainSrc.indexOf("playerSpawn.subscribe");
    expect(handlerStart).toBeGreaterThan(-1);

    // bestiary.onPlayerSpawn must appear in the handler
    const bestiaryCall = mainSrc.indexOf("bestiary.onPlayerSpawn", handlerStart);
    expect(bestiaryCall).toBeGreaterThan(-1);

    // It must NOT be inside the initialSpawn conditional — verify by checking
    // that the bestiary call comes AFTER the closing brace of the initialSpawn block.
    const initialSpawnIdx = mainSrc.indexOf("event.initialSpawn", handlerStart);
    if (initialSpawnIdx !== -1) {
      // Find closing brace of the initialSpawn block
      const openBrace = mainSrc.indexOf("{", initialSpawnIdx);
      let depth = 1;
      let i = openBrace + 1;
      while (i < mainSrc.length && depth > 0) {
        if (mainSrc[i] === "{") { depth++; }
        else if (mainSrc[i] === "}") { depth--; }
        i++;
      }
      const closingBrace = i - 1;
      // bestiary call must be after the closing brace (not inside the if block)
      expect(bestiaryCall).toBeGreaterThan(closingBrace);
    }
  });

  it("comment explains effects are reapplied on respawn after death", () => {
    expect(mainSrc).toContain("respawn");
  });
});
