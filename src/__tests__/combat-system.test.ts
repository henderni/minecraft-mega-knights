/**
 * combat-system.test.ts
 *
 * Source-as-text behavioral tests for CombatSystem.ts.
 * Validates boss non-recruitment, kill cap, deferred spawning,
 * entity capture safety, and difficulty-based recruit chance.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.join(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf-8");
}

const combatSrc = readSource("systems/CombatSystem.ts");

describe("CombatSystem: boss non-recruitment", () => {
  it("checks for mk:mk_boss_ prefix", () => {
    expect(combatSrc).toContain('mk:mk_boss_');
  });

  it("tracks boss kills in bestiary", () => {
    // The boss handler block (second occurrence of mk:mk_boss_) calls bestiary.onKill
    const firstBoss = combatSrc.indexOf('startsWith("mk:mk_boss_")');
    const bossHandler = combatSrc.indexOf('startsWith("mk:mk_boss_")', firstBoss + 1);
    const bossReturn = combatSrc.indexOf("return;", bossHandler);
    const bossBlock = combatSrc.slice(bossHandler, bossReturn + 10);
    expect(bossBlock).toContain("bestiary.onKill");
  });

  it("returns early for bosses — no recruitment", () => {
    // After boss bestiary tracking, there should be a return before recruitment
    const firstBoss = combatSrc.indexOf('startsWith("mk:mk_boss_")');
    const bossHandler = combatSrc.indexOf('startsWith("mk:mk_boss_")', firstBoss + 1);
    const nextReturn = combatSrc.indexOf("return;", bossHandler);
    const recruitIdx = combatSrc.indexOf("recruitAlly", bossHandler);
    // Return must come before recruitAlly
    expect(nextReturn).toBeLessThan(recruitIdx);
  });
});

describe("CombatSystem: kill count", () => {
  it("caps kill count at 99999", () => {
    expect(combatSrc).toContain("99999");
    expect(combatSrc).toMatch(/Math\.min\(99999/);
  });

  it("stores kills via setDynamicProperty", () => {
    expect(combatSrc).toContain('setDynamicProperty("mk:kills"');
  });
});

describe("CombatSystem: deferred recruitment", () => {
  it("uses system.run() to defer world mutation", () => {
    expect(combatSrc).toContain("system.run(");
  });

  it("captures entity properties BEFORE system.run closure", () => {
    // typeId, location, dimension must be captured before system.run
    const systemRunIdx = combatSrc.indexOf("system.run(");
    const typeIdCapture = combatSrc.indexOf("const typeId = dead.typeId");
    const locationCapture = combatSrc.indexOf("const location = { ...dead.location }");
    const dimensionCapture = combatSrc.indexOf("const dimension = dead.dimension");

    expect(typeIdCapture).toBeLessThan(systemRunIdx);
    expect(locationCapture).toBeLessThan(systemRunIdx);
    expect(dimensionCapture).toBeLessThan(systemRunIdx);
  });

  it("calls recruitAlly inside system.run with captured values", () => {
    const systemRunBlock = combatSrc.slice(
      combatSrc.indexOf("system.run("),
      combatSrc.indexOf("system.run(") + 300,
    );
    expect(systemRunBlock).toContain("recruitAlly");
    // Uses captured variables, not dead.typeId
    expect(systemRunBlock).toContain("typeId, location, dimension");
  });
});

describe("CombatSystem: recruit failure", () => {
  it("sends RECRUIT_FAILED message on failed roll", () => {
    expect(combatSrc).toContain("RECRUIT_FAILED");
    // Import check
    expect(combatSrc).toContain('import');
    expect(combatSrc).toContain("RECRUIT_FAILED");
  });

  it("plays bass note on failure", () => {
    expect(combatSrc).toContain("note.bass");
  });
});

describe("CombatSystem: difficulty integration", () => {
  it("uses DifficultySystem.getRecruitChance() for probability", () => {
    expect(combatSrc).toContain("getRecruitChance()");
    expect(combatSrc).toContain("this.difficulty");
  });

  it("imports DifficultySystem", () => {
    expect(combatSrc).toContain("DifficultySystem");
  });
});
